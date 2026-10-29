import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseAnalysisCandidate, isAnalysisPending } from '../scripts/check-services-analysis-policy.mjs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('services smoke selects CLOSED over ACTIVE', () => {
  assert.equal(chooseAnalysisCandidate([{ id:'open', status:'ACTIVE' },{id:'closed',status:'CLOSED'}])?.id, 'closed');
});
test('services smoke may select ARCHIVED but never DRAFT or ACTIVE', () => {
  assert.equal(chooseAnalysisCandidate([{id:'draft',status:'DRAFT'},{id:'archived',status:'ARCHIVED'}])?.id,'archived');
  assert.equal(chooseAnalysisCandidate([{id:'draft',status:'DRAFT'},{id:'open',status:'ACTIVE'}]),null);
});
test('unavailable input does not produce eligible target', () => {
  assert.equal(chooseAnalysisCandidate(null),null);
  assert.equal(chooseAnalysisCandidate([]),null);
  assert.equal(chooseAnalysisCandidate([{status:'CLOSED'}]),null);
});
test('pending runs should be polled, not duplicated', () => {
  for(const state of ['PENDING','PROCESSING','RUNNING'])assert.equal(isAnalysisPending({status:state}),true);
  assert.equal(isAnalysisPending({status:'FAILED'}),false);
  assert.equal(isAnalysisPending(null),false);
});
test('service checker never prioritizes an active assessment and reports skipped E2E honestly', () => {
  const file=read('../scripts/check-services.mjs');
  assert.doesNotMatch(file,/\.find\(x=>x\.status==='ACTIVE'\)/);
  assert.match(file,/chooseAnalysisCandidate\(assessments\)/);
  assert.match(file,/if\(!candidate\)\{/);
  assert.match(file,/\[PENDIENTE\]/);
  assert.match(file,/No se certifica Worker \+ Analytics/);
});
test('Control nav preserves sidebar scroll ownership and theme while adding right-side breathing space', () => {
  const file=read('../apps/control/app/backoffice.css');
  assert.match(file,/\.control-sidebar>\.control-nav\{[^\n]*overflow-y:auto;[^\n]*padding:0 12px 0 3px\}/);
  assert.doesNotMatch(file,/\.control-sidebar>\.control-nav\{[^\n]*scrollbar-color/);
});
test('Workspace nav preserves existing scroll ownership and theme while adding right-side breathing space', () => {
  const file=read('../apps/web/app/workspace.css');
  assert.match(file,/\.workspace-sidebar>\.workspace-nav\{[^\n]*overflow-y:auto;[^\n]*padding:0 12px 0 3px\}/);
  assert.doesNotMatch(file,/\.workspace-sidebar>\.workspace-nav\{[^\n]*scrollbar-color/);
});
