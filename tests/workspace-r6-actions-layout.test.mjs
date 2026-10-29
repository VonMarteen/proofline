import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const css=load('apps/web/app/workspace-r6-actions-density.css');
const layout=load('apps/web/app/layout.tsx');
const questions=load('apps/web/components/question-editor.tsx');
const team=load('apps/web/components/team-manager.tsx');
const billing=load('apps/web/app/[locale]/billing/page.tsx');
const payment=load('apps/web/components/payment-method-manager.tsx');
const legal=load('apps/web/app/[locale]/legal/page.tsx');
test('R6 scoped stylesheet is imported last and does not redefine tokens globally',()=>{
 assert.ok(layout.indexOf('workspace-r6-actions-density.css')>layout.indexOf('assessment-detail-r5.css'));
 assert.doesNotMatch(css, /:root\s*\{|::-webkit-scrollbar|(?:^|\n)\s*body\s*\{/);
});
test('Question edit and delete stay real buttons with their current state-changing handlers',()=>{
 assert.match(questions,/className="workspace-text-button ws-r6-action-button" onClick=\{\(\)=>setOpen\(true\)\}/);
 assert.match(questions,/className="workspace-text-button danger ws-r6-action-button" onClick=\{\(\)=>remove\(q.id\)\}/);
 assert.match(questions,/requestProoflineConfirmation\(\{title:es\?"Eliminar pregunta"/);
 assert.match(css,/builder-question-actions \.ws-r6-action-button/);
});
test('Person exclusion keeps the existing toggle and aria-pressed with an explicit inset style',()=>{
 const people=load('apps/web/components/population-editor.tsx');
 assert.match(people,/aria-pressed=\{exclude\.includes\(p\.id\)\}/);
 assert.match(people,/toggle\(exclude, p\.id, setExclude\)/);
 assert.match(css,/population-person-list button\.exclude\.active/);
 assert.match(css,/population-person-list label \{ gap:8px; padding-block:6px/);
});
test('Team heading spans both grid columns so table and invite panel share a baseline',()=>{
 assert.match(team,/<section className="workspace-team-layout"><div className="workspace-team-summary">/);
 assert.match(team,/<div className="workspace-team-list"><div className="workspace-team-table">/);
 assert.match(team,/<aside className="workspace-invite-card">/);
 assert.match(css,/workspace-team-summary \{ grid-column:1\/-1/);
 assert.match(css,/workspace-team-layout \.workspace-invite-card \{margin:0/);
});
test('Team removal retains confirmation, protected-member branch and server endpoint',()=>{
 assert.match(team,/className="workspace-text-button danger ws-r6-team-remove"/);
 for(const invariant of ['m.isOwner','data.currentMembershipId===m.id','requestProoflineConfirmation','/team/${id}/remove','/team/${id}/role','/team/${id}/assessment-access']) assert.ok(team.includes(invariant),invariant);
});
test('Roles inspector keeps its seven real profiles and keyboard-triggered accessible toggles',()=>{
 for(const role of ['OWNER','ADMIN','BILLING_ADMIN','ASSESSMENT_MANAGER','REVIEWER','ANALYST','VIEWER']) assert.ok(team.includes(`${role}:`),role);
 assert.match(team,/aria-expanded=\{canOpen\}/);assert.match(team,/aria-expanded=\{cannotOpen\}/);
 assert.match(team,/aria-hidden=\{!canOpen\}/);assert.match(team,/aria-hidden=\{!cannotOpen\}/);
 assert.match(css,/ws-r6-permission-panel\.is-open/);
});
test('Six billing KPIs each get a matching icon and retain real values',()=>{
 const section=billing.split('<section className="billing-kpis">')[1].split('</section>')[0];
 assert.equal((section.match(/<article><span>/g)||[]).length,6);
 assert.equal((section.match(/className="ws-r6-billing-icon"/g)||[]).length,6);
 for(const v of ['data.capacity.used','entitlements["participants.year.max"]','data.subscription.plan.monthlyAmountCents','invoices.pagination.total','usage.pagination.total','data.subscription?.status']) assert.ok(section.includes(v),v);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});
test('Payment provider, card brand and last-four inputs share a responsive row without changing the request',()=>{
 assert.match(payment,/className="ws-r6-payment-fields"/);
 assert.match(payment,/name="brand"/);assert.match(payment,/name="last4"/);assert.match(payment,/maxLength=\{4\}/);
 for(const code of ['REDSYS','PAYPAL','BANK_TRANSFER']) assert.ok(payment.includes(code));
 assert.match(payment,/\/v1\/workspace\/billing\/payment-methods/);
 assert.match(payment,/requestProoflineConfirmation/);
 assert.match(css,/ws-r6-payment-fields \{ display:grid;/);
});
test('Privacy review is still an actual assessment link with visible button affordance',()=>{
 assert.match(legal,/className="ws-r6-review-link" href=\{`\/\$\{l\}\/assessments\/\$\{encodeURIComponent\(a.id\)\}`\}/);
 assert.match(css,/privacy-assessment-list > article > \.ws-r6-review-link/);
});
test('Responsive and reduced-motion fallbacks exist',()=>{
 for(const q of ['@media(max-width:1360px)','@media(max-width:1250px)','@media(max-width:980px)','@media(max-width:740px)','@media(max-width:460px)','@media(prefers-reduced-motion:reduce)']) assert.ok(css.includes(q),q);
 assert.match(css,/:focus-visible/);
});
