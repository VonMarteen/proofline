import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const source = read('apps/web/components/workspace-nav.tsx');
const workspaceCss = read('apps/web/app/workspace.css');
const controlCss = read('apps/control/app/backoffice.css');
let location = '/es';
const element = (type, props, key) => ({ type, props: props ?? {}, key });
const compiled = ts.transpileModule(source, {
  fileName: 'workspace-nav.tsx',
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, isolatedModules: true },
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
  getCanonicalFileName: f => f, getCurrentDirectory: () => '.', getNewLine: () => '\n',
}));
const scope = {
  exports: {},
  require(name) {
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    if (name === 'next/link') return { __esModule: true, default: 'Link' };
    if (name === 'next/navigation') return { usePathname: () => location };
    if (name === '@proofline/ui') return { Icon: 'Icon' };
    throw new Error('Unexpected import: ' + name);
  },
};
vm.runInNewContext(compiled.outputText, scope, { filename: 'workspace-nav.cjs' });
const { WorkspaceNav } = scope.exports;
const descendants = (x, predicate, result = []) => {
  if (Array.isArray(x)) { for (const n of x) descendants(n, predicate, result); return result; }
  if (x === null || x === undefined || typeof x !== 'object') return result;
  if (predicate(x)) result.push(x);
  descendants(x.props?.children, predicate, result);
  return result;
};
const view = (role = 'OWNER', locale = 'es', path = '/es') => {
  location = path;
  return WorkspaceNav({ role, locale });
};
const links = x => descendants(x, node => node.type === 'Link');
const groups = x => descendants(x, node => node.type === 'section');
const headings = x => descendants(x, node => typeof node.props?.className === 'string' && node.props.className.includes('workspace-nav-group-title')).map(x => x.props.children);
const suffixes = xs => xs.map(x => x.props.href.replace(/^\/(es|en)/, '')).sort();

test('WS5 visual: syntax transpiles without errors and control/workspace styles are independent', () => {
  assert.ok(source.includes('"use client"'));
  assert.match(controlCss, /control-main \.bo-section,[\s\S]*control-main \.control-panel,[\s\S]*control-main \.card/);
  assert.match(controlCss, /border-top-color: var\(--border-strong\)/);
  assert.doesNotMatch(controlCss.slice(controlCss.lastIndexOf('WS5-FINAL'), controlCss.indexOf('/* UI-01 ·', controlCss.lastIndexOf('WS5-FINAL'))), /scrollbar|overflow|height|padding|width\s*:/i);
});

test('Workspace: OWNER retains all ten original routes and categorized labels', () => {
  const v = view();
  assert.deepEqual(suffixes(links(v)), ['', '/assessments', '/billing', '/branding', '/directory', '/legal', '/library', '/reports', '/support', '/team']);
  assert.deepEqual(headings(v), ['GENERAL', 'ASSESSMENTS', 'ORGANIZACIÓN', 'GESTIÓN']);
  assert.equal(groups(v).length, 4);
});

test('Workspace: no inaccessible or empty groups for BILLING_ADMIN and VIEWER', () => {
  assert.deepEqual(suffixes(links(view('BILLING_ADMIN'))), ['', '/billing', '/support']);
  assert.deepEqual(headings(view('BILLING_ADMIN')), ['GENERAL', 'GESTIÓN']);
  assert.deepEqual(suffixes(links(view('VIEWER'))), ['', '/assessments', '/reports', '/support']);
  assert.deepEqual(headings(view('VIEWER')), ['GENERAL', 'ASSESSMENTS', 'GESTIÓN']);
});

test('Workspace: ADMIN cannot see billing or branding; still sees allowed navigation', () => {
  assert.deepEqual(suffixes(links(view('ADMIN'))), ['', '/assessments', '/directory', '/legal', '/library', '/reports', '/support', '/team']);
});

test('Workspace: English categories and original links retain localization', () => {
  const v = view('OWNER', 'en', '/en');
  assert.deepEqual(headings(v), ['GENERAL', 'ASSESSMENTS', 'ORGANIZATION', 'MANAGEMENT']);
  assert.equal(links(v).find(x => x.props.href === '/en/billing').props.children[1].props.children, 'Plan and billing');
});

test('Workspace: active route inside group retains aria-current and nested detail matching', () => {
  const v = view('OWNER', 'es', '/es/assessments/abc');
  assert.equal(links(v).find(x => x.props.href === '/es/assessments').props['aria-current'], 'page');
  const matchedGroup = groups(v).find(x => x.props.className.includes('is-active'));
  assert.equal(matchedGroup.props['aria-label'], 'ASSESSMENTS');
  assert.equal(links(v).filter(x => x.props['aria-current'] === 'page').length, 1);
  assert.equal(links(view('OWNER', 'es', '/es')).find(x => x.props.href === '/es').props['aria-current'], 'page');
});

test('Workspace: desktop scroll only on link navigation, headers and footer stay outside', () => {
  assert.match(workspaceCss, /workspace-sidebar>\.workspace-nav\{[^}]*overflow-y:auto/);
  const start = workspaceCss.slice(workspaceCss.lastIndexOf('WS5-FINAL'));
  assert.doesNotMatch(start, /(?:scrollbar-width|scrollbar-color|::-webkit-scrollbar|overflow-y\s*:)/);
  assert.match(start, /workspace-mobile-nav \.workspace-nav-group/);
  assert.match(start, /focus-visible/);
});

test('No business/API changes are required for the two visual changes', () => {
  assert.equal(descendants(view('OWNER'), x => x.type === 'Link').length, 10);
  assert.match(source, /roles === "ALL" \|\| link.roles.includes\(role\)/);
  assert.match(source, /href=\{link.href\}/);
});
