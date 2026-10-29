import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const exception=name=>class extends Error {constructor(message){super(typeof message==='string'?message:JSON.stringify(message));this.name=name;}};
const err={BadRequestException:exception('BadRequestException'),ConflictException:exception('ConflictException'),ForbiddenException:exception('ForbiddenException'),NotFoundException:exception('NotFoundException')};
const scope={organization:{id:'org-s6b'},user:{id:'user-s6b',email:'owner@example.test',locale:'es'},capabilities:['support.use','account.change.request']};
const deps={
 'node:crypto':require('node:crypto'),
 '@nestjs/common':{...err,Inject:()=>()=>{},Injectable:()=>x=>x},
 '../database/prisma.service.js':{PrismaService:class{}},
 '../audit/audit.service.js':{AuditService:class{}},
 '../auth/access-control.js':{requireCapability:async(_db,_req,cap)=>{assert.ok(scope.capabilities.includes(cap));return scope;}},
 '../control/internal-access.js':{requireInternalCapability:()=>{throw Error('Unexpected internal call');}},
 '../common/pagination.js':{parsePagination:()=>({}),paged:()=>({}),clampedPagination:()=>({})},
 '../control/p4-filters.js':{supportFilters:()=>({})},
 './workspace-support-visibility.js':{canReadAccountChanges:()=>true,workspaceSupportTicketScope:()=>({organizationId:scope.organization.id})},
 './support-s3-invariants.js':{canTransitionAccountChange:()=>true,canTransitionSupportTicket:()=>true},
};
const source=fs.readFileSync(new URL('../apps/api/src/support/support.service.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{fileName:'support.service.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const module={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{Buffer,process,Date,console,Set,Map,fetch,AbortSignal},{filename:'support.service.cjs'})(key=>{if(!(key in deps))throw Error('Unexpected import: '+key);return deps[key];},module,module.exports);
const SupportService=module.exports.SupportService;
const clone=structuredClone;
const fixtureTicket={id:'ticket-1',status:'WAITING',updatedAt:new Date('2026-10-28T09:00:00Z'),lastCustomerReplyAt:new Date('2026-10-28T08:00:00Z'),lastInternalReplyAt:new Date('2026-10-28T08:10:00Z')};
const fixtureRequest={id:'request-1',ticketId:'ticket-1',maxFileSizeBytes:5242880,attachment:null,ticket:clone(fixtureTicket)};
const changeInput={type:'LEGAL_NAME',summary:'Cambio de razón social',requestedData:{name:'Acme Europa SL'}};
function harness(options={}){
 let state={tickets:[],changes:[],messages:[],audits:[],documents:[],attachments:[],requests:[],updatedTickets:[],nextId:1};
 const seen={transactionOptions:[],updates:[],transactionCount:0};
 let inside=false;
 const client=(draft,tx=false)=>({
   accountChangeRequest:{
     findFirst:async()=>tx&&options.existingInside?options.existingInside:null,
     create:async({data})=>{const value={...clone(data),id:'change-'+draft.nextId++};draft.changes.push(value);return value;},
   },
   supportTicket:{
     findMany:async()=>[],count:async()=>0,
     findFirst:async()=>clone(fixtureTicket),
     create:async({data})=>{const value={...clone(data),id:'ticket-'+draft.nextId++};draft.tickets.push(value);return value;},
     updateMany:async({where,data})=>{
       seen.updates.push({where:clone(where),data:clone(data)});
       if(options.staleTicket)return{count:0};
       draft.updatedTickets.push({where:clone(where),data:clone(data)});
       return{count:1};
     },
   },
   supportDocumentRequest:{
     findFirst:async()=>clone(fixtureRequest),
     updateMany:async({where,data})=>{
       seen.updates.push({where:clone(where),data:clone(data)});
       if(options.fulfilledRequest)return{count:0};
       draft.requests.push({where:clone(where),data:clone(data)});return{count:1};
     },
   },
   documentRecord:{create:async({data})=>{const value={...clone(data),id:'record-'+draft.nextId++};draft.documents.push(value);return value;}},
   supportMessage:{create:async({data})=>{const value={...clone(data),id:'message-'+draft.nextId++};draft.messages.push(value);return value;}},
   supportAttachment:{create:async({data})=>{const value={...clone(data),id:'attachment-'+draft.nextId++};draft.attachments.push(value);return value;}},
   auditEvent:{create:async({data})=>{if(options.failAudit)throw Error('AUDIT_FAIL');draft.audits.push(clone(data));return data;}},
 });
 const db=client(state);
 db.$transaction=async(callback,optionsTx)=>{
   seen.transactionOptions.push(optionsTx??null);seen.transactionCount++;
   if(options.prismaConcurrentError){const e=Error('concurrent');e.code='P2034';throw e;}
   if(inside)throw Error('overlapping transaction in harness');inside=true;
   const draft=clone(state);
   try{const result=await callback(client(draft,true));state=draft;return result;}
   finally{inside=false;}
 };
 const service=new SupportService(db,{record:async()=>{throw Error('non-transactional audit called unexpectedly');}});
 return{service,seen,get:()=>clone(state)};
}
const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]);
const uploadInput={requestId:'request-1',fileName:'documento.png',mimeType:'image/png',base64:png.toString('base64')};
test('S6B contractual intake uses Serializable and repeats duplicate lookup inside transaction',async()=>{
 const h=harness();const result=await h.service.requestAccountChange({},changeInput);
 assert.equal(h.seen.transactionOptions[0].isolationLevel,'Serializable');
 assert.equal(h.get().changes.length,1);assert.equal(h.get().audits.length,1);assert.equal(result.ticketId,h.get().tickets[0].id);
});
test('S6B contractual intake detects duplicate found only after preflight',async()=>{
 const h=harness({existingInside:{supportTicketId:'ticket-old',supportTicket:{subject:'cambio',status:'WAITING',slaDueAt:new Date(Date.now()+3600000)}}});
 await assert.rejects(h.service.requestAccountChange({},changeInput),/SUPPORT_DUPLICATE/);
 assert.equal(h.get().tickets.length,0);assert.equal(h.get().changes.length,0);
});
test('S6B PostgreSQL serialization conflict becomes actionable 409',async()=>{
 const h=harness({prismaConcurrentError:true});await assert.rejects(h.service.requestAccountChange({},changeInput),error=>error.name==='ConflictException'&&/SUPPORT_CONCURRENT_REQUEST/.test(error.message));
});
test('S6B customer reply claims the current ticket version before writing',async()=>{
 const h=harness();await h.service.addWorkspaceMessage({},'ticket-1','Respuesta del cliente');
 assert.equal(h.get().messages.length,1);assert.equal(h.get().audits.length,1);
 assert.equal(h.get().updatedTickets[0].where.status,'WAITING');
 assert.ok(h.get().updatedTickets[0].where.updatedAt instanceof Date);
});
test('S6B customer reply rejects stale ticket without messages or audit',async()=>{
 const h=harness({staleTicket:true});await assert.rejects(h.service.addWorkspaceMessage({},'ticket-1','Respuesta'),/Ticket changed concurrently/);
 assert.deepEqual(h.get().messages,[]);assert.deepEqual(h.get().audits,[]);
});
test('S6B customer reply fully rolls back when audit insert fails',async()=>{
 const h=harness({failAudit:true});await assert.rejects(h.service.addWorkspaceMessage({},'ticket-1','Respuesta'),/AUDIT_FAIL/);
 assert.equal(h.get().messages.length,0);assert.equal(h.get().updatedTickets.length,0);
});
test('S6B upload atomically stores record, attachment, message and audit',async()=>{
 const h=harness();const result=await h.service.uploadWorkspaceDocument({},'ticket-1',uploadInput);
 assert.equal(h.get().documents.length,1);assert.equal(h.get().messages.length,1);assert.equal(h.get().attachments.length,1);
 assert.equal(h.get().audits.length,1);assert.equal(h.get().requests.length,1);
 assert.equal(h.get().audits[0].metadata.attachmentId,result.attachmentId);
});
test('S6B upload rolls back bytes and request state if audit fails',async()=>{
 const h=harness({failAudit:true});await assert.rejects(h.service.uploadWorkspaceDocument({},'ticket-1',uploadInput),/AUDIT_FAIL/);
 assert.deepEqual(h.get().documents,[]);assert.deepEqual(h.get().requests,[]);assert.deepEqual(h.get().attachments,[]);
});
test('S6B upload rejects already claimed request before storing bytes',async()=>{
 const h=harness({fulfilledRequest:true});await assert.rejects(h.service.uploadWorkspaceDocument({},'ticket-1',uploadInput),/already fulfilled/);
 assert.deepEqual(h.get().documents,[]);assert.deepEqual(h.get().messages,[]);
});
test('S6B upload refuses concurrently changed ticket and rolls back request claim',async()=>{
 const h=harness({staleTicket:true});await assert.rejects(h.service.uploadWorkspaceDocument({},'ticket-1',uploadInput),/Ticket changed concurrently/);
 assert.deepEqual(h.get().requests,[]);assert.deepEqual(h.get().documents,[]);
});
test('S6B does not change any UI source or schema',()=>{
 assert.match(source,/workspaceSupportTicketScope\(ctx\)/);assert.match(source,/SUPPORT_DOCUMENT_UPLOADED/);
});
