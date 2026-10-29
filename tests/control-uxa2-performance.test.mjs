import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

const require=createRequire(import.meta.url);
const ts=require("typescript");

test("UX-A2: changed TypeScript/TSX files parse without syntax errors",()=>{
  const paths=[
    "apps/control/components/dashboard-trend.tsx", "apps/control/app/[locale]/page.tsx",
    "apps/control/app/[locale]/business/page.tsx", "apps/control/app/[locale]/configuration/page.tsx",
    "apps/control/lib/api.ts", "apps/api/src/control/control.service.ts",
    "apps/api/src/control/control.controller.ts", "apps/api/src/control/backoffice.service.ts",
  ];
  for(const path of paths){
    const result=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}});
    const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.equal(errors.length,0,`${path}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; ")}`);
  }
});

test("UX-A2: chart metric updates locally without server navigation or data modification",()=>{
  const chart=read("apps/control/components/dashboard-trend.tsx");
  assert.match(chart,/useState<TrendMetric>\(initialMetric\)/);
  assert.match(chart,/setMetric\(next\)/);
  assert.match(chart,/url\.searchParams\.set\("metric",next\)/);
  assert.match(chart,/window\.history\.replaceState/);
  assert.match(chart,/window\.addEventListener\("popstate"/);
  assert.match(chart,/aria-pressed=\{metric===m\}/);
  assert.doesNotMatch(chart,/fetch\(|router\.push\(|location\.href\s*=/);
  const overview=read("apps/control/app/[locale]/page.tsx");
  const business=read("apps/control/app/[locale]/business/page.tsx");
  for(const text of [overview,business]){
    assert.match(text,/<DashboardTrend /);
    assert.match(text,/<PeriodSwitch |<BusinessPeriodSwitch /);
    assert.doesNotMatch(text,/<MetricTabs /);
  }
});

test("UX-A2: configuration UI view skips entitlements and preserves full legacy contract",()=>{
  const src=read("apps/api/src/control/control.service.ts");
  const block=src.split("async configuration(")[1].split("async updateOrganizationLocale(")[0];
  assert.match(block,/requireInternalCapability\(req, "configuration\.read"\)/);
  assert.match(block,/view==="ui"/);
  assert.match(block,/uiView\?Promise\.resolve\(\[\]\):this\.db\.entitlement\.findMany/);
  assert.match(block,/uiView\?this\.db\.plan\.findMany/);
  assert.match(block,/return \{ locales: \["es", "en"\], plans, entitlements, organizations, organizationTotal/);
  assert.match(read("apps/control/app/[locale]/configuration/page.tsx"),/configuration\?view=ui&q=/);
  assert.match(read("apps/api/src/control/control.controller.ts"),/service\.configuration\(req,q,view\)/);
  assert.match(read("apps/api/src/control-runtime-check.ts"),/configuration\?\.entitlements/);
});

test("UX-A2: security retains real counts and authorization while using narrow queries",()=>{
  const src=read("apps/api/src/control/control.service.ts");
  const block=src.split("async security(req:")[1].split("async configuration(")[0];
  assert.match(block,/requireInternalCapability\(req, "security\.read"\)/);
  assert.match(block,/await Promise\.all\(/);
  assert.match(block,/include: \{ organization:true \}/);
  assert.match(block,/sessions:\{where:\{revokedAt:null,expiresAt:\{gt:now\}\},select:\{id:true\}\}/);
  assert.match(block,/trustedDevices:\{where:\{revokedAt:null,trustedUntil:\{gt:now\}\},select:\{id:true\}\}/);
  assert.match(block,/activeSessions:u\.sessions\.length,trustedDevices:u\.trustedDevices\.length/);
  assert.match(block,/internalUsers: internalUsers\.map\([\s\S]*?\)\), events \};/);
});

test("UX-A2: dashboard queries retrieve only fields used, without removing finance masking",()=>{
  const src=read("apps/api/src/control/backoffice.service.ts");
  for(const needle of [
    'requireInternalCapability(req,"control.overview")',
    'select:{status:true,currency:true,amountCents:true,taxCents:true,issuedAt:true,paidAt:true}',
    'select:{quantity:true,billable:true}',
    'select:{lastLoginAt:true}',
    'financeVisible?revenueCents:null',
    'financeVisible?mrrCents:null',
    'financeVisible?b.revenueCents:null',
    'forecast:financeVisible&&',
    'system:{api:systemHealth.api.status',
    'dashboard slow response: ${dashboardDurationMs}ms',
    'dbBatch=${queryDurationMs}ms; health=${healthDurationMs}ms'
  ]) assert.ok(src.includes(needle),`Missing protected reporting behavior: ${needle}`);
});

test("UX-A2: diagnostic output does not log user searches, sessions, request bodies",()=>{
  const src=read("apps/control/lib/api.ts");
  assert.match(src,/path\.split\("\?"\)\[0\]/);
  assert.match(src,/elapsedMs > 1000/);
  assert.match(src,/cache: "no-store"/);
  assert.match(src,/AbortSignal\.timeout\(5000\)/);
  assert.doesNotMatch(src,/console\.(?:log|warn)\([^\n]*(?:token|authorization|response\.text)/);
});

test("UX-A2: visual changes are restricted to existing metric tab styling",()=>{
  const css=read("apps/control/app/backoffice.css");
  assert.match(css,/\.bo-metric-tabs button:focus-visible/);
  assert.match(css,/\.bo-metric-tabs button\.active/);
  assert.match(read("packages/design-tokens/base.css"),/scrollbar/);
  assert.doesNotMatch(read("apps/control/components/dashboard-trend.tsx"),/onScroll|overflowY|scrollbar/);
});
