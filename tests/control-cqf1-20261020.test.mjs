import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const security = read('apps/control/app/[locale]/security/page.tsx');
const usage = read('apps/control/app/[locale]/usage/page.tsx');
const audit = read('apps/control/app/[locale]/audit/page.tsx');
const css = read('apps/control/app/backoffice.css');
const lastRules = css.slice(css.indexOf('/* CQF 1/3 —'),css.indexOf('/* CQF-F1:')); // CQF1 scope; CQF-F1 fixes sidebar independently

// Test only the production contract and the patch scope: no mocks claimed as E2E.
test('CQF1: TSX parses without syntax diagnostics (three changed routes)', () => {
  for (const [name,code] of [['security',security],['usage',usage],['audit',audit]]) {
    const out = ts.transpileModule(code,{fileName:`${name}.tsx`,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022}});
    const errors = (out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')),[],name);
  }
});
test('CQF1: trust zones separate all three names, values and descriptions; no removed security flows', () => {
  assert.match(security, /className="control-trust-zones"/);
  assert.equal((security.match(/className="control-trust-zone"/g)??[]).length,3);
  for (const val of ['client','participant','internal']) assert.ok(security.includes(`{d.trustZones.${val}}`));
  for (const action of ['createInternalUser','controlIdentity()', 'controlGet("/v1/control/governance/roles")', 'PaginationBar','RecordsTable']) assert.ok(security.includes(action),action);
  assert.match(security, /data-confirm-title=/);
});
test('CQF1: isolated trust CSS, coherent spacing and mobile-safe grid',()=>{
  for (const cls of ['.control-trust-zones','.control-trust-zone','.control-trust-value']) assert.ok(lastRules.includes(cls),cls);
  assert.match(lastRules, /repeat\(auto-fit,minmax\(min\(100%,240px\),1fr\)\)/);
  assert.match(lastRules, /overflow-wrap:anywhere/);
  assert.doesNotMatch(lastRules, /\.control-policy-grid|\.control-sidebar|\.bo-dashboard|\.bo-kpi|scrollbar-(?:color|width)|::-webkit-scrollbar/);
});
test('CQF1: usage empty states are specific to each real collection in ES/EN',()=>{
  assert.match(usage,/d\.byOrganization\.length\?d\.byOrganization\.map/);
  assert.match(usage,/d\.byType\.length\?d\.byType\.map/);
  assert.match(usage,/!d\.events\.length\?<tr><td className="control-table-empty" colSpan=\{6\}/);
  for(const text of ['No hay eventos de uso por organización', 'No usage events by organization', 'No hay tipos de evento', 'No event types recorded', 'No hay movimientos registrados', 'No ledger entries recorded']) assert.ok(usage.includes(text),text);
  assert.match(usage,/role="status"/);
});
test('CQF1: usage queries and ledger accounting logic preserved',()=>{
  assert.match(usage,/controlGet\(`\/v1\/control\/tables\/usage\?\$\{qs\}`\)/);
  assert.match(usage,/reduce\(\(n:number,o:any\)=>n\+o\.billable,0\)/);
  assert.match(usage,/reduce\(\(n:number,o:any\)=>n\+o\.nonBillable,0\)/);
  assert.match(usage,/<PaginationBar pagination=\{d\.pagination\}/);
  assert.match(usage,/\{e\.billable\?<span className="control-ok">/);
});
test('CQF1: audit JSON remains available on demand and via original authorization-backed route',()=>{
  assert.match(audit,/controlGet\(`\/v1\/control\/tables\/audit\?\$\{qs\}`\)/);
  assert.match(audit,/<details className="control-audit-details"><summary>/);
  assert.match(audit,/JSON\.stringify\(a\.metadata\?\?\{\},null,2\)/);
  assert.doesNotMatch(audit,/control-code-wrap|<code/);
  assert.match(audit,/<PaginationBar pagination=\{d\.pagination\}/);
  assert.match(audit,/!rows\.length\?<tr><td colSpan=\{6\} className="control-table-empty"/);
});
test('CQF1: audit disclosure focuses visibly and does not override global scrollbars',()=>{
  assert.match(lastRules,/\.control-audit-details>summary:focus-visible\{outline:2px solid var\(--accent\)/);
  assert.match(lastRules,/\.control-audit-json\{[^}]*max-height:260px/);
  assert.doesNotMatch(lastRules,/scrollbar-width\s*:|scrollbar-color\s*:|::-webkit-scrollbar/);
});
test('CQF1: audited endpoint still enforces audit.read in API; no API patch',()=>{
  const service=read('apps/api/src/control/control.service.ts');
  const auditMethod=service.slice(service.indexOf('  async auditPage('), service.indexOf('  async organization('));
  assert.match(auditMethod,/requireInternalCapability\(req,"audit.read"\)/);
  assert.match(auditMethod,/this\.db\.auditEvent\.findMany/);
});
