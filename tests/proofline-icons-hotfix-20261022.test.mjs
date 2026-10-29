import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shared=read('packages/ui/src/client.tsx');
const css=read('packages/design-tokens/base.css');
const support=read('apps/support/components/support-login-preferences.tsx');
const theme=shared.slice(shared.indexOf('export function ThemeToggle('),shared.indexOf('export function LocaleSwitch('));
const locale=shared.slice(shared.indexOf('export function LocaleSwitch('),shared.indexOf('// Backward-compatible'));
test('Theme uses only SVG, preserving theme preference, aria-label and tooltip',()=>{
 assert.match(theme,/<ThemeIcon size=\{17\}[^>]+aria-hidden="true"\/>/);
 assert.doesNotMatch(theme,/>\{labels\[pref\]\}\s*<\/button>/);
 assert.match(theme,/persistTheme\(cycle,key\)/);
 assert.match(theme,/aria-label=\{hint\} title=\{hint\}/);
 assert.match(theme,/data-proofline-utility="theme"/);
});
test('Locale uses only SVG preserving route and preference',()=>{
 assert.match(locale,/<Languages size=\{17\}[^>]+aria-hidden="true"\/>/);
 assert.doesNotMatch(locale,/>\{next\.toUpperCase\(\)\}\s*<\/Link>/);
 assert.match(locale,/parts\[1\]=next/);
 assert.match(locale,/localStorage\.setItem\(key,next\)/);
 assert.match(locale,/data-proofline-utility="locale"/);
});
test('Legacy visible labels are suppressed by a narrowly targeted fallback, not by global button styling',()=>{
 assert.match(css,/a\.proofline-utility-button,button\.proofline-utility-button\s*\{[^}]*font-size:0!important/s);
 assert.match(css,/a\.proofline-utility-button svg,button\.proofline-utility-button svg\s*\{[^}]*width:17px/s);
 const fragment=css.slice(css.indexOf('/* PROOFLINE UI-ICONS-FIX'));
 assert.doesNotMatch(fragment,/scrollbar-(?:width|color)|::-webkit-scrollbar/);
 assert.doesNotMatch(fragment,/\.btn\s*\{/);
});
test('Support login no longer renders language code in button and retains route and cookie',()=>{
 assert.match(support,/<Icon name="languages" size=\{17\} \/>/);
 assert.match(support,/import \{ Icon \} from "@proofline\/ui"/);
 assert.doesNotMatch(support,/\{next\.toUpperCase\(\)\}/);
 assert.match(support,/href=\{`\/login\?locale=\$\{next\}`\}/);
 assert.match(support,/localStorage\.setItem\("proofline-support-locale", next\)/);
 assert.match(support,/aria-label=/);
});
test('Only intended components and CSS are in patch scope',()=>{
 for(const module of [theme,locale]){assert.match(module,/proofline-utility-button/);assert.match(module,/title=\{hint\}/)}
});
