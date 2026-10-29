import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSteps, classifyStep, evaluateSummary, runGate } from '../scripts/workspace-ws5-gate.mjs';

test('Safe mode never executes a mutating command', () => {
  const steps = buildSteps();
  assert.equal(steps.length,3);
  assert.ok(steps.every(s=>s.writeRisk===false));
  assert.ok(steps.every(s=>s.command===process.execPath));
  assert.ok(steps.every(s=>s.args[0]==='--test' || s.args[0].includes('readonly')));
});
test('Full mode makes all writes explicit and never claims production certification', () => {
  const steps=buildSteps(true);
  assert.equal(steps.length,8);
  assert.deepEqual(steps.filter(s=>s.writeRisk).map(s=>s.id),['services','runtime','pilot']);
  assert.equal(evaluateSummary(steps.map(s=>({status:'PASS'})),true).productionCertified,false);
});
test('Tests never accept pending/not certified as PASS, even exit 0', () => {
  assert.equal(classifyStep({},0,'[PENDIENTE] No CLOSED assessment available'),'PENDING');
  assert.equal(classifyStep({},0,'[FALLO] Worker'),'PENDING');
  assert.equal(classifyStep({},0,'NO CERTIFICADO'),'PENDING');
  assert.equal(classifyStep({},0,'All checks OK'),'PASS');
  assert.equal(classifyStep({},1,'All checks OK'),'FAIL');
});
test('Read-only gate gives a non-production result when tests are green', async () => {
  const called=[];const reports=[];
  const report=await runGate({save:false,run:async s=>{called.push(s.id);return{exit:0,output:'ok'}},log:msg=>reports.push(msg)});
  assert.deepEqual(called,['ws5-visual','ws5-functional','ws5-readonly']);
  assert.equal(report.status,'READONLY_GATES_PASS');
  assert.equal(report.productionCertified,false);
});
test('Mixed E2E results cannot be shown as certified', async () => {
  const report=await runGate({save:false,full:true,run:async s=>({exit:0,output:s.id==='pilot'?'[PENDIENTE] worker not verified':'OK'}),log:()=>{}});
  assert.equal(report.status,'PENDING');
  assert.equal(report.pending,1);
  assert.equal(report.productionCertified,false);
});
test('Failure in build is reported and cannot be hidden by later passes', async()=>{
  const report=await runGate({save:false,full:true,run:async s=>({exit:s.id==='build'?2:0,output:''}),log:()=>{}});
  assert.equal(report.status,'FAIL');
  assert.equal(report.failed,1);
});
