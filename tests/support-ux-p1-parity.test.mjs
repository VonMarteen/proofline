import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const shell = read('apps/support/components/support-shell.tsx');
const nav = read('apps/support/components/support-nav.tsx');
const queue = read('apps/support/app/[locale]/page.tsx');
const css = read('apps/support/app/support-ux-p1-parity.css');
const layout = read('apps/support/app/layout.tsx');
const supportLayout = read('apps/support/app/[locale]/layout.tsx');
const originalActions = read('apps/support/app/actions.ts');
const ref = read('apps/web/app/workspace-r8-parity.css');

test('P1 only imports its scoped CSS after the two existing stylesheets', () => {
  assert.match(layout, /import "\.\/globals\.css";\s*import "\.\/preferences\.css";\s*import "\.\/support-ux-p1-parity\.css";/);
  assert.match(css, /html\[data-proofline-surface="support"\]\[data-theme="dark"\]/);
  assert.match(css, /html\[data-proofline-surface="support"\]\[data-theme="light"\]/);
  assert.doesNotMatch(css, /@import[^\n]*control|@import[^\n]*workspace/);
});
test('P1 navigation keeps same four destinations and their view keys', () => {
  for (const href of ['`/${locale}`', '`/${locale}?view=mine`', '`/${locale}?view=unassigned`', '`/${locale}/history`']) assert.ok(nav.includes(href), href);
  assert.match(nav, /usePathname\(\)/);
  assert.match(nav, /useSearchParams\(\)/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(nav, /is-active/);
  assert.match(css, /\.support-nav-group\.is-active/);
  assert.match(ref, /\.workspace-sidebar \.workspace-nav-group\.is-active/);
});
test('P1 does not alter Support authentication or data mutations', () => {
  assert.match(supportLayout, /supportSessionToken\(\)/);
  assert.match(supportLayout, /isSupportRole\(identity\.role\)/);
  for (const fn of ['addSupportMessage','assignSupportTicket','requestSupportInformation','updateAccountChangeStatus','updateTicketStatus']) assert.ok(originalActions.includes(fn), fn);
  assert.doesNotMatch(css, /fetch\(|\.post\(|\.put\(|\.delete\(/);
});
test('P1 maintains same queue endpoint, query and live server metrics', () => {
  assert.match(queue, /supportGet\(`\/v1\/control\/tables\/support\?\$\{qs\}`\)/);
  assert.match(queue, /page: q\.page \?\? "1", pageSize: q\.pageSize \?\? "25"/);
  for (const key of ['d.metrics.open','d.metrics.unassigned','d.metrics.overdue','d.metrics.resolved','d.metrics.saturationRisk']) assert.ok(queue.includes(key));
  for (const key of ['t.sla.overdue','t.assignee','t.organization.name','t.status','t.id','t._count.messages']) assert.ok(queue.includes(key));
});
test('P1 retains server-side PaginationBar and all five filters', () => {
  assert.match(queue, /<PaginationBar pagination=\{d\.pagination\} basePath=\{`\/\$\{locale\}`\} query=\{\{ view \}\} locale=\{locale\}/);
  for (const v of ['open','mine','unassigned','overdue','all']) assert.ok(queue.includes(`view === "${v}"`));
  assert.match(css, /\.proofline-pagination-size/);
  assert.match(css, /\.proofline-pagination-nav/);
});
test('P1 renders four real metrics and the same R8 horizontal icon-value rhythm', () => {
  for (const icon of ['support','people','clock','check-circle']) assert.ok(queue.includes(`icon: "${icon}"`));
  assert.match(queue, /metrics\.map\(metric =>/);
  assert.match(css, /grid-template-columns:34px minmax\(0,1fr\) auto/);
  assert.match(css, /\.support-metric-icon/);
  assert.match(css, /font-variant-numeric:tabular-nums/);
});
test('P1 keeps the mobile navigation usable, not hidden with desktop sidebar', () => {
  assert.match(shell, /<div className="support-mobile-nav"><SupportNav locale=\{locale\} \/><\/div>/);
  assert.match(css, /@media \(max-width:980px\)/);
  assert.match(css, /\.support-sidebar \{ display:none; \}/);
  assert.match(css, /\.support-mobile-nav \{ display:block;/);
  assert.match(css, /\.support-mobile-nav \.support-nav a/);
  assert.match(css, /scrollbar-width:thin/);
});
test('P1 keeps theme, locale, realtime and sign-out as working components', () => {
  for (const c of ['ConfirmActionProvider','SupportRealtime','LocaleSwitch','ThemeToggle','SupportLogoutButton']) assert.ok(shell.includes(`<${c} `) || shell.includes(`<${c}>`), c);
  assert.match(shell, /preferenceKey="proofline-support-theme"/);
  assert.match(shell, /preferenceKey="proofline-support-locale"/);
});
