import { chooseAnalysisCandidate, isAnalysisPending } from "./check-services-analysis-policy.mjs";

const clientHeaders = { "x-proofline-user": "ana@acme.local", "x-proofline-role": "OWNER" };
const internalHeaders = { "x-proofline-user": "owner@armar.local", "x-proofline-role": "INTERNAL_PLATFORM_OWNER" };

const checks = [
  { name:'Web comercial', url:'http://localhost:4200/es' },
  { name:'Login Workspace', url:'http://localhost:4202/login?locale=es' },
  { name:'Participante UI', url:'http://localhost:4203/es/demo-token-2026' },
  { name:'Login Proofline Control', url:'http://localhost:4204/login?locale=es' },
  { name:'Login Proofline Support', url:'http://localhost:4205/login?locale=es' },
  { name:'API liveness', url:'http://127.0.0.1:4201/health/live', json:true, validate:x=>x?.ok===true && x?.status==='live' },
  { name:'API + PostgreSQL', url:'http://127.0.0.1:4201/health', json:true, validate:x=>x?.ok===true && x?.database==='ready' },
  { name:'API Dashboard real', url:'http://127.0.0.1:4201/v1/dashboard?locale=es', headers:clientHeaders, json:true, validate:x=>Boolean(x?.organization?.slug && Array.isArray(x?.activeAssessments) && typeof x?.summary?.teamMembers==='number') },
  { name:'API Workspace team', url:'http://127.0.0.1:4201/v1/workspace/team', headers:clientHeaders, json:true, validate:x=>Array.isArray(x?.members) && x.members.length>0 },
  { name:'API Workspace library', url:'http://127.0.0.1:4201/v1/workspace/frameworks', headers:clientHeaders, json:true, validate:x=>Array.isArray(x) && x.length>0 && Boolean(x[0]?.latestVersion?.objective) },
  { name:'Control API liveness', url:'http://127.0.0.1:4206/health/live', json:true, validate:x=>x?.ok===true && x?.status==='live' },
  { name:'Control API + PostgreSQL', url:'http://127.0.0.1:4206/health', json:true, validate:x=>x?.ok===true && x?.database==='ready' },
  { name:'API Control real', url:'http://127.0.0.1:4206/v1/control/overview', headers:internalHeaders, json:true, validate:x=>typeof x?.counts?.organizations==='number' },
  { name:'API Participante real', url:'http://127.0.0.1:4201/v1/respond/demo-token-2026?locale=es', json:true, validate:x=>Boolean(x?.id && Array.isArray(x?.questions) && x.questions.length>0) },
  { name:'API Legal real', url:'http://127.0.0.1:4201/v1/legal/public', json:true, validate:x=>Array.isArray(x) && x.length>0 },
  { name:'Analytics', url:'http://localhost:4281/health', json:true, validate:x=>x?.ok===true },
  { name:'Mailpit', url:'http://localhost:4280' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function attempt(c) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 2500);
  try {
    let headers={...(c.headers??{})};
    const response = await fetch(c.url, { signal: controller.signal, headers, redirect:'follow' });
    let bodyText=''; let parsed;
    if (c.json || c.validateHtml || !response.ok) {
      bodyText = await response.text();
      if (c.json) { try { parsed=JSON.parse(bodyText); } catch {} }
    }
    const statusOk = response.status >= 200 && response.status < 400;
    const semanticOk = (!c.validate || c.validate(parsed)) && (!c.validateHtml || c.validateHtml(bodyText));
    return { ok: statusOk && semanticOk, status:response.status, bodyText, parsed };
  } catch (error) { return { ok:false, status:null, error }; }
  finally { clearTimeout(timer); }
}

console.log('\nPROOFLINE · Comprobación estricta + smoke test semántico\n');
console.log('Esperando hasta 20 s por servicio para evitar falsos fallos durante el arranque...\n');
let failed = 0;
for (const c of checks) {
  let result;
  for (let i=0; i<10; i++) { result = await attempt(c); if (result.ok) break; await sleep(2000); }
  if (result?.ok) { console.log(`[OK]    ${c.name.padEnd(24)} ${c.url}  (${result.status})`); continue; }
  failed++;
  const detail = result?.bodyText || (result?.error instanceof Error ? result.error.message : 'sin respuesta');
  console.log(`[FALLO] ${c.name.padEnd(24)} ${c.url}  (${result?.status ?? 'fetch failed'})${detail ? `\n        ${String(detail).slice(0,700)}` : ''}`);
}


