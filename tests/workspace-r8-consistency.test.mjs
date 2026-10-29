import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const privacy=read('apps/web/app/[locale]/legal/page.tsx');
const directory=read('apps/web/components/directory-manager.tsx');
const nav=read('apps/web/components/workspace-nav.tsx');
const style=read('apps/web/app/workspace-r8-parity.css');
const root=read('apps/web/app/layout.tsx');

test('R8 imports a scoped CSS layer after R7',()=>{
 assert.match(root,/import "\.\/workspace-r7-kpi-exclusion\.css";\s*import "\.\/workspace-r8-parity\.css";/);
 assert.doesNotMatch(style,/\bbody\s*\{|\bhtml\s*\{/);
});
test('Privacy indicators show four existing server-derived values with a meaningful icon each',()=>{
 assert.equal((privacy.match(/className="ws-r8-privacy-kpi"/g)||[]).length,4);
 for(const key of ['records.approvedCount','d.legalHolds.length','d.documents.length','d.retentionPolicies.length'])assert.ok(privacy.includes(`{${key}}`));
 for(const icon of ['approved','lock','reports','governance'])assert.ok(privacy.includes(`name="${icon}"`));
 assert.match(style,/privacy-overview\.ws-r8-privacy-overview/);
});
test('Directory retains its GET filters and non-mutating query actions',()=>{
 assert.match(directory,/method="get" action=\{`\/\$\{locale\}\/directory`\}/);
 for (const name of ['name="q"','name="unit"','name="page"','name="pageSize"'])assert.ok(directory.includes(name),name);
 assert.match(directory,/type="submit"/);
 assert.match(style,/grid-template-columns:minmax\(185px,1\.55fr\) minmax\(150px,\.82fr\) auto/);
});
test('All directory toolbar inputs, select, and buttons share exactly the same height',()=>{
 assert.match(style,/height:38px; min-height:38px; max-height:38px;/);
 assert.match(style,/:is\(\.input,\.select,\.btn\)/);
 assert.match(style,/box-sizing:border-box/);
 assert.match(style,/max-width:690px/);
});
test('Workspace nav keeps existing role filters and client route links',()=>{
 assert.match(nav,/const allowed = all\.filter\(link => link\.roles === "ALL" \|\| link\.roles\.includes\(role\)\)/);
 assert.match(nav,/\bactiveGroup = links\.some/);
 assert.match(nav,/workspace-nav-group\$\{activeGroup \? " is-active" : ""\}/);
 assert.match(nav,/aria-current=\{active \? "page" : undefined\}/);
 assert.match(style,/\.workspace-sidebar \.workspace-nav-group\.is-active/);
 assert.match(style,/\.workspace-nav-group-items > a\.active/);
});
test('Navigation frame is exclusive to desktop sidebar and preserves scrolling',()=>{
 assert.doesNotMatch(style,/\.workspace-mobile-nav \.workspace-nav-group\.is-active/);
 assert.match(read('apps/web/app/workspace.css'),/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
});
test('R8 is presentational: no requests, persistence, state, or authentication edits',()=>{
 assert.doesNotMatch(style,/fetch\(|localStorage|POST|DELETE|PATCH/);
 assert.match(privacy,/apiGet\(`\/v1\/workspace\/legal\?locale=/);
 assert.match(directory,/await post\("\/v1\/workspace\/directory\/people"/);
});
test('Privacy KPI respects 2-column tablet and 1-column narrow view',()=>{
 assert.match(style,/max-width:900px[\s\S]*?privacy-overview\.ws-r8-privacy-overview \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(style,/max-width:480px[\s\S]*?privacy-overview\.ws-r8-privacy-overview \{grid-template-columns:minmax\(0,1fr\)/);
});
