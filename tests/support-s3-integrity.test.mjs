import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { canTransitionAccountChange, canTransitionSupportTicket } from '../apps/api/src/support/support-s3-invariants.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../apps/api/src/support/support.service.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { fileName: 'support.service.ts', compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
} }).outputText;
const errorClass = name => class extends Error { constructor(message) { super(typeof message === 'string' ? message : JSON.stringify(message)); this.name = name; } };
const errors = { BadRequestException:errorClass('BadRequestException'), ConflictException:errorClass('ConflictException'), ForbiddenException:errorClass('ForbiddenException'), NotFoundException:errorClass('NotFoundException') };
const dependencies = {
  'node:crypto': require('node:crypto'),
  '@nestjs/common': { ...errors, Inject: () => () => {}, Injectable: () => x => x },
  '../database/prisma.service.js': { PrismaService:class{} },
  '../audit/audit.service.js': { AuditService:class{} },
  '../auth/access-control.js': { requireCapability:()=>{throw Error('Not tested here');} },
  '../control/internal-access.js': { requireInternalCapability: req => ({ identity: { email:req.email??'agent@proofline.test', role:'INTERNAL_PLATFORM_OWNER' } }) },
  '../common/pagination.js': { parsePagination:()=>({}),paged:()=>({}),clampedPagination:()=>({}) },
  '../control/p4-filters.js': { supportFilters:()=>({}) },
  './workspace-support-visibility.js': { canReadAccountChanges:()=>false, workspaceSupportTicketScope:()=>({}) },
  './support-s3-invariants.js': { canTransitionAccountChange, canTransitionSupportTicket },
};
const module={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+js+'\n})', { Buffer, process, Date, console, Set, Map, fetch, AbortSignal }, {filename:'support.service.compiled.js'})(name=>{
  if(!(name in dependencies))throw Error('Unexpected import '+name);
  return dependencies[name];
},module,module.exports);
const SupportService=module.exports.SupportService;

const copy=x=>structuredClone(x);
function state(overrides={}){
  return {
    change:{id:'change',organizationId:'org',supportTicketId:'ticket',status:'APPROVED',type:'LEGAL_NAME',requestedData:{requestedValue:'Nuevo Nombre'},updatedAt:new Date('2026-10-27T10:00:00Z'),appliedAt:null,...overrides.change},
    organization:{id:'org',legalName:'Nombre Antiguo'},
    members:[{id:'owner-old',organizationId:'org',role:'OWNER'},{id:'owner-new',organizationId:'org',role:'ADMIN'}],
    ticket:{id:'ticket',status:'OPEN',organizationId:'org',assigneeInternalUserId:null,updatedAt:new Date('2026-10-27T10:00:00Z'),resolvedAt:null,closedAt:null,messages:[{id:'reply',internalUserId:'agent',createdAt:new Date('2026-10-27T09:00:00Z')}] ,...overrides.ticket},
    audits:[],
  };
}
function mock(initial,opts={}){
  let current=copy(initial);
  const agent={id:'agent',email:'agent@proofline.test'};
  const match=(row,where)=>Object.entries(where).every(([k,v])=>{
    if(k==='id')return row.id===v;
    if(v instanceof Date)return row[k]?.getTime()===v.getTime();
    if(v===null)return row[k]===null;
    return row[k]===v;
  });
  function client(s,transaction=false){
    return {
      accountChangeRequest:{
        findUnique:async()=>copy(s.change),findUniqueOrThrow:async()=>copy(s.change),
        updateMany:async ({where,data})=>{
          if(opts.raceChange && transaction){s.change.status='APPLIED';opts.raceChange=false;}
          if(!match(s.change,where))return {count:0};
          Object.assign(s.change,copy(data));s.change.updatedAt=new Date(s.change.updatedAt.getTime()+1);
          return {count:1};
        },
      },
      supportTicket:{
        findUnique:async()=>copy(s.ticket),findUniqueOrThrow:async()=>copy(s.ticket),
        updateMany:async({where,data})=>{
          if(opts.raceTicket && transaction){s.ticket.updatedAt=new Date(s.ticket.updatedAt.getTime()+1);opts.raceTicket=false;}
          if(!match(s.ticket,where))return {count:0};
          Object.assign(s.ticket,copy(data));s.ticket.updatedAt=new Date(s.ticket.updatedAt.getTime()+1);
          return {count:1};
        },
      },
      internalUser:{findUnique:async()=>copy(agent)},
      organization:{update:async({data})=>{Object.assign(s.organization,data);if(opts.failOrganization)throw Error('injected organization failure');return copy(s.organization)}},
      user:{findUnique:async()=>({id:'user-new',memberships:copy(s.members.filter(m=>m.id==='owner-new'))})},
      membership:{
        updateMany:async ({where,data})=>{let count=0;for(const m of s.members)if(m.organizationId===where.organizationId&&m.role===where.role&&m.id!==where.id.not){Object.assign(m,data);count++}return {count}},
        update:async ({where,data})=>{if(opts.failMembership)throw Error('injected membership failure');const m=s.members.find(m=>m.id===where.id);Object.assign(m,data);return copy(m)},
      },
      auditEvent:{create:async({data})=>{if(opts.failAudit)throw Error('injected audit failure');s.audits.push(copy(data));return copy(data)}},
      $transaction:async fn=>{
        const draft=copy(current);
        const result=await fn(client(draft,true));
        Object.assign(current,draft);
        return result;
      },
    };
  }
  const db=client(current);
  db.$transaction=async fn=>{
    const draft=copy(current);
    const result=await fn(client(draft,true));
    Object.assign(current,draft);
    return result;
  };
  return {db,get:()=>copy(current),service:new SupportService(db,{record:async()=>{throw Error('External audit is not atomic')}})};
}
const req={email:'agent@proofline.test'};

