import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supportFilters, operationsFilters, operationalAlertTotals } from "../apps/api/src/control/p4-filters.ts";
const root = new URL("../",import.meta.url);
const src=p=>readFileSync(new URL(p,root),"utf8");
test("P4 support filters reject unknown enum values and bound search input",()=>{
  assert.deepEqual(supportFilters({q:"  ab ",priority:"HIGH",status:"CLOSED"}),{q:"ab",priority:"HIGH",status:"CLOSED"});
  assert.deepEqual(supportFilters({priority:"DROP_TABLE",status:"OWNER"}),{q:"",priority:undefined,status:undefined});
  assert.equal(supportFilters({q:"a".repeat(400)}).q.length,120);
});
test("P4 operations filters validate statuses and bound job type",()=>{
  assert.deepEqual(operationsFilters({jobStatus:"FAILED",analysisStatus:"RUNNING",jobType:" REPORT "}),{jobStatus:"FAILED",analysisStatus:"RUNNING",jobType:"REPORT"});
  assert.deepEqual(operationsFilters({jobStatus:"BAD",analysisStatus:"WRONG"}),{jobStatus:undefined,analysisStatus:undefined,jobType:""});
  assert.equal(operationsFilters({jobType:"A".repeat(200)}).jobType.length,80);
});
test("P4 alert totals reflect all qualified records rather than a 60-item sample",()=>{
  assert.deepEqual(operationalAlertTotals([300,40,80,10,5,12]),{count:407,critical:125});
  assert.deepEqual(operationalAlertTotals([0,0,0,0,0,0]),{count:0,critical:0});
  assert.throws(()=>operationalAlertTotals([1,2,0,0,0,0]));
  assert.throws(()=>operationalAlertTotals([1,-2,0,0,0,0]));
});
test("P4 support API keeps agent visibility scope AND server-side filters",()=>{
  const api=src("apps/api/src/support/support.service.ts");
  assert.match(api,/const filters:any\[\]=\[historyScope,viewWhere\]/);
  assert.match(api,/const where:any=\{AND:filters\}/);
  assert.match(api,/supportFilters\(input\)/);
  assert.match(api,/clampedPagination\(total,input\)/);
  assert.match(api,/this\.db\.supportTicket\.count\(\{where\}\)/);
});
test("P4 operations pagination and count remain DB-backed, with global summary metrics",()=>{
  const api=src("apps/api/src/control/control.service.ts");
  assert.match(api,/operationsFilters\(input\)/);
  assert.match(api,/clampedPagination\(jobsTotal/);
  assert.match(api,/clampedPagination\(analysisTotal/);
  assert.match(api,/this\.db\.outboxEvent\.groupBy/);
  assert.match(api,/this\.db\.analysisRun\.groupBy/);
});
test("P4 alert RBAC, independent totals and limited previews",()=>{
  const api=src("apps/api/src/control/backoffice.service.ts");
  assert.match(api,/requireInternalCapability\(req,"control.overview"\)/);
  assert.match(api,/caps\.includes\("billing.read"\)/);
  assert.match(api,/operationalAlertTotals\(counts\)/);
  assert.match(api,/items:items\.slice\(0,60\)/);
});
test("P4 action confirmations and health probes do not simulate success",()=>{
  const ui=src("packages/ui/src/client.tsx");
  assert.match(ui,/export function ConfirmActionProvider/);
  assert.match(ui,/aria-modal="true"/);
  assert.match(src("apps/control/app/[locale]/operations/page.tsx"),/data-confirm-title=/);
  assert.match(src("apps/control/app/[locale]/operations/page.tsx"),/action=\{retryJob\}/);
  assert.match(src("apps/control/app/[locale]/support/page.tsx"),/action=\{updateTicketStatus\}/);
  assert.match(src("apps/api/src/control/system-health.service.ts"),/await this\.db\.\$queryRaw/);
});
