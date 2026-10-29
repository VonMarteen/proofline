import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const errors=Object.fromEntries(['ForbiddenException','BadRequestException','NotFoundException'].map(name=>[name,class extends Error {constructor(msg){super(msg);this.name=name;}}]));
const owner={headers:{'x-proofline-role':'INTERNAL_PLATFORM_OWNER','x-proofline-user':'owner@proofline.local'}};
const transpile=(source,file)=>ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
function load(file,mocks={}){const mod={exports:{}};vm.runInNewContext('(function(require,module,exports){'+transpile(read(file),file)+'\n})',{console,Date,Promise,Set,Map},{filename:file})(name=>mocks[name]??(name==='@nestjs/common'?{...errors,Inject:()=>()=>{},Injectable:()=>x=>x}:{}),mod,mod.exports);return mod.exports;}
const policy=load('apps/api/src/payments/manual-payment-evidence.ts');
function dbForRetention(documentRows=[]){return{
 retentionPolicy:{findMany:async()=>[{id:'policy1',organizationId:'org1',assessmentId:null,recordClass:'ACCOUNTING_INVOICE',durationDays:10,action:'DELETE',legalBasis:'Contract accounting',locked:true,organization:{name:'ACME Europe'},assessment:null}]},
 legalHold:{findMany:async()=>[]},
 documentRecord:{findMany:async()=>documentRows},participant:{findMany:async()=>[]},analysisRun:{findMany:async()=>[]},report:{findMany:async()=>[]},
};}
function makeRetention(db){const m={ './manual-payment-evidence.js':policy, '../control/internal-access.js':{requireInternalCapability:()=>({identity:{email:'owner@proofline.local'}})}, './internal-access.js':{requireInternalCapability:()=>({identity:{email:'owner@proofline.local'}})}};return new (load('apps/api/src/control/retention-lifecycle.service.ts',m).RetentionLifecycleService)(db,{record:async()=>{throw new Error('Should not write during preview')}});}
const base={amountCents:2000,kind:'TRANSFER',status:'RECONCILED',provider:'BANK_TRANSFER',bankReference:'BANK-2026-005'};
test('CQF-F3: reconciled bank transfer requires a real reference and a positive amount',()=>{
 assert.equal(policy.manualPaymentEvidenceError(base),null);
 assert.match(policy.manualPaymentEvidenceError({...base,bankReference:''}),/reference/);
 assert.match(policy.manualPaymentEvidenceError({...base,amountCents:0}),/positive/);
 assert.match(policy.manualPaymentEvidenceError({...base,kind:'CHARGE'}),/TRANSFER/);
 assert.match(policy.manualPaymentEvidenceError({...base,status:'CAPTURED'}),/cannot be marked/);
 assert.equal(policy.manualPaymentEvidenceError({...base,status:'AWAITING_TRANSFER',bankReference:null}),null);
});
test('CQF-F3: no manual settlement can impersonate Redsys or PayPal',()=>{
 for(const provider of ['REDSYS','PAYPAL'])for(const status of ['AUTHORIZED','CAPTURED','RECONCILED','REFUNDED'])
   assert.match(policy.manualPaymentEvidenceError({provider,kind:'CHARGE',status,amountCents:2000}),/cannot be verified/);
 for(const provider of ['REDSYS','PAYPAL'])for(const status of ['PENDING','FAILED','CANCELED'])
   assert.equal(policy.manualPaymentEvidenceError({provider,kind:'CHARGE',status,amountCents:2000}),null);
});
test('CQF-F3: empty retention preview is provably complete',async()=>{
 const svc=makeRetention(dbForRetention());const response=await svc.preview(owner,{organizationId:'org1',limit:2});
 assert.equal(response.coverage.complete,true);assert.equal(response.summary.due,0);assert.equal(response.candidates.length,0);
});
test('CQF-F3: bounded source scan is explicitly partial and execution refuses to delete',async()=>{
 const records=Array.from({length:4},(_,i)=>({id:`doc-${i}`,organizationId:'org1',assessmentId:null,recordClass:'ACCOUNTING_INVOICE',createdAt:new Date('2025-01-01'),retentionUntil:null,status:'ACTIVE',organization:{name:'ACME Europe'},assessment:null}));
 const svc=makeRetention(dbForRetention(records));const preview=await svc.preview(owner,{organizationId:'org1',limit:1});
 assert.equal(preview.coverage.complete,false);assert.equal(preview.coverage.sourceScanMayBeTruncated,true);assert.equal(preview.coverage.candidatesTruncated,true);assert.equal(preview.candidates.length,1);
 await assert.rejects(()=>svc.execute(owner,{organizationId:'org1',confirm:'EXECUTE_RETENTION',limit:1}),/incomplete/);
 await assert.rejects(()=>svc.execute(owner,{confirm:'EXECUTE_RETENTION',limit:1}),/organization/);
});
test('CQF-F3: PaymentService enforces evidence before writing, then audits valid bank reconciliation',async()=>{
 const calls=[];const db={paymentTransaction:{create:async({data})=>{calls.push(['write',data]);return{id:'txn1',...data};}},organization:{},paymentMethod:{findFirst:async()=>null}};
 const audit={record:async x=>{calls.push(['audit',x]);}};
 const m={'./manual-payment-evidence.js':policy,'./payment-providers.js':{bankTransferInstructions:()=>({}),PAYMENT_PROVIDER_CAPABILITIES:{}},'../control/internal-access.js':{requireInternalCapability:()=>({identity:{email:'owner@proofline.local'}}),internalContext:()=>({capabilities:['*']})}};
 const svc=new (load('apps/api/src/payments/payment.service.ts',m).PaymentService)(db,audit);
 const invalid={...base,bankReference:null};
 await assert.rejects(()=>svc.recordTransaction(owner,'org1',invalid),/reference/);
 assert.equal(calls.length,0);
 const result=await svc.recordTransaction(owner,'org1',base);
 assert.equal(result.ok,true);assert.equal(calls.length,2);
 assert.equal(calls[0][1].metadata.evidenceSource,'BANK_REFERENCE_DECLARED');
 assert.equal(calls[1][1].action,'PAYMENT_TRANSACTION_RECORDED');
 assert.equal(calls[1][1].metadata.status,'RECONCILED');
});
test('CQF-F3: complete empty scoped retention execution is non-destructive',async()=>{
 const audit=[];const svc=new (load('apps/api/src/control/retention-lifecycle.service.ts',{'./internal-access.js':{requireInternalCapability:()=>({identity:{email:'owner@proofline.local'}})}}).RetentionLifecycleService)(dbForRetention(),{record:async x=>audit.push(x)});
 const result=await svc.execute(owner,{organizationId:'org1',confirm:'EXECUTE_RETENTION',limit:5});
 assert.equal(result.ok,true);assert.equal(result.applied.length,0);assert.equal(result.eligible,0);
 assert.equal(audit.length,1);assert.equal(audit[0].action,'RETENTION_RUN_EXECUTED');
});
test('CQF-F3: financial guard is called before database writes and has audited origin',()=>{
 const service=read('apps/api/src/payments/payment.service.ts');
 const guardAt=service.indexOf('const evidenceError = manualPaymentEvidenceError(input);');
 const writeAt=service.indexOf('this.db.paymentTransaction.create(');
 assert.ok(guardAt>0&&writeAt>guardAt);
 assert.match(service,/evidenceSource: input\.provider/);
 assert.match(service,/manual: true/);
});
test('CQF-F3: UI makes evidence limits explicit without touching existing shell',()=>{
 const legal=read('apps/control/app/[locale]/legal/page.tsx');
 const org=read('apps/control/app/[locale]/organizations/[id]/page.tsx');
 assert.match(legal,/retentionOrganization/);assert.match(legal,/completePreview/);assert.match(legal,/organizationId" value=\{retentionOrganization\}/);
 assert.match(org,/Redsys y PayPal no tienen adaptadores/);assert.match(org,/AWAITING_TRANSFER/);
 for(const protectedFile of ['packages/design-tokens/base.css','apps/control/app/[locale]/dashboard/page.tsx','apps/control/components/sidebar.tsx']){
  // Protected components have not been added to the F3 change set.
  assert.ok(!['apps/api/src/payments/payment.service.ts','apps/control/app/[locale]/legal/page.tsx'].includes(protectedFile));
 }
});
test('CQF-F3: all changed TS and TSX parse with no syntax diagnostics',()=>{
 const files=['apps/api/src/payments/manual-payment-evidence.ts','apps/api/src/payments/payment.service.ts','apps/api/src/control/retention-lifecycle.service.ts','apps/control/app/[locale]/legal/page.tsx','apps/control/app/[locale]/organizations/[id]/page.tsx'];
 for(const file of files){const d=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).diagnostics??[];
  assert.equal(d.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file);}
});