test('S3 transition rules reject final regression and force approval before apply',()=>{
  assert.equal(canTransitionAccountChange('REQUESTED','APPLIED'),false);
  assert.equal(canTransitionAccountChange('APPROVED','APPLIED'),true);
  assert.equal(canTransitionAccountChange('APPLIED','IN_REVIEW'),false);
  assert.equal(canTransitionAccountChange('REJECTED','NEEDS_INFO'),false);
  assert.equal(canTransitionSupportTicket('CLOSED','IN_PROGRESS'),false);
  assert.equal(canTransitionSupportTicket('CLOSED','OPEN'),true);
});
test('S3 applies legal name and persists APPLIED and audit atomically',async()=>{
  const m=mock(state()); const x=await m.service.updateAccountChange(req,'change','APPLIED');
  assert.equal(x.status,'APPLIED');assert.equal(m.get().organization.legalName,'Nuevo Nombre');assert.equal(m.get().audits.length,1);
});
test('S3 rolls back organization changes if audit insertion fails',async()=>{
  const m=mock(state(),{failAudit:true});
  await assert.rejects(m.service.updateAccountChange(req,'change','APPLIED'),/injected audit failure/);
  assert.equal(m.get().organization.legalName,'Nombre Antiguo');assert.equal(m.get().change.status,'APPROVED');assert.equal(m.get().audits.length,0);
});
test('S3 rolls back APPLIED if organization update fails',async()=>{
  const m=mock(state(),{failOrganization:true});
  await assert.rejects(m.service.updateAccountChange(req,'change','APPLIED'),/injected organization failure/);
  assert.equal(m.get().change.status,'APPROVED');assert.equal(m.get().organization.legalName,'Nombre Antiguo');
});
test('S3 transfers primary ownership only in the same transaction as state and audit',async()=>{
  const m=mock(state({change:{type:'PRIMARY_OWNER',requestedData:{requestedValue:'NEW@PROOFLINE.TEST'}}}));
  await m.service.updateAccountChange(req,'change','APPLIED');
  assert.deepEqual(m.get().members.map(x=>x.role),['ADMIN','OWNER']);assert.equal(m.get().change.status,'APPLIED');
});
test('S3 restores previous owner when promotion fails',async()=>{
  const m=mock(state({change:{type:'PRIMARY_OWNER',requestedData:{requestedValue:'NEW@PROOFLINE.TEST'}}}),{failMembership:true});
  await assert.rejects(m.service.updateAccountChange(req,'change','APPLIED'),/injected membership failure/);
  assert.deepEqual(m.get().members.map(x=>x.role),['OWNER','ADMIN']);assert.equal(m.get().change.status,'APPROVED');
});
test('S3 blocks APPLIED from REQUESTED and makes retry of APPLIED idempotent',async()=>{
  const m=mock(state({change:{status:'REQUESTED'}}));
  await assert.rejects(m.service.updateAccountChange(req,'change','APPLIED'), e=>e.name==='ConflictException');
  assert.equal(m.get().change.status,'REQUESTED');
  const done=mock(state({change:{status:'APPLIED'}}));
  await done.service.updateAccountChange(req,'change','APPLIED');assert.equal(done.get().audits.length,0);
});
test('S3 compare-and-swap refuses stale change request and leaves organization untouched',async()=>{
  const m=mock(state(),{raceChange:true});
  await assert.rejects(m.service.updateAccountChange(req,'change','APPLIED'), e=>e.name==='ConflictException');
  assert.equal(m.get().organization.legalName,'Nombre Antiguo');assert.equal(m.get().change.status,'APPROVED');
});
test('S3 first assignee wins and assignment produces single audit',async()=>{
  const m=mock(state());const ticket=await m.service.assignToMe(req,'ticket');
  assert.equal(ticket.assigneeInternalUserId,'agent');assert.equal(ticket.status,'ASSIGNED');assert.equal(m.get().audits.length,1);
  await m.service.assignToMe(req,'ticket');assert.equal(m.get().audits.length,1);
});
test('S3 stale assignment and ticket status refuse overwrite',async()=>{
  const x=mock(state(),{raceTicket:true});await assert.rejects(x.service.assignToMe(req,'ticket'),e=>e.name==='ConflictException');
  assert.equal(x.get().ticket.assigneeInternalUserId,null);assert.equal(x.get().audits.length,0);
  const y=mock(state(),{raceTicket:true});await assert.rejects(y.service.updateStatus(req,'ticket','IN_PROGRESS'),e=>e.name==='ConflictException');
  assert.equal(y.get().ticket.status,'OPEN');
});
test('S3 status closes with reply and rolls back if audit fails',async()=>{
  const m=mock(state());await m.service.updateStatus(req,'ticket','CLOSED');assert.equal(m.get().ticket.status,'CLOSED');
  const f=mock(state(),{failAudit:true});await assert.rejects(f.service.updateStatus(req,'ticket','CLOSED'),/injected audit failure/);
  assert.equal(f.get().ticket.status,'OPEN');
});
test('S3 prevents closing without reply and invalid reopening',async()=>{
  const m=mock(state({ticket:{messages:[]}}));await assert.rejects(m.service.updateStatus(req,'ticket','RESOLVED'),e=>e.name==='BadRequestException');
  const f=mock(state({ticket:{status:'CLOSED'}}));await assert.rejects(f.service.updateStatus(req,'ticket','IN_PROGRESS'),e=>e.name==='ConflictException');
  await f.service.updateStatus(req,'ticket','OPEN');assert.equal(f.get().ticket.status,'OPEN');
});
test('S3 has explicit guard for NEEDS_INFO path outside account-change controller',()=>{
  const sub=source.split('async requestInformation(')[1].split('async updateAccountChange(')[0];
  assert.match(sub,/canTransitionAccountChange\(ticket\.accountChangeRequest\.status, "NEEDS_INFO"\)/);
  assert.match(sub,/accountChangeRequest\.updateMany\(/);
});

test('S3 still permits editing an in-review resolution note without changing status',async()=>{
  const m=mock(state({change:{status:'IN_REVIEW',resolutionNote:'Nota antigua'}}));
  const result=await m.service.updateAccountChange(req,'change','IN_REVIEW','Nota revisada');
  assert.equal(result.status,'IN_REVIEW');
  assert.equal(result.resolutionNote,'Nota revisada');
  assert.equal(m.get().audits.length,1);
});
