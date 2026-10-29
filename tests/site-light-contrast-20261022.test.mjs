import test from 'node:test'; import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const css=read('apps/site/app/commercial-light-polish.css');
test('Light home styles are limited to explicit light and system light, dark does not inherit overrides',()=>{
 const pre=css.split('@media (prefers-color-scheme: light)')[0].replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=[...pre.matchAll(/(^|})\s*([^{}]+)\{/g)].map(m=>m[2].trim());
 assert.ok(selectors.length>15);
 assert.ok(selectors.every(s=>s.split(',').every(piece=>piece.trim().startsWith(':root[data-theme="light"]'))));
 assert.match(css,/:root:not\(\[data-theme\]\)/);
 assert.doesNotMatch(css,/:root\[data-theme="dark"\]/);
});
test('Trust text, hero and process palette are legible and distinct in light',()=>{
 for(const x of ['.pl2-trust-copy h2','.pl2-trust-list p','.pl2-process','.pl2-card p','.pl2-hero'])assert.ok(css.includes(x));
 assert.match(css,/color:#f2fcfd/);
 assert.match(css,/color:#344b59/);
 assert.match(css,/background:#e9f3f2/);
});
test('Page uses final light stylesheet only in public site root',()=>{
 const root=read('apps/site/app/layout.tsx');assert.ok(root.indexOf('commercial-light-polish.css')>root.indexOf('commercial-final-v6.css'));
});
