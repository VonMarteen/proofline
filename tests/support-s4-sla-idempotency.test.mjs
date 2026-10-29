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


const copy = x => structuredClone(x);
const T = '2026-10-27T12:00:00.000Z';
const late = '2026-10-27T10:00:00.000Z';
const future = '2099-10-27T12:00:00.000Z';
const time = t => new Date(t);
function ticket(id, status='OPEN', assignee=null, extra={}) {
 return {id,organizationId:'org',subject:`Solicitud ${id}`,priority:'HIGH',status,assigneeInternalUserId:assignee,
   slaDueAt:time(late),escalatedAt:null,updatedAt:time(T),organization:{name:'ACME Europa',defaultLocale:'es'},...extra};
}
const contacts=[{email:'soporte@proofline.test',role:'INTERNAL_SUPPORT'}, {email:'ops@proofline.test',role:'INTERNAL_OPERATIONS'}, {email:'owner@proofline.test',role:'INTERNAL_PLATFORM_OWNER'}];
function store(initial, opts={}) {
 let state=copy({tickets:initial.tickets??[],recipients:initial.recipients??contacts,audits:[],outbox:[]});
 let pending=Promise.resolve();
 const findDue=(s,{where,orderBy,take})=>s.tickets.filter(t=>
  where.status.in.includes(t.status) && t.slaDueAt<=where.slaDueAt.lte && t.escalatedAt===null
 ).sort((a,b)=>a.slaDueAt-b.slaDueAt||a.id.localeCompare(b.id)).slice(0,take).map(copy);
 const scoped=s=>({
   supportTicket:{
    findMany:async args=>findDue(s,args),
    updateMany:async ({where,data})=>{
      if(opts.forceStale)return {count:0};
      const item=s.tickets.find(t=>t.id===where.id);
      if(!item||item.escalatedAt!==null||item.slaDueAt>where.slaDueAt.lte||item.status!==where.status||
          item.assigneeInternalUserId!==where.assigneeInternalUserId||item.updatedAt.getTime()!==where.updatedAt.getTime())return {count:0};
      if(opts.failTicket)throw Error('injected ticket failure');
      Object.assign(item,copy(data));item.updatedAt=new Date(item.updatedAt.getTime()+1);
      return {count:1};
    },
   },
   internalUser:{findMany:async()=>copy(s.recipients)},
   auditEvent:{create:async ({data})=>{if(opts.failAudit)throw Error('injected audit failure');s.audits.push(copy(data));return data}},
   outboxEvent:{create:async ({data})=>{if(opts.failOutbox)throw Error('injected outbox failure');s.outbox.push(copy(data));return data}},
 });
 const db=scoped(state);
 db.$transaction=async fn=>{
   let unlock;const previous=pending;pending=new Promise(resolve=>unlock=resolve);await previous;
   try{const draft=copy(state);const result=await fn(scoped(draft));Object.assign(state,draft);return result;}finally{unlock()}
 };
 return {get:()=>copy(state),service:new SupportService(db,{record:async()=>{throw Error('Non transactional audit forbidden')}})};
}

