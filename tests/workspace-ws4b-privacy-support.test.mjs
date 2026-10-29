import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,root),'utf8');
const controller=get('apps/api/src/workspace.controller.ts');
const supportController=get('apps/api/src/support/workspace-support.controller.ts');
const support=get('apps/api/src/support/support.service.ts');
const privacy=get('apps/web/app/[locale]/legal/page.tsx');
const ticketPage=get('apps/web/app/[locale]/support/page.tsx');
test('WS4B: privacy list uses a dedicated server-paginated endpoint and tenant RBAC',()=>{
  const part=controller.split('@Get("legal/assessments/table")')[1].split('@Get("legal")')[0];
  assert.match(part,/requireCapability\(this\.db,req,"legal\.manage"\)/);
  assert.match(part,/organizationId:org\.id/);
  assert.match(part,/assessment\.count\(\{where\}\)/);
  assert.match(part,/skip:pg\.skip,take:pg\.take/);
  assert.match(part,/paged\(items\.map/);
});
test('WS4B: privacy filters are validated against supported lifecycle states',()=>{
  assert.match(controller,/allowed=\["DRAFT","PREPARATION","REVIEW","READY","ACTIVE","CLOSED","ARCHIVED"\]/);
  assert.match(controller,/search=\(q\?\?""\)\.trim\(\)\.slice\(0,120\)/);
  assert.match(privacy,/states\.includes\(sp\.status\?\?""\)/);
  assert.match(privacy,/query=\{\{q,status\}\}/);
});
test('WS4B: existing legal summary contract remains default; lightweight view is opt-in',()=>{
  assert.match(controller,/@Get\("legal"\) async legal/);
  assert.match(controller,/assessmentsMode==="none"\?Promise\.resolve\(\[\]\)/);
  assert.match(privacy,/assessments=none/);
  assert.match(privacy,/\/v1\/workspace\/legal\/assessments\/table/);
});
test('WS4B: support filters apply at PostgreSQL query and keep tenant guard',()=>{
  const part=support.split('async workspaceQueuePage(')[1].split('async workspaceQueue(')[0];
  assert.match(part,/requireCapability\(this\.db,req,"support\.use"\)/);
  assert.match(part,/organizationId:ctx\.organization\.id/);
  assert.match(part,/supportTicket\.count\(\{where\}\)/);
  assert.match(part,/findMany\(\{where,skip:pg\.skip,take:pg\.take/);
  assert.match(part,/where\.OR=\[/);
  assert.match(part,/allowed\.includes\(input\.status\)/);
});
test('WS4B: support filters propagate from HTTP to page and through pagination',()=>{
  assert.match(supportController,/@Query\("q"\)q\?:string,@Query\("status"\)status\?:string/);
  assert.match(supportController,/page,pageSize,q,status/);
  assert.match(ticketPage,/name="q"/);
  assert.match(ticketPage,/name="status"/);
  assert.match(ticketPage,/query=\{\{q,status\}\}/);
});
test('WS4B: global counters remain unfiltered and empty states distinguish filters',()=>{
  assert.match(support,/where:workspaceSupportTicketScope\(ctx\),select:\{lastInternalReplyAt/);
  assert.match(ticketPage,/No tickets match the filters/);
  assert.match(privacy,/No assessments match these filters/);
});
