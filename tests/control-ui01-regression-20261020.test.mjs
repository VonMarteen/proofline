import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("UI-01 regression: canonical colored scrollbars have no local Chromium overrides", () => {
  const css = read("apps/control/app/backoffice.css");
  const tokens = read("packages/design-tokens/base.css");
  assert.match(tokens, /--scrollbar-thumb-a:/);
  assert.match(tokens, /background:linear-gradient\(180deg,var\(--scrollbar-thumb-a\),var\(--scrollbar-thumb-b\)\)/);
  assert.doesNotMatch(css, /\.control-shell\s+::-webkit-scrollbar/);
  assert.doesNotMatch(css, /html:has\(\.control-shell\).*scrollbar-width/);
  assert.doesNotMatch(css, /\.control-sidebar[^\n]*scrollbar-color:/);
  assert.match(read("apps/control/app/globals.css"), /\.control-sidebar\s*\{\s*position:\s*sticky;[^}]*overflow-y:\s*auto;/);
});

test("UI-01 regression: dashboard KPI uses truly compact icon-and-content grid only within Dashboard", () => {
  const css = read("apps/control/app/backoffice.css");
  const scope = ".bo-dashboard>.bo-kpi-grid .bo-kpi";
  assert.ok(css.includes(scope));
  assert.match(css, /\.bo-dashboard>\.bo-kpi-grid \.bo-kpi\{\s*position:relative;display:grid;/);
  assert.match(css, /align-items:center;min-height:78px;padding:10px 13px/);
  assert.match(css, /\.bo-dashboard>\.bo-kpi-grid \.bo-kpi-top\{/);
  assert.match(css, /\.bo-dashboard>\.bo-kpi-grid \.bo-kpi>strong\{/);
  assert.match(css, /\.control-system-kpis\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(read("apps/control/app/[locale]/page.tsx"), /className="bo-kpi-grid"/);
});

test("UI-01 regression: React keys remain stable in old and newly-paged tables", () => {
 for (const page of ["communications", "security", "legal"]) {
   const src = read(`apps/control/app/[locale]/${page}/page.tsx`);
   assert.match(src, /import \{ Fragment \} from "react";/);
   assert.doesNotMatch(src, /cells:\[<>/);
   assert.match(src, /<Fragment key="/);
   const starts = (src.match(/<Fragment key="[^"]+">/g) ?? []).length;
   const ends = (src.match(/<\/Fragment>/g) ?? []).length;
   assert.equal(starts, ends, `${page}: missing fragment closing tag`);
 }
 for(const page of ["security","privacy","legal"]){
   const src=read(`apps/control/app/[locale]/${page}/page.tsx`);
   assert.match(src, /<tr key=\{(?:a|r|x)\.id\}/);
 }
 const shared = read("apps/control/components/records-table.tsx");
 assert.match(shared, /<tr key=\{r\.id\}/);
 assert.match(shared, /<td key=\{i\}>/);
});

test("UI-01 regression: data and permission code not changed by visual hotfix", () => {
  const nav = read("apps/control/components/control-nav.tsx");
  assert.match(nav, /prefetch=\{false\}/);
  const tbl = read("apps/control/components/records-table.tsx");
  assert.match(tbl, /filterVisibleRecords\(/);
  assert.match(tbl, /paginateVisibleRecords\(/);
});
