#!/usr/bin/env node
/**
 * G1 laboratorio de fallos aislado: ejecuta METODOS REALES compilados a memoria,
 * con dobles de Prisma. No conecta a DB ni altera el proyecto.
 * Un resultado REPRODUCIDO prueba vulnerabilidad de la ruta simulada,
 * NO prueba que haya sucedido en la BD del usuario.
 */
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const require=createRequire(import.meta.url);
function typescript(){try{return require('typescript');}catch{const n=spawnSync('npm',['root','-g'],{encoding:'utf8',timeout:5000});if(n.status===0)return require(join(n.stdout.trim(),'typescript'));throw Error('Instalar dependencias antes del laboratorio: pnpm install');}}
const noop=()=>{};
class Problem extends Error{}
const decorator=()=>noop;
const chain=new Proxy({}, {get:(_,key)=>key==='parse'?(value)=>value:()=>chain});
const z=new Proxy({}, {get:()=>()=>chain});
const stubs={
  '@nestjs/common': new Proxy({BadRequestException:Problem,ConflictException:Problem,NotFoundException:Problem,Injectable:decorator,Inject:decorator,Controller:decorator,UseGuards:decorator,Get:decorator,Post:decorator,Delete:decorator,Param:decorator,Req:decorator,Body:decorator,Query:decorator},{get:(obj,key)=>obj[key]??decorator}),
  'zod':{z},
  '../audit/audit.service.js':{AuditService:class{}},
  '../database/prisma.service.js':{PrismaService:class{}},
  '../auth/access-control.js':{requireCapability:async()=>({identity:{email:'test-owner@example.invalid'}}),permittedAssessmentIds:async()=>({}),requireAnyResultRead:async()=>{}},
  '../auth/dev-auth.js':{ClientDevAuthGuard:class{},identityFrom:()=>({email:'test-owner@example.invalid'})},
  '../security/crypto.js':{decryptText:value=>value,randomPseudonym:()=> 'pseudonym',sha256:value=>value},
  './assessments.service.js':{AssessmentsService:class{}},
  './population-snapshot.js':{buildPopulationSnapshot:()=>({cohortFields:[]}),participantSegments:()=>({})},
  './scoring-contract.js':{defaultScoredForType:()=>true,normalizeAssessmentScoringConfig:()=>({}),normalizeQuestionScoring:()=>({}),questionCode:()=>''},
  '../security/crypto.js':{decryptText:value=>value,randomPseudonym:()=> 'pseudonym',sha256:value=>value},
  './pdf.js':{buildProoflinePdf:()=>Buffer.from(''),snapshotHash:()=> 'stub-hash'},
  './report-contract.js':{normalizeReportLevel:v=>v,legacyReportKind:v=>v==='L1_EXECUTIVE'?'EXECUTIVE':'FULL',reportLevelLabel:()=>'',reportDepth:()=>1,isReportEnvelope:()=>false},
};
function loadClass(file,className){
 const ts=typescript();const source=readFileSync(join(root,file),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}});
 const out={};const sandbox={exports:out,module:{exports:out},require:(id)=>stubs[id]??(id.startsWith('node:')?require(id):new Proxy({}, {get:()=>noop})),Buffer,console,Date,process,setTimeout,clearTimeout};
 runInNewContext(compiled.outputText,sandbox,{filename:file,timeout:10000});
 if(typeof out[className]!=='function')throw Error('No export encontrado: '+className);return out[className];
}
export async function probeReportApproval(){
 const Klass=loadClass('apps/api/src/reports/report.service.ts','ReportService');
 let status='DISTRIBUTED';const auditEvents=[];
 const db={report:{update:async({data})=>{status=data.status;return {id:'r1',status};}}};
 const svc=new Klass(db,{record:async event=>auditEvents.push(event)});
 svc.get=async()=>({id:'r1',status,assessmentId:'a1',assessment:{organizationId:'org'},level:'L1_EXECUTIVE',version:1,snapshotHash:'hash'});
 let error=null;try{await svc.approve('r1','tester')}catch(e){error=e.message;}
 return {id:'G1-FAULT-H2',reproduced:status==='APPROVED'&&auditEvents.length===1&&!error,description:'Un informe DISTRIBUTED puede volver a APPROVED',observedStatus:status,error};
}
export async function probeReportVersionRace(){
 const Klass=loadClass('apps/api/src/reports/report.service.ts','ReportService');
 const rows=[];let reads=0,unlock;const latch=new Promise(r=>unlock=r);
 const db={analysisRun:{findFirst:async()=>({result:{dimensionScores:{leadership:74}}})},report:{findMany:async()=>{const snapshot=rows.map(x=>({...x}));if(++reads===2)unlock();await latch;return snapshot;},create:async({data})=>{const row={id:'r'+(rows.length+1),...data};rows.push(row);return row;}},assessment:{findUniqueOrThrow:async()=>({organizationId:'org'})}};
 const svc=new Klass(db,{record:async()=>{}});svc.canonicalSnapshot=async()=>({participation:{completed:6},assessment:{title:'test'}});
 const settled=await Promise.allSettled([svc.generate('a1','L1_EXECUTIVE'),svc.generate('a1','L1_EXECUTIVE')]);
 return {id:'G1-FAULT-H3',reproduced:settled.every(x=>x.status==='fulfilled')&&rows.length===2&&rows[0].version===rows[1].version,description:'Dos generaciones concurrentes reciben la misma versión',versions:rows.map(r=>r.version),errors:settled.filter(x=>x.status==='rejected').map(x=>String(x.reason).slice(0,150))};
}
export async function probeCloseFailure(){
 const Klass=loadClass('apps/api/src/assessments/assessments.controller.ts','AssessmentsController');
 let status='ACTIVE';
 const a={id:'a1',organizationId:'org',status,launchedVersion:null,locale:'es',minCohortSize:5,questions:[{id:'q1'}]};
 const db={assessment:{update:async({data})=>{status=data.status;return {status}}},analysisRun:{create:async()=>{throw Error('simulated AnalysisRun insert failure')}}};
 const svc={get:async()=>({...a,status})};const controller=new Klass(svc,db,{record:async()=>{}});
 let rejected=false;try{await controller.status({headers:{}},'a1',{status:'CLOSED'})}catch{rejected=true;}
 return {id:'G1-FAULT-H1-CLOSE',reproduced:rejected&&status==='CLOSED',description:'Cierre persiste aunque falle la creación de AnalysisRun',assessmentStatus:status};
}
export async function probeLaunchLedgerFailure(){
 const Klass=loadClass('apps/api/src/assessments/assessments.controller.ts','AssessmentsController');
 let status='READY';
 const assessment={id:'a1',organizationId:'org',status,level:'L1',title:'Test',privacyMode:'ANONYMOUS',legalProfile:{dataFields:{}},locale:'es',minCohortSize:5};
 const rows=[{locale:'es',emailEncrypted:'test@example.invalid'}];const version={id:'version1',version:1};let usageAttempted=0;
 const tx={participant:{count:async()=>0,create:async()=>({})},outboxEvent:{create:async()=>({})}};
 const db={$transaction:async fn=>fn(tx),usageEvent:{create:async()=>{usageAttempted++;throw Error('simulated UsageEvent insert failure')}},assessment:{update:async({data})=>{status=data.status;return {status}}}};
 const svc={get:async()=>({...assessment,status}),launchChecklist:async()=>({canLaunch:true,missing:[]}),resolvePopulation:async()=>rows,freezeVersion:async()=>version};
 const controller=new Klass(svc,db,{record:async()=>{}});
 let error=null;try{await controller.status({headers:{}},'a1',{status:'ACTIVE'})}catch(e){error=e.message;}
 return {id:'G1-FAULT-H1-LAUNCH',reproduced:status==='ACTIVE'&&usageAttempted===1&&!error,description:'Lanzamiento queda ACTIVE aunque falla UsageEvent',assessmentStatus:status,error};
}
export async function runLab(){const checks=[];for(const fn of [probeReportApproval,probeReportVersionRace,probeCloseFailure,probeLaunchLedgerFailure]){try{checks.push(await fn())}catch(e){checks.push({id:fn.name,status:'LAB_ERROR',error:String(e).slice(0,180),reproduced:false});}}
 const report={schema:'proofline-g1-faultlab-v1',timestamp:new Date().toISOString(),mode:'IN_MEMORY_MOCKS_NO_DATABASE_WRITES',certified:false,checks};
 const folder=join(root,'.runtime','g1');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'latest-faultlab.json'),JSON.stringify(report,null,2));for(const x of checks)console.log(`[${x.reproduced?'REPRODUCIDO':'NO_REPRODUCIDO'}] ${x.id} · ${x.description??x.error}`);console.log('Pruebas con dobles: no tocan PostgreSQL ni equivalen a prueba E2E.');return report;}
if(process.argv[1]&&import.meta.url===new URL(`file://${resolve(process.argv[1]).replace(/\\/g,'/')}`).href)await runLab();
