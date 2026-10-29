import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const page = read('apps/web/app/[locale]/assessments/[id]/page.tsx');
const population = read('apps/web/components/population-editor.tsx');
const question = read('apps/web/components/question-editor.tsx');
const css = read('apps/web/app/assessment-detail-r4.css');
const layout = read('apps/web/app/layout.tsx');

test('R4: styles load after original Workspace and R3 layers', () => {
  assert.ok(layout.indexOf('workspace.css') < layout.indexOf('workspace-enterprise-r3.css'));
  assert.ok(layout.indexOf('workspace-enterprise-r3.css') < layout.indexOf('assessment-detail-r4.css'));
});
test('R4: code is restricted to assessment detail route', () => {
  assert.match(css, /\.workspace-content \.workspace-assessment-detail-page/);
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g,'').split('{');
  // No free-standing global selector in the new stylesheet.
  for (const fragment of declarations.slice(0, -1)) {
    const beforeLast = fragment.split('}').pop().trim();
    if (!beforeLast || beforeLast.startsWith('@media')) continue;
    for (const selector of beforeLast.split(',')) {
      assert.match(selector.trim(), /(?:^|\s)\.workspace-assessment-detail-page\b/, `Unscoped selector: ${selector}`);
    }
  }
});
test('R4: questionnaire fields and submission retained', () => {
  assert.match(question, /form className="assessment-question-form" onSubmit=\{add\}/);
  assert.match(question, /<TypeConfig type=\{draft\.type\}/);
  assert.match(question, /<AdvancedConfig state=\{draft\}/);
  assert.match(question, /\/v1\/assessments\/\$\{assessmentId\}\/questions`/);
  assert.match(question, /const ok=await requestProoflineConfirmation/);
});
test('R4: composer uses full-width prompt and parallel configuration', () => {
  assert.match(css, /\.assessment-question-form > label\.label:first-child\s*\{[^}]*grid-column:1 \/ -1/);
  assert.match(css, /\.assessment-question-form > \.builder-primary-row\s*\{[^}]*grid-column:1/);
  assert.match(css, /\.assessment-question-form > \.type-config\s*\{[^}]*grid-column:2/);
});
test('R4: population includes both units and people in one conceptual section', () => {
  assert.match(page, /assessment-population-section/);
  assert.match(page, /Población del assessment/);
  assert.match(population, /population-targets/);
  assert.match(population, /population-browser/);
  assert.match(css, /grid-template-columns:minmax\(0, \.95fr\) minmax\(0,1\.05fr\)/);
});
test('R4: inclusion/exclusion and preview/save APIs are unchanged', () => {
  assert.match(population, /unitIds: all \? \[\] : units, personIds: all \? \[\] : people, excludePersonIds: exclude/);
  assert.match(population, /\/population\/preview/);
  assert.match(population, /\/population`, \{ method: "POST"/);
  assert.match(population, /requestProoflineConfirmation\(\{ title: es \? "Guardar población"/);
  assert.match(population, /if \(response\.ok\) router\.refresh\(\)/);
});
test('R4: privacy comes after population, full-width, retains legal data', () => {
  assert.ok(page.indexOf('assessment-population-section') < page.indexOf('assessment-privacy-section'));
  assert.match(page, /LegalProfileEditor assessmentId=\{id\} locale=\{l\} noticeLocale=\{participantLocale\} initial=\{a\.legalProfile\}/);
  assert.match(page, /locked&&a\.legalProfile/);
  assert.match(page, /participant-notice-summary/);
});
test('R4: isolated responsive arrangements exist', () => {
  assert.match(css, /@media\(max-width:1150px\)/);
  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /@media\(max-width:530px\)/);
  assert.match(css, /\.population-person-list\s*\{[^}]*max-height:300px/);
});
test('R4: launch checklist has intentional spacing and visible next actions', () => {
  assert.match(css, /\.launch-checklist\s*\{[^}]*padding:11px 0/);
  assert.match(css, /\.assessment-governance > \.workspace-card-actions/);
  assert.match(page, /AssessmentActions id=\{id\} status=\{a\.status\}/);
});
