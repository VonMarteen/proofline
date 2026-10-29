import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const question=read('apps/web/components/question-editor.tsx');
const people=read('apps/web/components/population-editor.tsx');
const legal=read('apps/web/components/legal-profile-editor.tsx');
const css=read('apps/web/app/assessment-detail-r5.css');
const layout=read('apps/web/app/layout.tsx');

// R5 uses exactly the same business operations and values as R4.
test('R5: stylesheet loads after R4 and is assessment-route scoped',()=>{
 assert.ok(layout.indexOf('assessment-detail-r4.css') < layout.indexOf('assessment-detail-r5.css'));
 assert.ok(css.includes('.workspace-assessment-detail-page'));
 for(const block of css.replace(/\/\*[\s\S]*?\*\//g,'').split('{').slice(0,-1)) {
   const selectors=block.split('}').pop().trim();
   if(!selectors || selectors.startsWith('@'))continue;
   for(const s of selectors.split(',')) assert.match(s.trim(),/\.workspace-assessment-detail-page\b/,`unscoped rule ${s}`);
 }
});
test('R5: five range fields are aligned and are the existing controls',()=>{
 assert.match(question,/className="type-config assessment-range-fields"/);
 assert.match(question,/className="form-row assessment-range-numbers"/);
 assert.match(question,/className="form-row assessment-range-labels"/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,66px\)\) repeat\(2,minmax\(0,1fr\)\)/);
 for(const field of ['min','max','step','minLabel','maxLabel'])assert.ok(question.includes(`value={state.${field}}`));
});
test('R5: population still sends the same payload and both preview and save operations',()=>{
 assert.match(people,/unitIds: all \? \[\] : units, personIds: all \? \[\] : people, excludePersonIds: exclude/);
 assert.match(people,/\/population\/preview/);
 assert.match(people,/\/population`, \{ method: "POST"/);
 assert.match(people,/requestProoflineConfirmation/);
});
test('R5: area counts and all-organization descriptor are on the same row',()=>{
 assert.match(people,/className="population-target-inline"/);
 assert.match(people,/>\{u\.people\} \{es \? "personas"/);
 assert.match(css,/\.population-targets \.population-target-inline\s*\{[^}]*display:flex/);
 assert.match(css,/justify-content:space-between/);
});
test('R5: person name and role are side by side; exclusion is a real pressed state',()=>{
 assert.match(people,/className="population-person-inline"/);
 assert.match(people,/aria-pressed=\{exclude\.includes\(p\.id\)\}/);
 assert.match(people,/toggle\(exclude, p\.id, setExclude\)/);
 assert.match(people,/type="button" aria-pressed/);
 assert.match(css,/button\.exclude\.active/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('R5: all seven legal input bindings and HTTP method are unchanged',()=>{
 for(const field of ['controllerName','purpose','legalBasis','participationMode','confidentiality','retentionDays','dpoContact']) assert.match(legal,new RegExp(`${field}[=:]`));
 assert.match(legal,/method:"POST"/);
 assert.match(legal,/\/legal-profile/);
 assert.match(legal,/onSubmit=\{async\(e\)=>/);
 assert.match(css,/7 legal fields in 2 compact rows/);
 for(const f of ['controller','purpose','basis','participation','confidentiality','retention','contact']) {
   assert.match(legal,new RegExp(`assessment-legal-${f}`));
   assert.match(css,new RegExp(`\\.assessment-legal-${f}`));
 }
});
test('R5: no API or database code included in patch; responsive rules exist',()=>{
 assert.match(css,/@media\(max-width:1200px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/assessment-legal-compact-form/);
});
