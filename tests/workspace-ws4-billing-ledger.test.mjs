import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Load the tiny pure TypeScript helper on Node 20 without a TS runtime loader.
// The transformed function is the actual production source, not a duplicate fixture.
const helperSource=readFileSync(new URL('../apps/api/src/common/workspace-usage-query.ts',import.meta.url),'utf8');
const runtimeHelper=helperSource.replace('organizationId: string, filters: {period?: string; eventType?: string; billable?: string}', 'organizationId, filters').replace('export function workspaceUsageWhere','function workspaceUsageWhere');
if(runtimeHelper===helperSource||runtimeHelper.includes('export function workspaceUsageWhere'))throw new Error('WS4 helper signature unexpectedly changed');
const workspaceUsageWhere=Function(`${runtimeHelper}\nreturn workspaceUsageWhere`)();
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('WS4: tenant scope is mandatory even when filtering period, type and billing',()=>{
 assert.deepEqual(workspaceUsageWhere('org-1',{period:'2026-10',eventType:'RESPONSE_COMPLETED',billable:'false'}),{organizationId:'org-1',periodKey:'2026-10',eventType:'RESPONSE_COMPLETED',billable:false});
 assert.deepEqual(workspaceUsageWhere('org-2',{billable:'true'}),{organizationId:'org-2',billable:true});
 assert.deepEqual(workspaceUsageWhere('org-3',{}),{organizationId:'org-3'});
});
test('WS4: invalid month, event type and boolean rejected before Prisma',()=>{
 for(const filters of [{period:'2026-13'},{period:'Oct 2026'},{eventType:'deleted OR true'},{eventType:'a'.repeat(100)},{billable:'1'},{billable:'yes'}]){
  assert.throws(()=>workspaceUsageWhere('org-1',filters),/Invalid/);
 }
});
test('WS4: API reads permission and applies identical filter to count and page query',()=>{
 const source=read('apps/api/src/workspace.controller.ts');
 const section=source.slice(source.indexOf('@Get("billing/usage/table")'),source.indexOf('private async capacity('));
 assert.match(section,/requireCapability\(this\.db,req,"billing\.view"\)/);
 assert.match(section,/workspaceUsageWhere\(org\.id,\{period,eventType,billable\}\)/);
 assert.match(section,/usageEvent\.count\(\{where\}\)/);
 assert.match(section,/usageEvent\.findMany\(\{where,skip:pg\.skip,take:pg\.take/);
 assert.match(section,/return paged\(items,total,pg\.page,pg\.pageSize\)/);
});
test('WS4: billing page retains pagination values and filters when paging',()=>{
 const s=read('apps/web/app/[locale]/billing/page.tsx');
 assert.match(s,/\.\.\.usageFilters/);
 assert.match(s,/query=\{\{invoicePage,invoicePageSize,\.\.\.usageFilters\}\}/);
 assert.match(s,/query=\{\{usagePage,usagePageSize,\.\.\.usageFilters\}\}/);
 assert.match(s,/name="billable"/);
 assert.match(s,/name="period"/);
 assert.match(s,/name="eventType"/);
});
test('WS4: role-limited financial view unchanged and no Control style touched',()=>{
 const s=read('apps/web/app/[locale]/billing/page.tsx');
 assert.match(s,/if \(!data\.visible\)/);
 assert.match(s,/PaymentMethodManager/);
});