test('S4 escalates an overdue OPEN unassigned ticket, audit and outbox in one transaction',async()=>{
 const m=store({tickets:[ticket('open')]});assert.equal((await m.service.processSlaEscalations()).escalated,1);
 const s=m.get();assert.equal(s.tickets[0].status,'ESCALATED');assert.ok(s.tickets[0].escalatedAt instanceof Date);
 assert.equal(s.audits.length,1);assert.equal(s.outbox.length,3);assert.equal(s.outbox[0].type,'SEND_EMAIL');
 assert.equal(s.outbox[0].payload.ticketId,'open');assert.equal(s.outbox[0].payload.organizationId,'org');
 assert.equal(s.outbox[0].payload.locale,'es');assert.equal(s.audits[0].action,'SUPPORT_TICKET_SLA_ESCALATED');
});
test('S4 escalates assigned ticket without unassigning or replacing state',async()=>{
 const m=store({tickets:[ticket('assigned','IN_PROGRESS','agent-1')]});await m.service.processSlaEscalations();
 const t=m.get().tickets[0];assert.equal(t.assigneeInternalUserId,'agent-1');assert.equal(t.status,'IN_PROGRESS');
 assert.equal(m.get().audits[0].metadata.assigned,true);
});
test('S4 preserves WAITING and ASSIGNED status for assigned overdue tickets',async()=>{
 const m=store({tickets:[ticket('waiting','WAITING','agent-2'),ticket('assigned','ASSIGNED','agent-3')]});
 assert.equal((await m.service.processSlaEscalations()).escalated,2);
 assert.deepEqual(m.get().tickets.map(x=>x.status),['WAITING','ASSIGNED']);
 assert.equal(m.get().outbox.length,6);
});
test('S4 does not escalate resolved, closed or future tickets',async()=>{
 const m=store({tickets:[ticket('resolved','RESOLVED'),ticket('closed','CLOSED'),ticket('future','OPEN',null,{slaDueAt:time(future)})]});
 assert.equal((await m.service.processSlaEscalations()).escalated,0);
 assert.equal(m.get().outbox.length,0);assert.equal(m.get().audits.length,0);
});
test('S4 repeat job is idempotent for audit and notifications',async()=>{
 const m=store({tickets:[ticket('once')]});await m.service.processSlaEscalations();
 assert.equal((await m.service.processSlaEscalations()).escalated,0);
 assert.equal(m.get().outbox.length,3);assert.equal(m.get().audits.length,1);
});
test('S4 two parallel checks can claim once only (serialized transactional fake)',async()=>{
 const m=store({tickets:[ticket('parallel')]});const r=await Promise.all([m.service.processSlaEscalations(),m.service.processSlaEscalations()]);
 assert.equal(r[0].escalated+r[1].escalated,1);assert.equal(m.get().outbox.length,3);assert.equal(m.get().audits.length,1);
});
test('S4 stale ticket fails CAS and does not enqueue alerts',async()=>{
 const m=store({tickets:[ticket('race')]},{forceStale:true});assert.equal((await m.service.processSlaEscalations()).escalated,0);
 assert.equal(m.get().outbox.length,0);assert.equal(m.get().audits.length,0);
 assert.equal(m.get().tickets[0].escalatedAt,null);
});
test('S4 audit insertion failure rolls back both ticket and emails',async()=>{
 const m=store({tickets:[ticket('audit')]},{failAudit:true});
 await assert.rejects(m.service.processSlaEscalations(),/injected audit failure/);
 assert.equal(m.get().tickets[0].escalatedAt,null);assert.equal(m.get().tickets[0].status,'OPEN');
 assert.equal(m.get().outbox.length,0);assert.equal(m.get().audits.length,0);
});
test('S4 outbox failure rolls back both ticket and audit',async()=>{
 const m=store({tickets:[ticket('email')]},{failOutbox:true});
 await assert.rejects(m.service.processSlaEscalations(),/injected outbox failure/);
 assert.equal(m.get().tickets[0].escalatedAt,null);assert.equal(m.get().tickets[0].status,'OPEN');
 assert.equal(m.get().outbox.length,0);assert.equal(m.get().audits.length,0);
});
test('S4 without active recipients fails visibly and retries next cycle',async()=>{
 const m=store({tickets:[ticket('nobody')],recipients:[]});
 await assert.rejects(m.service.processSlaEscalations(),/SUPPORT_SLA_NO_RECIPIENTS/);
 assert.equal(m.get().tickets[0].escalatedAt,null);assert.equal(m.get().audits.length,0);
});
test('S4 normalizes and deduplicates internal addresses by case',async()=>{
 const m=store({tickets:[ticket('dedup')],recipients:[...contacts,{email:'SUPORTE@none.test',role:'INTERNAL_SUPPORT'},{email:' Owner@Proofline.test ',role:'INTERNAL_SUPPORT'}]});
 await m.service.processSlaEscalations();const outbox=m.get().outbox;
 assert.equal(outbox.length,4);assert.equal(outbox.filter(e=>e.payload.to.toLowerCase()==='owner@proofline.test').length,1);
});
test('S4 uses existing template categories and English notification when locale=en',async()=>{
 const m=store({tickets:[ticket('english','OPEN',null,{organization:{name:'Acme',defaultLocale:'en'}})]});
 await m.service.processSlaEscalations();const e=m.get().outbox;
 assert.equal(e.length,3);assert.match(e[0].payload.text,/has exceeded its SLA/);assert.equal(e[0].payload.locale,'en');
 assert.ok(e.some(j=>j.payload.category==='support_sla_owner'));
 assert.ok(e.some(j=>j.payload.category==='support_sla_escalation'));
});
test('S4 handles legacy ESCALATED ticket missing escalation marker without changing status',async()=>{
 const m=store({tickets:[ticket('legacy','ESCALATED',null)]});
 await m.service.processSlaEscalations();assert.equal(m.get().tickets[0].status,'ESCALATED');assert.ok(m.get().tickets[0].escalatedAt);
});
test('S4 batch bounded at 100 tickets, remaining work can be drained in later cycles',async()=>{
 const items=Array.from({length:101},(_,i)=>ticket(String(i).padStart(3,'0')));
 const m=store({tickets:items,recipients:[contacts[0]]});
 assert.equal((await m.service.processSlaEscalations()).escalated,100);
 assert.equal((await m.service.processSlaEscalations()).escalated,1);
 assert.equal(m.get().audits.length,101);assert.equal(m.get().outbox.length,101);
});
test('S4 does not mutate other services, schema or UI and uses CAS for SLA',()=>{
 const m=source.split('async processSlaEscalations()')[1];
 assert.match(m,/supportTicket\.updateMany\(/);assert.match(m,/assigneeInternalUserId: ticket.assigneeInternalUserId/);
 assert.match(m,/updatedAt: ticket.updatedAt/);assert.match(m,/auditEvent\.create/);
 assert.match(m,/outboxEvent\.create/);assert.doesNotMatch(m,/this\.audit\.record\(/);
});
