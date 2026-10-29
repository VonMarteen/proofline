import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reportDeliveryCounts, workspaceReportView } from "../apps/web/lib/report-view.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root,path),"utf8");

test("WS-3: report canonical envelope uses persisted participation and scoring, not invented values", () => {
  const actual = workspaceReportView({level:"L3_ANALYTICAL",canonical:{organization:{name:"ACME Europe"},source:{synthetic:false},participation:{completed:6,total:7,rate:86},score:{overall:73},highlights:["A verified result"],dimensions:[{name:"Leadership",score:81}]}});
  assert.equal(actual.overall,73);
  assert.equal(actual.participationRate,86);
  assert.equal(actual.executive,"A verified result");
  assert.deepEqual(actual.dimensions,[{name:"Leadership",score:81}]);
  assert.equal(actual.organization,"ACME Europe");
  assert.equal(actual.level,"L3_ANALYTICAL");
  assert.equal(actual.synthetic,false);
});

test("WS-3: historical snapshot retains existing scalar values without reconstructing scores", () => {
  const actual=workspaceReportView({overallScore:41,participation:{completed:0,total:4,rate:0},executiveAnswer:"Historical",dimensions:[{name:"Legacy",score:0}]});
  assert.equal(actual.overall,41);assert.equal(actual.participationRate,0);
  assert.equal(actual.executive,"Historical");assert.equal(actual.legacy,true);
  assert.equal(workspaceReportView({}).overall,null);
  assert.equal(workspaceReportView({}).executive,null);
});

test("WS-3: synthetic reports are visibly distinguishable from real evidence", () => {
  assert.equal(workspaceReportView({canonical:{source:{synthetic:true}}}).synthetic,true);
  assert.equal(workspaceReportView({synthetic:true}).synthetic,true);
});

test("WS-3: delivery states do not imply the recipient read the report", () => {
  assert.deepEqual(reportDeliveryCounts([{status:"SENT"},{status:"PENDING"},{status:"FAILED"},{status:"SENT"}]),{total:4,sent:2,pending:1,failed:1});
  assert.deepEqual(reportDeliveryCounts([]),{total:0,sent:0,pending:0,failed:0});
});

test("WS-3: individual report endpoint requires result permission and restricts tenant and assessment grants", () => {
  const source=read("apps/api/src/workspace.controller.ts");
  const block=source.split('@Get("reports/:id")')[1]?.split('@Get("reports")')[0] ?? "";
  assert.ok(block.includes('permittedAssessmentIds(this.db,req)'));
  assert.ok(block.includes('ctx.capabilities.includes("results.read")'));
  assert.ok(block.includes('ctx.capabilities.includes("results.authorized_read")'));
  assert.ok(block.includes('organizationId:ctx.organization.id'));
  assert.ok(block.includes('id:{in:ids}'));
  assert.ok(block.includes('this.db.report.findFirst'));
  assert.ok(block.includes('new NotFoundException'));
  assert.ok(!block.includes('this.db.report.findMany'));
});

test("WS-3: report page fetches one report and displays accurate status and snapshot values", () => {
  const source=read("apps/web/app/[locale]/reports/[id]/page.tsx");
  assert.ok(source.includes('`/v1/workspace/reports/${encodeURIComponent(id)}`'));
  assert.ok(!source.includes('apiGet("/v1/workspace/reports")'));
  assert.ok(source.includes('workspaceReportView(report.snapshot)'));
  assert.ok(source.includes('report.snapshotHash'));
  assert.ok(source.includes('deliveryState[item.status]'));
  assert.ok(source.includes('No deliveries have been recorded'));
  assert.ok(!source.includes('Abrir PDF aprobado'));
});

test("WS-3: visual parity is scoped to Workspace; original global scrollbars and Control CSS untouched", () => {
  const css=read("apps/web/app/workspace.css");
  const block=css.split("/* WS-3 · Control visual parity")[1] ?? "";
  assert.ok(block.includes('.workspace-main{width:100%'));
  assert.ok(block.includes('.workspace-sidebar>.workspace-nav{flex:1'));
  assert.ok(block.includes('.workspace-sidebar>.workspace-sidebar-footer{flex:0'));
  assert.ok(block.includes('.workspace-page-head h1'));
  assert.ok(block.includes('.workspace-kpi-card{min-height:80px'));
  assert.ok(!/scrollbar-width|::-webkit-scrollbar|scrollbar-color/.test(block));
  assert.ok(!/\.control-|\.bo-/.test(block));
});
