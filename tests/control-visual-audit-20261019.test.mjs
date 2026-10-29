import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Intervals and chart indicators navigate with Next.js Link without page reload',()=>{
 const s=read('apps/control/components/backoffice-ui.tsx');
 assert.match(s,/import Link from "next\/link"/);
 assert.match(s,/return <Link href=\{`\$\{href\}\?\$\{q\}`\}/);
 assert.match(s,/ranges\.map\(r=><Link/);
 assert.doesNotMatch(s,/ranges\.map\(r=><a/);
});

test('Sidebar does not eagerly prefetch all data-heavy routes',()=>{
 const nav=read('apps/control/components/control-nav.tsx');
 assert.doesNotMatch(nav,/prefetch=\{true\}/);
 assert.match(nav,/prefetch=\{false\}/);
});

test('Table footer rows stay left and counts are above table on right',()=>{
 const s=read('apps/control/app/backoffice.css');
 assert.match(s,/control-table-wrap:has\(> \.proofline-pagination\)/);
 assert.match(s,/\.proofline-pagination-summary\{position:absolute;right:16px;top:7px/);
 assert.match(s,/\.proofline-pagination-size\{order:1;/);
 for(const page of ['customers','subscriptions'])assert.match(read(`apps/control/app/[locale]/${page}/page.tsx`),/className="control-table-wrap"/);
});

test('Recent processes use backend filters and server side pagination',()=>{
 const s=read('apps/control/app/[locale]/system/page.tsx');
 for(const field of ['jobsPage','jobsPageSize','jobStatus','jobType'])assert.match(s,new RegExp(field));
 assert.match(s,/<PaginationBar pagination=\{ops\.jobsPagination\}/);
 assert.match(s,/controlGet\(`\/v1\/control\/tables\/operations\?\$\{qs\}`\)/);
});

test('Legal forms and internal-user creation are responsive aligned forms',()=>{
 const s=read('apps/control/app/backoffice.css');
 assert.match(s,/control-grid-2:has\(\.control-retention-policy-list\)/);
 assert.match(s,/\.control-hold-form>button\{min-width:98px/);
 assert.match(s,/\.control-internal-user-form\{grid-template-columns:/);
});

test('Error boundary distinguishes API HTTP errors, permission failure and timeouts',()=>{
 const s=read('apps/control/app/[locale]/error.tsx');
 for(const field of ['"403"','"401"','timeout','noConnection','safeDiagnostic'])assert.ok(s.includes(field));
});

test('Dashboard slow probes emit timing evidence without logging sensitive values',()=>{
 const s=read('apps/api/src/control/backoffice.service.ts');
 assert.match(s,/dashboardStartedAt=Date\.now\(\)/);
 assert.match(s,/dashboard slow response: \$\{dashboardDurationMs\}ms/);
 assert.match(s,/period:\{range:w\.range/);
});

test('Communications use equal columns with independently scrollable lists',()=>{
 assert.match(read('apps/control/app/[locale]/communications/page.tsx'),/control-communications-grid/);
 assert.match(read('apps/control/app/backoffice.css'),/\.control-communications-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
