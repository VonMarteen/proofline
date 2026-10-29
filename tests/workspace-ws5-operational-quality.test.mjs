import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contract,readChecks,run} from '../scripts/workspace-ws5-readonly-smoke.mjs';
const source = path => readFileSync(new URL(path,import.meta.url),'utf8');
const analysis=source('../apps/web/components/analysis-runner.tsx');
const actions=source('../apps/web/components/assessment-actions.tsx');
const pkg=JSON.parse(source('../package.json'));

test('WS-5: polling serializado sin setInterval ni rechazos no gestionados',()=>{
  assert.match(analysis,/setTimeout\(poll,1500\)/);
  assert.doesNotMatch(analysis,/setInterval\(/);
  assert.match(analysis,/if\(!stopped\)timer=setTimeout\(poll,1500\)/);
  assert.match(analysis,/catch\s*\{/);
  assert.match(analysis,/clearTimeout\(timer\)/);
});
test('WS-5: polling conserva el GET de latest y no genera ejecuciones',()=>{
  assert.match(analysis,/analysis-runs\/latest/);
  assert.match(analysis,/method:"POST"/);
  assert.match(analysis,/Recalcular análisis/);
  assert.match(analysis,/setRun\(latest\)/);
});
test('WS-5: error de red al solicitar análisis devuelve el botón a estado normal',()=>{
  assert.match(analysis,/No se pudo conectar\. Comprueba el estado del análisis/);
  assert.match(analysis,/finally\s*\{setBusy\(false\)\}/);
});
test('WS-5: acciones de assessment evitan escritura duplicada simultánea',()=>{
  assert.match(actions,/requestInFlight\.current/);
  assert.match(actions,/if\(requestInFlight\.current\)return/);
  assert.match(actions,/finally\{requestInFlight\.current=false;setBusy\(false\)\}/);
});
test('WS-5: errores de red en transiciones tienen feedback ES/EN',()=>{
  assert.match(actions,/No se pudo conectar\. Comprueba el estado del assessment/);
  assert.match(actions,/Connection failed\. Check the assessment state/);
  assert.match(actions,/setMsg\(Array\.isArray\(payload\?\.message\)/);
});
test('WS-5: controles desactivados durante escritura y se preserva readiness',()=>{
  assert.match(actions,/disabled=\{busy\}/);
  assert.match(actions,/disabled=\{busy\|\|\(s==="ACTIVE"&&!canLaunch\)\}/);
  assert.match(actions,/checklist\?\.canLaunch/);
});
test('WS-5: smoke local usa solo GET en loopback sin credenciales de producción',()=>{
  assert.ok(readChecks.length >= 9);
  for(const item of readChecks){
    assert.equal(new URL(item.url).hostname,'127.0.0.1');
    assert.equal(typeof contract[item.schema],'function');
  }
  const src=source('../scripts/workspace-ws5-readonly-smoke.mjs');
  assert.doesNotMatch(src,/method:\s*['"]POST['"]|method:\s*['"]DELETE['"]|method:\s*['"]PATCH['"]/);
});
test('WS-5: validadores rechazan respuestas vacías no verificables',()=>{
  for(const name of Object.keys(contract))assert.equal(Boolean(contract[name]({})),false,name);
});
test('WS-5: tablas exigen recuentos reales y tamaño de página entero',()=>{
  assert.equal(contract.assessments({items:[],pagination:{total:0,pageSize:25}}),true);
  assert.equal(contract.assessments({items:[],pagination:{total:'0',pageSize:25}}),false);
  assert.equal(contract.support({items:[],pagination:{total:0,pageSize:25},activeCount:0,unreadCount:0}),true);
  assert.equal(contract.support({items:[],pagination:{total:0,pageSize:25}}),false);
});
test('WS-5: peticiones simuladas prueban lectura, autenticación y validación',async()=>{
  const payloads={
    health:{ok:true,database:'ready'},dashboard:{organization:{slug:'acme'},summary:{},activeAssessments:[]},
    assessments:{items:[],pagination:{total:0,pageSize:25}},reports:{items:[],pagination:{total:0,pageSize:25}},
    privacy:{retentionPolicies:[],documents:[]},privacyTable:{items:[],pagination:{total:0,pageSize:25}},
    support:{items:[],pagination:{total:0,pageSize:25},activeCount:0,unreadCount:0},
    billing:{visible:false,capacity:{used:0}},team:{members:[]},
  };
  let calls=0;
  const logs=[];
  const fail=await run({print:msg=>logs.push(msg),request:async (url,opts)=>{
    calls++;
    assert.equal(opts.method??'GET','GET');
    const check=readChecks.find(c=>c.url===url);
    if(check){if(check.auth)assert.equal(opts.headers['x-proofline-role'],'OWNER');return {ok:true,json:async()=>payloads[check.schema]};}
    return {status:307};
  }});
  assert.equal(fail,0);assert.equal(calls,11);
  assert.ok(logs.some(x=>x.includes('lecturas locales OK')));
});
test('WS-5: errores HTTP no producen falsa certificación',async()=>{
  const logs=[];
  const fail=await run({print:msg=>logs.push(msg),request:async()=>({ok:false,status:503})});
  assert.ok(fail>0);assert.ok(logs.some(x=>x.includes('NO CERTIFICADO')));
});
test('WS-5: scripts de certificación separados, sin cambiar arranque',()=>{
  assert.equal(pkg.scripts['workspace:ws5:check'],'node --test tests/workspace-ws5-operational-quality.test.mjs');
  assert.equal(pkg.scripts['workspace:ws5:smoke'],'node scripts/workspace-ws5-readonly-smoke.mjs');
  assert.equal(pkg.scripts.dev,'node scripts/dev-all.mjs');
});
