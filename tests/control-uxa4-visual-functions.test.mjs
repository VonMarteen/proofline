import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sales = read('apps/control/app/[locale]/sales/page.tsx');
const users = read('apps/control/app/[locale]/internal-users/page.tsx');
const security = read('apps/control/app/[locale]/security/page.tsx');
const plans = read('apps/control/app/[locale]/plans/page.tsx');
const css = read('apps/control/app/backoffice.css');

test('UX-A4: commercial actions retain real server actions and original guards', () => {
 for (const action of ['selectCommercialPlan', 'updateCommercialStage', 'configureCommercialPayment', 'createEvaluationWorkspace', 'provisionCustomer']) {
  assert.match(sales, new RegExp(`action=\\{${action}\\}`), action);
 }
 assert.match(sales, /canManage&&ready/);
 assert.match(sales, /BANK_TRANSFER/);
 assert.match(sales, /NET 15\/30\/60/);
 assert.match(sales, /<PaginationBar pagination=/);
});

test('UX-A4: row editing is progressive and confirmations are still attached to submit forms', () => {
 for (const [summary, action] of [
   ['Cambiar plan', 'selectCommercialPlan'],
   ['Editar etapa', 'updateCommercialStage'],
   ['Condiciones de pago', 'configureCommercialPayment'],
 ]) {
  assert.ok(sales.includes(summary),summary);
  assert.match(sales,new RegExp(`<details className="control-sales-disclosure"><summary>[^<]*</summary><form action=\\{${action}\\}`));
 }
 assert.equal((sales.match(/<details className="control-sales-disclosure">/g) ?? []).length, 3);
 assert.equal((sales.match(/<\/details>/g) ?? []).length, 3);
 assert.ok((sales.match(/data-confirm-title=/g) ?? []).length >= 5);
});

test('UX-A4: commercial edit fields have accessible names and preserve required validation',()=>{
 for (const field of ['lostReason','maskedLabel','last4']) {
  assert.match(sales,new RegExp(`<input name="${field}" aria-label=`));
 }
 assert.match(sales, /name="last4"[^>]*pattern="\[0-9\]\{4\}"/);
 assert.match(sales, /name="planCode"[^>]*required/);
});

test('UX-A4: internal user creation keeps invite operation, role permissions and explicit labels', () => {
 assert.match(users, /identity\.role==="INTERNAL_PLATFORM_OWNER"/);
 assert.match(users, /action=\{createInternalUser\}/);
 assert.match(users, /control-internal-create-form/);
 for (const item of ['displayName','email','role']) assert.ok(users.includes(`name="${item}"`));
 assert.match(users, /<label><span>\{es\?"Correo electrónico"/);
 assert.match(users, /<label><span>\{es\?"Rol interno"/);
 assert.match(users, /name="displayName" minLength=\{2\} maxLength=\{160\}/);
 assert.match(users, /Object\.keys\(roleText\)\.filter\(r=>r!=="INTERNAL_PLATFORM_OWNER"\)/);
 assert.match(users, /<option key=\{r\} value=\{r\}>/);
});

test('UX-A4: role descriptions are localized and governed server side', () => {
 assert.match(users, /const roleTextEn:Record<string,string>/);
 assert.match(users, /roleDescription\(u\.role,es\)/);
 assert.match(users, /roleDescription\(role,es\)/);
 assert.match(security, /controlGet\("\/v1\/control\/governance\/roles"\)/);
 assert.match(security, /href=\{`\/\$\{locale\}\/security\/roles\/\$\{encodeURIComponent\(r.role\)\}`\}/); // CQF-F1 routes fixed RBAC detail outside tables
 assert.match(security, /r\.capabilities\.length/);
 assert.match(security, /data-confirm-title=\{es\?"Crear acceso interno"/);
});

test('UX-A4: plan catalog has a genuine empty state and does not alter plan contracts',()=>{
 assert.match(plans, /!plans\.length\?<p className="control-empty">/);
 assert.match(plans, /cloneCommercialPlan/);
 assert.match(plans, /<PaginationBar pagination=/);
 assert.match(plans, /control-plan-create-form/);
});

test('UX-A4: visual rules are scoped; no new scrollbar or dashboard KPI overrides',()=>{
 for(const className of ['control-sales-disclosure','control-sales-metrics','control-internal-create-form','control-role-disclosure']) assert.ok(css.includes(`.${className}`),className);
 const cssA4=css.slice(css.indexOf('/* UX-A4 — scoped'),css.indexOf('/* CQF 1/3 —')); // UX-A4 scope, later explicit sidebar fix is separate
 assert.ok(cssA4);
 assert.doesNotMatch(cssA4,/scrollbar-(?:width|color)|::-webkit-scrollbar/);
 assert.doesNotMatch(cssA4,/\.bo-dashboard|\.control-sidebar|\.control-header/);
 assert.match(cssA4, /@media\(max-width:760px\)/);
 assert.match(cssA4, /focus-visible/);
});
