import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const page=load('apps/web/app/[locale]/page.tsx');
const bill=load('apps/web/app/[locale]/billing/page.tsx');
const css=load('apps/web/app/workspace-r7-kpi-exclusion.css');
const layout=load('apps/web/app/layout.tsx');
const population=load('apps/web/components/population-editor.tsx');
test('R7 layout imports scoped new rules after R6, no global edits or body/theme variables',()=>{
 assert.ok(layout.indexOf('workspace-r7-kpi-exclusion.css')>layout.indexOf('workspace-r6-actions-density.css'));
 assert.doesNotMatch(css,/:root\s*\{|::-webkit-scrollbar|(?:^|\n)\s*body\s*\{/);
});
test('Four original dashboard metrics retain dynamic values and now each has its distinct visible icon',()=>{
 const section=page.split('<section className="workspace-kpi-grid"')[1].split('</section>')[0];
 assert.equal((section.match(/className="workspace-kpi-card ws-r7-kpi"/g)||[]).length,4);
 assert.equal((section.match(/className="ws-r7-kpi-icon"/g)||[]).length,4);
 for(const name of ['assessments','activity','people','gauge']) assert.ok(section.includes(`name="${name}"`));
 for(const code of ['d.summary.activeAssessments','d.summary.participationRate','d.summary.directoryPeople','d.summary.avgReadiness','d.summary.completedResponses','d.summary.participants']) assert.ok(section.includes(code),code);
});
test('R7 dashboard KPI icon, label, value and note are positioned as compact grid cells',()=>{
 for(const key of ['grid-template-areas:"icon label value" "icon note note"','grid-area:icon','grid-area:label','grid-area:value','grid-area:note','min-height:72px']) assert.ok(css.includes(key),key);
 assert.match(css,/@media\(max-width:1120px\)/);
 assert.match(css,/@media\(max-width:580px\)/);
});
test('Six billable metric components keep their real values, no invented quantities',()=>{
 const section=bill.split('<section className="billing-kpis">')[1].split('</section>')[0];
 assert.equal((section.match(/<article>/g)||[]).length,6);
 assert.equal((section.match(/className="ws-r6-billing-icon"/g)||[]).length,6);
 for(const key of ['data.capacity.used','entitlements["participants.year.max"]','data.subscription.plan.monthlyAmountCents','invoices.pagination.total','usage.pagination.total','data.subscription?.status'])assert.ok(section.includes(key),key);
});
test('R7 six billing cards place icon beside content, not above',()=>{
 assert.ok(css.includes('grid-template-columns:30px minmax(0,1fr)'));
 assert.ok(css.includes('grid-template-areas:"icon label" "icon value" "icon note"'));
 assert.match(css,/article > \.ws-r6-billing-icon\s*\{[\s\S]*?grid-area:icon;/);
});
test('Excluir uses existing aria-pressed and state toggling; R7 hover is neutral unless excluded, then red',()=>{
 assert.match(population,/aria-pressed=\{exclude\.includes\(p\.id\)\}/);
 assert.match(population,/toggle\(exclude, p\.id, setExclude\)/);
 const normal=css.split('button.exclude:not(.active):hover')[1].split('}')[0];
 assert.doesNotMatch(normal,/--accent|--danger/);
 const active=css.split('button.exclude.active:hover')[1].split('}')[0];
 assert.match(active,/--danger/);
 assert.doesNotMatch(active,/--accent/);
});
test('No changes to payment, roles, API or mutation endpoints in R7 scope',()=>{
 assert.ok(!css.includes('payment-change-card'));
 assert.ok(!css.includes('workspace-team-row'));
 assert.ok(!css.includes('api/proxy'));
 assert.ok(page.includes('apiGet(`/v1/dashboard?locale=${locale}`)'));
});