async function verifyTrustZoneIsolation(){
  const clientControl=await fetch('http://127.0.0.1:4201/v1/control/overview',{headers:internalHeaders});
  if(clientControl.status!==404)throw new Error(`client API exposed Control route: HTTP ${clientControl.status}`);
  const controlWorkspace=await fetch('http://127.0.0.1:4206/v1/workspace/team',{headers:clientHeaders});
  if(controlWorkspace.status!==404)throw new Error(`Control API exposed Workspace route: HTTP ${controlWorkspace.status}`);
  const clientInternalAuth=await fetch('http://127.0.0.1:4201/v1/auth/internal/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  if(clientInternalAuth.status!==404)throw new Error(`client API exposed internal auth route: HTTP ${clientInternalAuth.status}`);
  return true;
}
try{await verifyTrustZoneIsolation();console.log(`[OK]    ${'Trust-zone isolation'.padEnd(24)} client API != Control API`);}catch(error){failed++;console.log(`[FALLO] ${'Trust-zone isolation'.padEnd(24)} ${error instanceof Error?error.message:String(error)}`);}

async function verifyAnalysisPipeline(){
  const list=await fetch('http://127.0.0.1:4201/v1/assessments',{headers:clientHeaders}).then(async r=>{if(!r.ok)throw new Error(`assessments ${r.status}: ${await r.text()}`);return r.json()});
  const assessments=Array.isArray(list)?list.filter(x=>x?.id):[];
  if(!assessments.length)throw new Error('no assessment available for analysis pipeline');
  const valid=x=>x?.status==='COMPLETED'&&x?.result&&Object.keys(x.result.dimensionScores??{}).length>0&&Array.isArray(x.result.highlights)&&!String(x.result.highlights[0]??'').includes('strongest measured dimension');
  const latestUrl=id=>`http://127.0.0.1:4201/v1/assessments/${encodeURIComponent(id)}/analysis-runs/latest`;
  const readLatest=async id=>fetch(latestUrl(id),{headers:clientHeaders}).then(async r=>r.ok?r.json():null);
  const candidate=chooseAnalysisCandidate(assessments);
  // Existing completed evidence is safe to read even when an assessment is still active.
  // Creating a new run, however, is permitted only for CLOSED/ARCHIVED assessments.
  let latest=null;
  if(candidate){
    latest=await readLatest(candidate.id);
    if(valid(latest))return {assessmentId:candidate.id,dimensions:Object.keys(latest.result.dimensionScores).length};
  }
  for(const item of assessments){
    if(item.id===candidate?.id)continue;
    const existing=await readLatest(item.id);
    if(valid(existing))return {assessmentId:item.id,dimensions:Object.keys(existing.result.dimensionScores).length};
  }
  if(!candidate){
    return {skipped:true,reason:'No hay assessment CLOSED/ARCHIVED accesible. No se ha iniciado ningún análisis sobre un assessment abierto; ejecutar pnpm pilot:check para certificar Worker + Analytics E2E.'};
  }
  if(!isAnalysisPending(latest)){
    const start=await fetch(`http://127.0.0.1:4201/v1/assessments/${encodeURIComponent(candidate.id)}/analysis-runs`,{method:'POST',headers:{...clientHeaders,'content-type':'application/json'},body:'{}'});
    if(!start.ok)throw new Error(`analysis start ${start.status}: ${await start.text()}`);
  }
  for(let i=0;i<20;i++){
    await sleep(1000);
    latest=await readLatest(candidate.id);
    if(latest?.status==='COMPLETED'||latest?.status==='FAILED')break;
  }
  if(!valid(latest))throw new Error(`analysis pipeline did not produce valid localized results: ${JSON.stringify(latest).slice(0,500)}`);
  return {assessmentId:candidate.id,dimensions:Object.keys(latest.result.dimensionScores).length};
}

let pendingSmoke=0;
try{
  const pipeline=await verifyAnalysisPipeline();
  if(pipeline.skipped){pendingSmoke++;console.log(`[PENDIENTE] ${'Worker + Analytics'.padEnd(24)} ${pipeline.reason}`);}
  else console.log(`[OK]    ${'Worker + Analytics'.padEnd(24)} assessment=${pipeline.assessmentId} · dimensions=${pipeline.dimensions}`);
}catch(error){
  failed++;
  console.log(`[FALLO] ${'Worker + Analytics'.padEnd(24)} ${error instanceof Error?error.message:String(error)}`);
}

console.log('\nLos enlaces anteriores son clicables desde la terminal integrada de VS Code.');
if (failed) { console.log(`Hay ${failed} comprobación(es) fallidas. El smoke test distingue UI, API, DI, login local y datos reales.`); process.exitCode = 1; }
else if (pendingSmoke) { console.log(`Servicios consultados correctos; ${pendingSmoke} comprobación(es) E2E pendientes por falta de fixture elegible. No se certifica Worker + Analytics; ejecutar pnpm pilot:check.`); }
else { console.log('Todo Proofline responde y los flujos principales, incluido Workspace cliente autenticado, devuelven datos válidos.'); }
