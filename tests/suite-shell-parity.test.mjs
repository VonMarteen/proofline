import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const ws = read("apps/web/app/suite-shell-parity.css");
const sp = read("apps/support/app/suite-shell-parity.css");
const control = read("apps/control/app/globals.css");

test("Control remains reference: existing 274px shell / 64px header", () => {
  assert.match(control, /\.control-shell\{grid-template-columns:274px minmax\(0,1fr\)\}/);
  assert.match(control, /\.control-header\{min-height:64px;padding:11px 30px\}/);
});
test("Both product sidebars use 274px and Control header 64px", () => {
  assert.match(ws, /\.workspace-shell \{ grid-template-columns:274px minmax\(0,1fr\); \}/);
  assert.match(ws, /\.workspace-header \{ height:64px; min-height:64px; padding:11px 30px;/);
  assert.match(sp, /\.support-shell \{ grid-template-columns:274px minmax\(0,1fr\); \}/);
  assert.match(sp, /min-height:64px; height:64px; padding:11px 30px;/);
});
test("Loaded last: parity CSS never overrides earlier R8 or P1 in import order", () => {
  const w = read("apps/web/app/layout.tsx");
  const s = read("apps/support/app/layout.tsx");
  assert.ok(w.indexOf('"./workspace-r8-parity.css"') < w.indexOf('"./suite-shell-parity.css"'));
  assert.ok(s.indexOf('"./support-ux-p1-parity.css"') < s.indexOf('"./suite-shell-parity.css"'));
});
test("Workspace accessible brand remains home link and header reflects current organization", () => {
  const app = read("apps/web/components/app-shell.tsx");
  assert.match(app, /<Link className="workspace-brand" href=\{`\/\$\{locale\}`\}><Brand \/><span aria-hidden="true">WORKSPACE<\/span><\/Link>/);
  assert.match(app, /<span className="workspace-header-sub">\{organization\.name\}<\/span>/);
  assert.match(app, /<WorkspaceNav locale=\{locale\} role=\{identity\.role\} \/>/);
  assert.match(app, /<LogoutButton locale=\{locale\} \/>/);
});
test("No business logic imports or routes changed in the parity CSS", () => {
  for (const css of [ws,sp]) {
    assert.doesNotMatch(css, /@import|url\(|javascript:|display:\s*none\s*!important/i);
    assert.match(css, /@media/);
  }
  assert.match(read("apps/support/components/support-shell.tsx"), /<SupportNav locale=\{locale\} \/>/);
  assert.match(read("apps/support/components/support-shell.tsx"), /<SupportRealtime locale=\{locale\} \/>/);
});
test("Responsive fallbacks and reduced-motion accommodations preserved", () => {
  assert.match(ws, /max-width:850px/);
  assert.match(sp, /max-width:900px/);
  assert.match(ws, /prefers-reduced-motion:reduce/);
  assert.match(sp, /prefers-reduced-motion:reduce/);
});
test("Parity stylesheets remain scoped to their respective client shells", () => {
  assert.doesNotMatch(ws, /\.control-shell\b|\.control-header\b/);
  assert.doesNotMatch(sp, /\.workspace-shell\b|\.workspace-header\b/);
  assert.match(control, /\.control-shell/);
  assert.ok(!read("apps/control/app/layout.tsx").includes("suite-shell-parity.css"));
});
