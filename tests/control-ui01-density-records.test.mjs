import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterVisibleRecords, paginateVisibleRecords } from "../apps/control/components/records-table-filter.ts";

const read = (p) => readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const rows = [
  {id:"1",search:"Álvaro Pérez FINANCE",status:"ACTIVE"},
  {id:"2",search:"Beatriz Soporte",status:"PENDING"},
  {id:"3",search:"Alvaro Operaciones",status:"ACTIVE"},
];
test("UI-01 search is case and accent insensitive, acts only on loaded records",()=>{
 assert.deepEqual(filterVisibleRecords(rows,"alvaro","","original","es").map(x=>x.id),["1","3"]);
 assert.deepEqual(filterVisibleRecords(rows,"SOporte","","original","es").map(x=>x.id),["2"]);
 assert.deepEqual(filterVisibleRecords(rows,"","PENDING","original","es").map(x=>x.id),["2"]);
 assert.deepEqual(filterVisibleRecords(rows,"never", "", "original", "es"),[]);
 assert.equal(rows.length,3);
});
test("UI-01 sorting operates on a copy without mutating server returned order",()=>{
 const sorted=filterVisibleRecords(rows,"","","za","es");
 assert.deepEqual(sorted.map(x=>x.id),["2","1","3"]);
 assert.deepEqual(rows.map(x=>x.id),["1","2","3"]);
});
test("UI-01 paging clamps out of bounds and enforces 25/50/100 sizes",()=>{
 const all=Array.from({length:107},(_,i)=>i);
 const result=paginateVisibleRecords(all,3,50);
 assert.equal(result.pages,3);assert.equal(result.items.length,7);assert.equal(result.items[0],100);
 assert.equal(paginateVisibleRecords(all,999,25).page,5);
 assert.equal(paginateVisibleRecords(all,-1,3).pageSize,25);
 assert.equal(paginateVisibleRecords([],9,25).pages,1);
});
test("UI-01 shared component exposes usable controls, top count and bottom pagination",()=>{
 const src=read("apps/control/components/records-table.tsx");
 for(const contract of ['type="search"','onChange=', 'control-records-count','control-records-footer','Filas por página','Anterior','Siguiente','aria-live="polite"','limitedNote'])assert.ok(src.includes(contract),contract);
});
test("UI-01 and UX-A3 retain filters and real pagination in every converted view",()=>{
 for(const page of ["security","privacy","legal"]){
  const src=read(`apps/control/app/[locale]/${page}/page.tsx`);
  assert.match(src,/<PaginationBar pagination=/);
  assert.match(src,/tables\/(?:security|legal)\//);
 }
 for(const page of ["page","communications/page"]){
  const file=page==="page"?"apps/control/app/[locale]/page.tsx":`apps/control/app/[locale]/${page}.tsx`;
  assert.match(read(file),/RecordsTable/);
 }
});
test("UI-01 System has five-column compact cards at desktop and responsive fallback",()=>{
 assert.match(read("apps/control/app/[locale]/system/page.tsx"),/bo-kpi-grid control-system-kpis/);
 const css=read("apps/control/app/backoffice.css");
 assert.match(css,/\.control-system-kpis\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1280px\)/);
});
test("UI-01 leaves persistence, server billing filters and legal holds in original flows",()=>{
 const legal=read("apps/control/app/[locale]/legal/page.tsx");
 for(const item of ["updateRetentionPolicy","createLegalHold","releaseLegalHold","executeRetentionLifecycle","publishLegalDocumentVersion"])assert.ok(legal.includes(item));
 assert.match(read("apps/control/app/[locale]/plans/page.tsx"),/cloneCommercialPlan/);
 assert.match(read("apps/control/app/[locale]/configuration/page.tsx"),/updateOrganizationDefaultLocale/);
});
test("UI-01 style contract includes same-height inputs buttons, scrollbars, accessible focus and compact metrics",()=>{
 const css=read("apps/control/app/backoffice.css");
 for(const contract of ["UI-01", "min-height:36px;height:36px", "control-records-toolbar", "scrollbar-width:thin", "::-webkit-scrollbar", "focus-visible", "control-metric{min-height:84px", "control-legal-compliance-layout"])assert.ok(css.includes(contract),contract);
});
