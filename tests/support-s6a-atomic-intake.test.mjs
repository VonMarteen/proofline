import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const exception = name => class extends Error { constructor(message) {super(typeof message==='string'?message:JSON.stringify(message));this.name=name;} };
const err = {BadRequestException:exception('BadRequestException'),ConflictException:exception('ConflictException'),ForbiddenException:exception('ForbiddenException'),NotFoundException:exception('NotFoundException')};
const scope={organization:{id:'org-1'},user:{id:'user-1',email:'owner@example.test',locale:'es'},capabilities:['support.use','account.change.request']};
const deps={
 'node:crypto': require('node:crypto'),
 '@nestjs/common': {...err,Inject:()=>()=>{},Injectable:()=>x=>x},
 '../database/prisma.service.js':{PrismaService:class{}},
 '../audit/audit.service.js':{AuditService:class{}},
 '../auth/access-control.js':{requireCapability:async (_db,_req,cap)=>{if(!scope.capabilities.includes(cap))throw Error('Unexpected capability');return scope;}},
 '../control/internal-access.js':{requireInternalCapability:()=>{throw Error('not used');}},
 '../common/pagination.js':{parsePagination:()=>({}),paged:()=>({}),clampedPagination:()=>({})},
 '../control/p4-filters.js':{supportFilters:()=>({})},
 './workspace-support-visibility.js':{canReadAccountChanges:()=>true,workspaceSupportTicketScope:()=>({organizationId:'org-1'})},
 './support-s3-invariants.js':{canTransitionAccountChange:()=>true,canTransitionSupportTicket:()=>true},
};
const source=fs.readFileSync(new URL('../apps/api/src/support/support.service.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{fileName:'support.service.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const module={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{Buffer,process,Date,console,Set,Map,fetch,AbortSignal},{filename:'support.service.cjs'})(k=>{if(!(k in deps))throw Error('Unexpected import: '+k);return deps[k];},module,module.exports);
const SupportService=module.exports.SupportService;
const copy=structuredClone;
function mock(opts={}){
 let state={tickets:[],changes:[],audits:[],nextId:1};
 const client=(draft)=>({
  supportTicket:{
   findMany:async()=>[],count:async()=>0,
   create:async({data})=>{const ticket={id:'ticket-'+draft.nextId++,slaDueAt:data.slaDueAt,...copy(data)};draft.tickets.push(ticket);return copy(ticket);},
  },
  accountChangeRequest:{
   findFirst:async()=>null,
   create:async({data})=>{if(opts.failChange)throw Error('injected account change failure');const change={id:'change-'+draft.nextId++,...copy(data)};draft.changes.push(change);return copy(change);},
  },
  auditEvent:{create:async({data})=>{if(opts.failAudit)throw Error('injected audit failure');draft.audits.push(copy(data));return copy(data);}},
 });
 const db=client(state);
 db.$transaction=async callback=>{const draft=copy(state);const result=await callback(client(draft));state=draft;return result;};
 const service=new SupportService(db,{record:async()=>{throw Error('Non-transactional audit must not be called')}});
 return {service,get:()=>copy(state)};
}
const input={subject:'Problema en la facturación',description:'No encuentro las facturas del mes pasado.',category:'BILLING',priority:'NORMAL'};
const change={type:'LEGAL_NAME',summary:'Solicito actualizar la razón social',requestedData:{requestedValue:'Acme Europa SL'}};
test('S6A ticket creation atomically saves customer message and audit',async()=>{
 const m=mock();const ticket=await m.service.createWorkspaceTicket({},input);
 assert.equal(m.get().tickets.length,1);assert.equal(m.get().audits.length,1);
 assert.equal(m.get().audits[0].targetId,ticket.id);
 assert.equal(ticket.messages.create.visibility,'CUSTOMER');
});
test('S6A ticket creation rolls back if audit write fails',async()=>{
 const m=mock({failAudit:true});await assert.rejects(m.service.createWorkspaceTicket({},input),/injected audit failure/);
 assert.equal(m.get().tickets.length,0);assert.equal(m.get().audits.length,0);
});
test('S6A contractual intake atomically links ticket, change and audit',async()=>{
 const m=mock();const result=await m.service.requestAccountChange({},change);
 assert.equal(m.get().tickets.length,1);assert.equal(m.get().changes.length,1);assert.equal(m.get().audits.length,1);
 assert.equal(result.ticketId,m.get().changes[0].supportTicketId);
 assert.equal(result.id,m.get().audits[0].targetId);
});
test('S6A contractual intake rolls back if change record fails',async()=>{
 const m=mock({failChange:true});await assert.rejects(m.service.requestAccountChange({},change),/injected account change failure/);
 assert.deepEqual(m.get().tickets,[]);assert.deepEqual(m.get().changes,[]);assert.deepEqual(m.get().audits,[]);
});
test('S6A contractual intake rolls back if audit fails',async()=>{
 const m=mock({failAudit:true});await assert.rejects(m.service.requestAccountChange({},change),/injected audit failure/);
 assert.deepEqual(m.get().tickets,[]);assert.deepEqual(m.get().changes,[]);assert.deepEqual(m.get().audits,[]);
});
test('S6A preserves customer categories and account-change permission boundary',()=>{
 assert.match(source,/requireCapability\(this\.db, req, "support\.use"\)/);
 assert.match(source,/requireCapability\(this\.db, req, "account\.change\.request"\)/);
 assert.match(source,/category: "ACCOUNT_CHANGE"/);
});
