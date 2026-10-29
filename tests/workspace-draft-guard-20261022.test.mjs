import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/web/components/legal-profile-editor.tsx',import.meta.url),'utf8');
test('legal editor compares every persisted field before leaving edit mode',()=>{
  for(const field of ['controllerName','purpose','legalBasis','participationMode','confidentiality','retentionDays','dpoContact','approve']) {
    assert.match(source,new RegExp(`const isDirty=[^\\n]*${field}`),`Missing dirty guard for ${field}`);
  }
});
test('close action cannot discard unsaved legal profile without confirmation',()=>{
  assert.match(source,/if\(isDirty\)\{[\s\S]*?await requestProoflineConfirmation\(/);
  assert.match(source,/if\(!discard\)return/);
  assert.match(source,/resetToSaved\(\)/);
  assert.match(source,/type="button" disabled=\{busy\} onClick=\{toggleEditor\}/);
});
test('save still posts the same payload to existing endpoint without API changes',()=>{
  assert.match(source,/\/v1\/assessments\/\$\{assessmentId\}\/legal-profile/);
  assert.match(source,/body:JSON\.stringify\(\{controllerName,purpose,legalBasis,participationMode,confidentiality,retentionDays:Number\(retentionDays\),dpoContact,approve,locale:participantLocale\}\)/);
});
