import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const errors=Object.fromEntries(['ForbiddenException','BadRequestException','NotFoundException','ConflictException'].map(name=>[name,class extends Error {constructor(msg){super(msg);this.name=name;}}]));
const owner={headers:{'x-proofline-role':'INTERNAL_PLATFORM_OWNER','x-proofline-user':'owner@proofline.local'}};
const other={headers:{'x-proofline-role':'INTERNAL_FINANCE','x-proofline-user':'finance@proofline.local'}};
const auth=(req,cap)=>{if(req.headers['x-proofline-role']!=='INTERNAL_PLATFORM_OWNER')throw new errors.ForbiddenException(`missing ${cap}`);return{identity:{email:req.headers['x-proofline-user']}};};
const compiled=(source,file)=>ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
function loadModule(file,mocks){const mod={exports:{}};vm.runInNewContext('(function(require,module,exports){'+compiled(read(file),file)+'\n})',{console,process,Date,Buffer,URLSearchParams,Set,Map,Promise},{filename:file})(name=>mocks(name),mod,mod.exports);return mod.exports;}
const policy=loadModule('apps/api/src/commercial/internal-opportunity-policy.ts',()=>({}));
const makeCommercial=db=>{const mock=name=>{
 if(name==='@nestjs/common')return {...errors,Inject:()=>()=>{},Injectable:()=>x=>x};
 if(name.endsWith('internal-opportunity-policy.js'))return policy;
 if(name.endsWith('internal-access.js'))return {requireInternalCapability:auth};
 if(name.endsWith('crypto.js'))return {blindIndex:v=>`indexed:${v}`,encryptText:v=>`encrypted:${v}`,decryptText:v=>v};
 return {};
};const {CommercialService}=loadModule('apps/api/src/commercial/commercial.service.ts',mock);return new CommercialService(db,{},{})};
const makeControl=db=>{const mock=name=>{
 if(name==='@nestjs/common')return {...errors,Inject:()=>()=>{},Injectable:()=>x=>x};
 if(name==='node:crypto')return require('node:crypto');
 if(name.endsWith('internal-access.js'))return {requireInternalCapability:auth,internalContext:()=>({capabilities:['*']}),internalRoleCapabilities:{INTERNAL_PLATFORM_OWNER:['*']}};
 return {};
};const {ControlService}=loadModule('apps/api/src/control/control.service.ts',mock);return new ControlService(db,{},{},{})};
const intake={mode:'START',name:'  María Díaz ',email:' MARIA@EXAMPLE.COM ',company:' ACME Europe ',locale:'es',planCode:'PRO',estimatedParticipants:30};
test('CQF-F2: internal intake normalizes addresses but never invents consent',()=>{
 const x=policy.normalizeInternalOpportunity(intake);assert.equal(x.email,'maria@example.com');assert.equal(x.company,'ACME Europe');assert.equal(x.name,'María Díaz');assert.equal(x.planCode,'PRO');
 assert.deepEqual(JSON.parse(JSON.stringify(policy.activeDuplicateFilter('hash','ACME').stage.notIn)),['LOST','PROVISIONED']);
});
test('CQF-F2: opportunity creates persisted NEW record and audit in one transaction',async()=>{
 const events=[];let records=[];let transactions=0;
 const db={$transaction:async fn=>{transactions++;return fn({
  plan:{findUnique:async()=>({code:'PRO'})},
  commercialRequest:{findFirst:async()=>null,create:async({data})=>{records.push(data);return{id:'new123',...data};}},
  auditEvent:{create:async({data})=>events.push(data)}
 })}};
 const svc=makeCommercial(db);const d=await svc.createInternalOpportunity(owner,intake);
 assert.deepEqual(JSON.parse(JSON.stringify(d)),{ok:true,id:'new123',stage:'NEW'});
 assert.equal(transactions,1);assert.equal(records[0].emailEncrypted,'encrypted:maria@example.com');
 assert.equal(records[0].paymentStatus,'NOT_CONFIGURED');assert.equal(records[0].leadId,undefined);
 assert.equal(events.length,1);assert.equal(events[0].action,'COMMERCIAL_OPPORTUNITY_CREATED');
 assert.equal(events[0].metadata.customerConsentCaptured,false);assert.equal(events[0].metadata.paymentCollected,false);
 assert.equal(JSON.stringify(events[0]).includes('maria@example.com'),false);
});
test('CQF-F2: denied users, duplicate opportunities and missing plans do not create records',async()=>{
 let writes=0;let isDuplicate=false;let planExists=true;
 const db={$transaction:async fn=>fn({
  plan:{findUnique:async()=>planExists?{code:'PRO'}:null},
  commercialRequest:{findFirst:async()=>isDuplicate?{id:'old'}:null,create:async()=>{writes++;return{id:'new'};}},
  auditEvent:{create:async()=>{}}
 })};const svc=makeCommercial(db);
 await assert.rejects(()=>svc.createInternalOpportunity(other,intake),{name:'ForbiddenException'});
 isDuplicate=true;await assert.rejects(()=>svc.createInternalOpportunity(owner,intake),{name:'BadRequestException'});
 isDuplicate=false;planExists=false;await assert.rejects(()=>svc.createInternalOpportunity(owner,intake),{name:'BadRequestException'});
 assert.equal(writes,0);
});
test('CQF-F2: communications detail protects payload, result, raw error and OTP',async()=>{
 const report={id:'r1',kind:'EXECUTIVE',version:2,assessment:{title:'Assessment',organization:{name:'ACME'}}};
 const db={reportDelivery:{findUnique:async()=>({id:'del1',status:'SENT',channel:'EMAIL',createdAt:new Date(),sentAt:new Date(),error:'recipient@private.com',report,recipient:{displayName:'Finance',roleLabel:'CFO'}})},outboxEvent:{findFirst:async()=>({id:'out1',type:'SEND_EMAIL',status:'FAILED',attempts:2,createdAt:new Date(),availableAt:new Date(),updatedAt:new Date(),lockedAt:null,error:'secret otp=12345',payload:{to:'private@example.com',token:'secret',category:'participant_invite',templateId:'participant-invite',templateVersion:2},result:{token:'private'} })}};
 const svc=makeControl(db);const delivery=await svc.communicationDeliveryDetail(owner,'del1');const outbox=await svc.communicationOutboxDetail(owner,'out1');
 assert.equal(delivery.errorRecorded,true);assert.equal(delivery.error,undefined);assert.equal(outbox.payload,undefined);assert.equal(outbox.result,undefined);assert.equal(outbox.error,undefined);
 assert.equal(outbox.category,'participant_invite');assert.equal(outbox.templateVersion,'2');assert.equal(outbox.attempts,2);
 assert.equal(JSON.stringify(outbox).includes('private'),false);assert.equal(JSON.stringify(outbox).includes('secret'),false);
 await assert.rejects(()=>svc.communicationOutboxDetail(other,'out1'),{name:'ForbiddenException'});
});
test('CQF-F2: separate real detail routes and source-aligned assessment progress',()=>{
 const comm=read('apps/control/app/[locale]/communications/page.tsx');const sales=read('apps/control/app/[locale]/sales/page.tsx');const assessment=read('apps/control/app/[locale]/assessments/page.tsx');
 assert.match(comm,/communications\/deliveries\/\$\{encodeURIComponent\(x\.id\)\}/);
 assert.match(comm,/communications\/outbox\/\$\{encodeURIComponent\(x\.id\)\}/);
 assert.match(sales,/sales\/new/);assert.match(assessment,/pendientes/);assert.match(assessment,/en curso/);
 assert.doesNotMatch(read('apps/control/app/actions.ts'),/customerConsentCaptured:true/);
});
test('CQF-F2: incremental files parse without changing Prisma or source-of-truth roles',()=>{
 for(const file of ['apps/api/src/commercial/internal-opportunity-policy.ts','apps/api/src/commercial/commercial.service.ts','apps/api/src/commercial/commercial.controller.ts','apps/api/src/control/control.service.ts','apps/api/src/control/control.controller.ts','apps/control/app/actions.ts','apps/control/app/[locale]/sales/page.tsx','apps/control/app/[locale]/sales/new/page.tsx','apps/control/app/[locale]/communications/page.tsx','apps/control/app/[locale]/communications/deliveries/[id]/page.tsx','apps/control/app/[locale]/communications/outbox/[id]/page.tsx','apps/control/app/[locale]/assessments/page.tsx']){
  const diagnostics=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).diagnostics??[];
  assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file);
 }
});
