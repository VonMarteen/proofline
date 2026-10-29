import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessmentFilters, reportFilters, frameworkFilters, participantProgress, reportDeliveryTotals, canReprocessAssessment } from "../apps/api/src/control/p5-policy.ts";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("P5 assessment filters whitelist lifecycle statuses and bound searches",()=>{
  assert.deepEqual(assessmentFilters({q:"  Evaluation  ",status:"CLOSED"}),{q:"Evaluation",status:"CLOSED"});
  assert.equal(assessmentFilters({status:"FAKE"}).status,undefined);
  assert.equal(assessmentFilters({q:"x".repeat(200)}).q.length,120);
});
test("P5 participation uses eligible denominators, not revoked or fake 100%",()=>{
  assert.deepEqual(participantProgress([]),{invited:0,started:0,completed:0,revoked:0,eligible:0,completionPct:null});
  assert.deepEqual(participantProgress([{status:"INVITED",_count:{_all:3}},{status:"COMPLETED",_count:{_all:5}},{status:"REVOKED",_count:{_all:2}}]),{invited:3,started:0,completed:5,revoked:2,eligible:8,completionPct:63});
  assert.throws(()=>participantProgress([{status:"COMPLETED",_count:{_all:-1}}]));
});
test("P5 reports validate status, kind and delivery with explicit NONE",()=>{
  assert.deepEqual(reportFilters({status:"DISTRIBUTED",kind:"FULL",delivery:"FAILED"}),{q:"",status:"DISTRIBUTED",kind:"FULL",delivery:"FAILED"});
  assert.equal(reportFilters({delivery:"NONE"}).delivery,"NONE");
  assert.equal(reportFilters({status:"SENT",kind:"GHOST",delivery:"BOGUS"}).status,undefined);
  assert.equal(reportFilters({kind:"GHOST"}).kind,undefined);
});
test("P5 report delivery totals do not treat sent as distributed or pending as success",()=>{
  assert.deepEqual(reportDeliveryTotals([]),{pending:0,sent:0,failed:0,total:0});
  assert.deepEqual(reportDeliveryTotals([{status:"SENT",_count:{_all:3}},{status:"PENDING",_count:{_all:2}},{status:"FAILED",_count:{_all:1}}]),{pending:2,sent:3,failed:1,total:6});
  assert.throws(()=>reportDeliveryTotals([{status:"SENT",_count:{_all:1.5}}]));
});
test("P5 marketplace filters validate origin, visibility and sort",()=>{
  assert.deepEqual(frameworkFilters({q:"  foo ",origin:"PARTNER",visibility:"LICENSED",sort:"recent"}),{q:"foo",category:"",origin:"PARTNER",visibility:"LICENSED",sort:"recent"});
  assert.equal(frameworkFilters({origin:"BOGUS",visibility:"secret",sort:"drop"}).sort,"category");
  assert.equal(frameworkFilters({origin:"BOGUS"}).origin,undefined);
});
test("P5 reprocess only for closed/archived assessments without in-flight runs",()=>{
  for(const status of ["DRAFT","PREPARATION","REVIEW","READY","ACTIVE"])assert.equal(canReprocessAssessment(status,false),false);
  for(const status of ["CLOSED","ARCHIVED"]){assert.equal(canReprocessAssessment(status,false),true);assert.equal(canReprocessAssessment(status,true),false);}
});
test("P5 API applies RBAC, DB aggregates and excludes raw participant and recipient data",()=>{
  const api=read("apps/api/src/control/control.service.ts"),controller=read("apps/api/src/control/control.controller.ts");
  for(const permission of ["assessments.read","reports.read","marketplace.read","operations.manage"])assert.ok(api.includes(`requireInternalCapability(req,"${permission}")`));
  assert.match(api,/this\.db\.participant\.groupBy/);
  assert.match(api,/this\.db\.reportDelivery\.groupBy/);
  assert.match(api,/this\.db\.assessment\.groupBy/);
  assert.match(api,/clampedPagination\(total,input\)/);
  const reports=api.split("async reportsPage(")[1].split("async auditPage(")[0];
  assert.ok(!reports.includes("snapshot:true"));
  assert.ok(!reports.includes("emailEncrypted"));
  assert.ok(!reports.includes("recipient:{"));
  assert.ok(controller.includes("this.service.reportsPage(req,{page,pageSize,q,status,kind,delivery})"));
  assert.ok(controller.includes("this.service.marketplacePage(req,{page,pageSize,q,category,sort,origin,visibility})"));
});
test("P5 reprocess is transactional, concurrent-safe and carries launched version into outbox",()=>{
  const api=read("apps/api/src/control/control.service.ts").split("async reprocessAssessment(")[1].split("async retryJob(")[0];
  assert.match(api,/\$transaction\(async tx/);
  assert.match(api,/pg_advisory_xact_lock/);
  assert.match(api,/status:\{in:\["PENDING","RUNNING"\]\}/);
  assert.match(api,/assessmentVersionId:version\?\.id\?\?null/);
  assert.match(api,/await tx\.auditEvent\.create/);
  assert.match(api,/await tx\.outboxEvent\.create/);
});
test("P5 operational pages preserve pagination, filters and confirm side effects",()=>{
  for(const name of ["assessments","reports","marketplace"]){
    const ui=read(`apps/control/app/[locale]/${name}/page.tsx`);
    assert.ok(ui.includes("PaginationBar"));
    assert.ok(ui.includes('name="pageSize"'));
    assert.ok(ui.includes("control-table-empty"));
  }
  const assessments=read("apps/control/app/[locale]/assessments/page.tsx");
  assert.ok(assessments.includes("data-confirm-title"));
  assert.ok(assessments.includes("canManage"));
  assert.ok(assessments.includes("a.canReprocess"));
  const reports=read("apps/control/app/[locale]/reports/page.tsx");
  assert.ok(reports.includes("deliverySummary"));
  assert.ok(reports.includes("snapshotHash"));
});
