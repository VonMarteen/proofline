import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const service = read("apps/api/src/control/control.service.ts");
const controller = read("apps/api/src/control/control.controller.ts");

for(const [name,model,permission] of [
  ["legalRecordsPage","documentRecord","legal.read"],
  ["legalInteractionsPage","legalInteraction","legal.read"],
  ["securityEventsPage","auditEvent","security.read"],
]){
 test(`UX-A3 ${name}: authorized DB count, bounded window, stable sorting`,()=>{
   const start=service.indexOf(`async ${name}(`), end=service.indexOf("\n  async ",start+6);
   assert.ok(start>0);
   const block=service.slice(start,end<0?undefined:end);
   assert.ok(block.includes(`requireInternalCapability(req,"${permission}")`));
   assert.ok(block.includes(`this.db.${model}.count({where})`));
   assert.ok(block.includes(`this.db.${model}.findMany({where,skip:window.skip,take:window.take`));
   assert.match(block,/clampedPagination\(total,pg\)/);
   assert.match(block,/orderBy:\[\{createdAt:"desc"\},\{id:"asc"\}\]/);
   assert.match(block,/return paged\(items,total,window.page,window.pageSize\)/);
   assert.match(block,/slice\(0,100\)/);
 });
}

test("UX-A3: secure endpoints are within the existing internal auth guard",()=>{
 assert.match(controller,/@UseGuards\(InternalDevAuthGuard\)/);
 for(const route of ["tables/legal/records","tables/legal/interactions","tables/security/events"]){
   assert.ok(controller.includes(`@Get("${route}")`),route);
 }
});

test("UX-A3: legacy legal/security contracts stay intact, with slim UI queries",()=>{
 assert.match(service,/uiView\?Promise.resolve\(\[\]\):this.db.legalInteraction.findMany/);
 assert.match(service,/uiView\?Promise.resolve\(\[\]\):this.db.documentRecord.findMany/);
 assert.match(service,/uiView\?this.db.documentRecord.count/);
 assert.match(service,/view==="ui"\?Promise.resolve\(\[\]\):this.db.auditEvent.findMany/);
 for(const part of ['@Get("legal")','@Get("security")']) assert.ok(controller.includes(part));
});

test("UX-A3: filters are passed to API; totals and 25/50/100 navigation are server results",()=>{
 for(const [page,endpoint,term] of [
  ["privacy","tables/legal/records","recordClass"],
  ["legal","tables/legal/interactions","evidenceAction"],
  ["security","tables/security/events","q"],
 ]){
   const view=read(`apps/control/app/[locale]/${page}/page.tsx`);
   assert.ok(view.includes(endpoint),page);
   assert.ok(view.includes(`name="${term}"`),page);
   assert.match(view,/method="get"/);
   assert.match(view,/<PaginationBar pagination=/);
   assert.match(view,/<tr key=\{(?:r|a|x)\.id\}/);
   assert.ok(view.includes('control-table-empty'));
 }
 const org=read('apps/control/app/[locale]/organizations/[id]/page.tsx');
 assert.ok((org.match(/<RecordsTable/g)??[]).length>=2);
 assert.ok(org.includes('30 eventos recientes'));
});

test("UX-A3: prior scrollbars/navigation/UI-01R KPI styles untouched",()=>{
 const css=read("apps/control/app/backoffice.css");
 assert.match(css,/\.control-uxa3-filters/);
 assert.match(css,/\.bo-dashboard>\.bo-kpi-grid \.bo-kpi\{/);
 assert.doesNotMatch(css,/\.control-shell\s+::-webkit-scrollbar/);
 assert.match(read("apps/control/components/control-nav.tsx"),/prefetch=\{false\}/);
});
