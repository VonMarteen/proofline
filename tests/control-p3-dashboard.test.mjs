import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../apps/api/src/control/backoffice-metrics.ts',import.meta.url),'utf8');
const result=ts.transpileModule(source,{fileName:'backoffice-metrics.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal((result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const exports={};new Function('exports',result.outputText)(exports);
const {resolveWindow,percentChange,summarizeEurInvoices,buildTimeline,bucketKey}=exports;
const d=(s)=>new Date(`${s}T12:00:00.000Z`);
const inv=(issuedAt,paidAt,status,currency='EUR',amountCents=10000,taxCents=2100)=>({issuedAt:issuedAt?d(issuedAt):null,paidAt:paidAt?d(paidAt):null,status,currency,amountCents,taxCents});

test('P3 date range rejects inverted, malformed, future, and greater-than-year windows',()=>{
 const now=d('2026-10-17');
 for(const [from,to] of [['2026-10-12','2026-10-11'],['2026-02-31','2026-03-01'],['2027-01-01','2027-01-02'],['2025-01-01','2026-10-01']]){
  assert.equal(resolveWindow('7d',from,to,now).range,'7d');
 }
 const custom=resolveWindow('30d','2026-10-01','2026-10-10',now);
 assert.equal(custom.range,'custom');assert.equal(custom.start.toISOString().slice(0,10),'2026-10-01');
 assert.equal(resolveWindow('xyz',undefined,undefined,now).range,'30d');
});

test('P3 comparisons never invent +100% when the prior base is zero',()=>{
 assert.equal(percentChange(250,0),null);assert.equal(percentChange(0,0),0);assert.equal(percentChange(120,100),20);
});

test('P3 paidAt, issuedAt and mixed currencies have distinct totals',()=>{
 const w=resolveWindow('30d','2026-10-05','2026-10-09',d('2026-10-17'));
 const invoices=[
  inv('2026-09-20','2026-10-06','PAID'), // old invoice paid in current window
  inv('2026-10-06','2026-10-20','PAID'), // invoice now but payment outside window
  inv('2026-10-07',null,'PAID'), // excluded from paid-period total
  inv('2026-10-07',null,'OPEN'),
  inv('2026-10-07','2026-10-07','PAID','USD',999999), // excluded completely
  inv('2026-10-08',null,'VOID'),
 ];
 const result=summarizeEurInvoices(invoices,w);
 assert.equal(result.revenueCents,12100);
 assert.equal(result.billedCents,3*12100); // three issued, non-void EUR invoices
 assert.equal(result.nonEurInvoicesExcluded,1);
 assert.equal(result.paidWithoutPaidAtExcluded,1);
 assert.equal(result.currentPaid.length,1);
});

test('P3 timeline contains empty days and assigns payment to actual paid date',()=>{
 const w=resolveWindow('7d','2026-10-01','2026-10-04',d('2026-10-17'));
 const r=summarizeEurInvoices([inv('2026-10-01','2026-10-03','PAID')],w);
 const series=buildTimeline(w,r.currentInvoices,r.currentPaid,[{createdAt:d('2026-10-02')}],[]);
 assert.equal(series.length,4);
 assert.deepEqual(series.map(x=>x.date),['2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
 assert.equal(series[0].billedCents,12100);assert.equal(series[0].revenueCents,0);
 assert.equal(series[2].revenueCents,12100);assert.equal(series[1].customers,1);
 assert.equal(series[3].billedCents,0);
});

test('P3 weekly and monthly bucketing uses stable UTC boundaries',()=>{
 assert.equal(bucketKey(d('2026-10-17'),90),'2026-10-12');
 assert.equal(bucketKey(d('2026-10-17'),365),'2026-10-01');
});

test('P3 service denies finance fields without billing.read and UI respects visibility',()=>{
 const service=readFileSync(new URL('../apps/api/src/control/backoffice.service.ts',import.meta.url),'utf8');
 const business=readFileSync(new URL('../apps/control/app/[locale]/business/page.tsx',import.meta.url),'utf8');
 const overview=readFileSync(new URL('../apps/control/app/[locale]/page.tsx',import.meta.url),'utf8');
 for(const phrase of ['financeVisible?revenueCents:null','financeVisible?billedCents:null','financeVisible?mrrCents:null','financeVisible?arpuCents:null','financeVisible?b.revenueCents:null','financeVisible?b.billedCents:null','forecast:financeVisible&&','financeMethodology:financeVisible?'])assert.ok(service.includes(phrase),`missing ${phrase}`);
 assert.ok(business.includes('if(!d.visibility.finance)'));assert.ok(overview.includes('d.visibility.finance'));
});

test('P3 dashboard honors finance capability at runtime and does not query restricted financial data',async()=>{
 const content=readFileSync(new URL('../apps/api/src/control/backoffice.service.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(content,{fileName:'backoffice.service.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;
 const decorators={Injectable:()=>cls=>cls,Inject:()=>()=>{}};
 const mockRequire=(name)=>{
  if(name==='@nestjs/common')return decorators;
  if(name==='./backoffice-metrics.js')return exports;
  if(name==='./internal-access.js')return {internalContext:(req)=>({capabilities:req.capabilities}),requireInternalCapability:(req,cap)=>assert.ok(req.capabilities.includes(cap))};
  return {};
 };
 const mod={};new Function('require','exports',compiled)(mockRequire,mod);
 let invoicesQueried=0;
 const db={
  organization:{findMany:async()=>[]},subscription:{findMany:async()=>[]},
  billingInvoice:{findMany:async()=>{invoicesQueried++;return[]},aggregate:async()=>({_sum:{amountCents:0,taxCents:0}})},
  usageEvent:{findMany:async()=>[]},supportTicket:{findMany:async()=>[]},outboxEvent:{findMany:async()=>[]},
  analysisRun:{findMany:async()=>[]},auditEvent:{findMany:async()=>[]},user:{findMany:async()=>[]},paymentTransaction:{findMany:async()=>[]}
 };
 const healthy={status:'HEALTHY'};
 const health={snapshot:async()=>({api:healthy,database:healthy,queue:healthy,analytics:healthy,mail:healthy,environment:'test',checkedAt:new Date().toISOString()})};
 const instance=new mod.BackofficeService(db,health);
 const denied=await instance.dashboard({capabilities:['control.overview']});
 assert.equal(invoicesQueried,0);assert.equal(denied.visibility.finance,false);
 assert.equal(denied.kpis.revenueCents,null);assert.equal(denied.kpis.mrrCents,null);
 assert.equal(denied.forecast,null);assert.equal(denied.financeMethodology,null);assert.equal(denied.timeline[0].revenueCents,null);
 const allowed=await instance.dashboard({capabilities:['control.overview','billing.read']});
 assert.equal(invoicesQueried,1);assert.equal(allowed.visibility.finance,true);assert.equal(allowed.kpis.revenueCents,0);
});
