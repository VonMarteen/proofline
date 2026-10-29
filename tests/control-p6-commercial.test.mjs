import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {salesFilters,canChangeCommercialStage,requiresLossReason,commercialPaymentEvidence,canProvisionPaid,validatePlanClone} from '../apps/api/src/commercial/p6-policy.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('P6 filters whitelist status and mode and bound search fields',()=>{
 assert.deepEqual(salesFilters({q:'  Example  ',stage:'WON',mode:'START',planCode:'TEAM'}),{q:'Example',stage:'WON',mode:'START',planCode:'TEAM'});
 assert.equal(salesFilters({stage:'INJECT',mode:'GHOST',q:'x'.repeat(1000)}).stage,undefined);
 assert.equal(salesFilters({q:'x'.repeat(1000)}).q.length,120);
});
test('P6 forbids manually reaching PROVISIONED or entering an unevaluated trial',()=>{
 assert.equal(canChangeCommercialStage('WON','PROVISIONED',false),false);
 assert.equal(canChangeCommercialStage('NEW','EVALUATION',false),false);
 assert.equal(canChangeCommercialStage('EVALUATION','EVALUATION',true),true);
 assert.equal(canChangeCommercialStage('EVALUATION','WON',true),true);
 assert.equal(canChangeCommercialStage('PROVISIONED','WON',true),false);
 assert.equal(canChangeCommercialStage('LOST','NEW',false),false);
 assert.equal(canChangeCommercialStage('NEW','INVALID',false),false);
});
test('P6 requires meaningful reason for loss',()=>{
 assert.equal(requiresLossReason('LOST'),true);
 assert.equal(requiresLossReason('LOST',' budget issue '),false);
 assert.equal(requiresLossReason('NEW',''),false);
 assert.equal(requiresLossReason('LOST','  no  '),true);
});
test('P6 no manually verified Redsys or PayPal without adapter',()=>{
 assert.equal(commercialPaymentEvidence('REDSYS','VERIFIED','ref'),false);
 assert.equal(commercialPaymentEvidence('PAYPAL','VERIFIED','ref'),false);
 assert.equal(commercialPaymentEvidence('BANK_TRANSFER','VERIFIED'),false);
 assert.equal(commercialPaymentEvidence('BANK_TRANSFER','VERIFIED','bank-2026'),true);
 assert.equal(commercialPaymentEvidence('PAYPAL','READY'),true);
});
test('P6 no paid activation from an offline provider, upfront transfer or unqualified lead',()=>{
 for(const provider of ['PAYPAL','REDSYS'])assert.equal(canProvisionPaid('WON',provider,'READY',30),false);
 for(const terms of [0,null,7,90])assert.equal(canProvisionPaid('WON','BANK_TRANSFER','READY',terms),false);
 for(const terms of [15,30,60])assert.equal(canProvisionPaid('WON','BANK_TRANSFER','READY',terms),true);
 assert.equal(canProvisionPaid('QUALIFIED','BANK_TRANSFER','READY',30),false);
});
test('P6 cloned commercial plan codes and prices are constrained',()=>{
 assert.deepEqual(validatePlanClone({code:' growth_2027 ',name:' Growth Plus ',monthlyAmountCents:9900}),{code:'GROWTH_2027',name:'Growth Plus',monthlyAmountCents:9900});
 for(const code of ['a','DROP TABLE','_HACK'])assert.throws(()=>validatePlanClone({code,name:'Valid',monthlyAmountCents:100}));
 for(const amount of [-1,10.5,Infinity,10_000_001])assert.throws(()=>validatePlanClone({code:'PLAN_A',name:'Valid',monthlyAmountCents:amount}));
});
test('P6 commercial API pages are bounded, decrypt after DB pagination and require sales.read',()=>{
 const api=read('apps/api/src/commercial/commercial.service.ts');
 const chunk=api.split('async page(req:HeaderRequest')[1].split('async availablePlans')[0];
 assert.match(chunk,/requireInternalCapability\(req,"sales\.read"\)/);
 assert.match(chunk,/clampedPagination\(total,input\)/);
 assert.match(chunk,/findMany\(\{where,skip:pg\.skip,take:pg\.take/);
 assert.ok(chunk.indexOf('findMany({where,skip')<chunk.indexOf('decryptText(r.emailEncrypted)'));
 assert.match(chunk,/emailLookup:undefined/);
});
test('P6 stage and plan writes keep audit in same Prisma transaction',()=>{
 const s=read('apps/api/src/commercial/commercial.service.ts');
 for(const segment of [s.split('async updateStage(')[1].split('private async uniqueSlug(')[0],s.split('async setPlan(')[1].split('async clonePlan(')[0],s.split('async clonePlan(')[1].split('async updateStage(')[0]]){
  assert.match(segment,/\$transaction\(async tx/);
  assert.match(segment,/await tx\.auditEvent\.create/);
 }
 assert.match(s,/Select an explicit contract plan before paid provisioning/);
 assert.match(s,/Cannot create evaluation after opportunity is closed/);
});
test('P6 API exposes authorized routes without raw payment credentials',()=>{
 const controller=read('apps/api/src/commercial/commercial.controller.ts');
 const ctrl=read('apps/api/src/control/control.controller.ts');
 const payment=read('apps/api/src/payments/payment.service.ts');
 for(const path of ['@Get("page")','@Get("plans")','@Post(":id/plan")'])assert.ok(controller.includes(path));
 assert.match(ctrl,/@Post\("plans\/clone"\)/);
 assert.match(payment,/VERIFIED requires a documented bank transfer reference/);
});
test('P6 UI uses pagination, server-side filters, RBAC and real activation guards',()=>{
 const sales=read('apps/control/app/[locale]/sales/page.tsx');
 const plans=read('apps/control/app/[locale]/plans/page.tsx');
 const subs=read('apps/control/app/[locale]/subscriptions/page.tsx');
 assert.ok(sales.includes('PaginationBar'));
 assert.ok(sales.includes('/v1/control/sales/page?'));
 assert.ok(sales.includes('controlIdentity()'));
 assert.ok(sales.includes('contractReady(x)'));
 assert.ok(sales.includes('data-confirm-title'));
 assert.ok(plans.includes('cloneCommercialPlan'));
 assert.ok(plans.includes('controlIdentity()'));
 assert.ok(subs.includes('planCode'));
 assert.ok(subs.includes('s.plan.currency'));
});
test('P6 legacy critical-runtime sales list endpoint remains available',()=>{
 const service=read('apps/api/src/commercial/commercial.service.ts');
 const controller=read('apps/api/src/commercial/commercial.controller.ts');
 assert.match(service,/async list\(req:HeaderRequest\)/);
 assert.match(controller,/@Get\(\)list\(@Req\(\)req:HeaderRequest\)/);
});
