#!/usr/bin/env node
/** G1 snapshot de integridad PostgreSQL. Solo SELECT, BEGIN READ ONLY, ROLLBACK. */
import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const localURL='postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline';
const dbURL=process.env.PROOFLINE_DATABASE_URL??localURL;
let uri;
try{uri=new URL(dbURL);}catch{console.error('[PENDIENTE] URL DB inválida');process.exit(2);}
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]','::1'].includes(uri.hostname)){
  console.error('[BLOQUEADO] G1 lectura de DB permite únicamente PostgreSQL local.');process.exit(2);
}
let Client;
try{const requireApi=createRequire(join(root,'apps/api/package.json'));({Client}=requireApi('pg'));}
catch{console.error('[PENDIENTE] Dependencia pg no disponible. Ejecutar tras pnpm install.');process.exit(2);}
const client=new Client({connectionString:dbURL,connectionTimeoutMillis:6000,query_timeout:12000,application_name:'proofline_g1_read_only'});
let connected=false,transaction=false;
const checks=[
  {id:'G1-D1',title:'Assessments activos/cerrados sin evento de lanzamiento',sql:`SELECT COUNT(*)::integer n FROM "Assessment" a LEFT JOIN "UsageEvent" u ON u."idempotencyKey" = ('assessment-launch:' || a.id) WHERE a."launchedAt" IS NOT NULL AND a.status::text IN ('ACTIVE','CLOSED','ARCHIVED') AND u.id IS NULL`},
  {id:'G1-D2',title:'Assessments CLOSED sin AnalysisRun',sql:`SELECT COUNT(*)::integer n FROM "Assessment" a WHERE a.status::text='CLOSED' AND NOT EXISTS (SELECT 1 FROM "AnalysisRun" r WHERE r."assessmentId"=a.id)`},
  {id:'G1-D3',title:'Versiones de informe duplicadas por nivel lógico',sql:`SELECT COUNT(*)::integer n FROM (SELECT "assessmentId", COALESCE("snapshot"->>'level', CASE WHEN kind::text='EXECUTIVE' THEN 'L1_EXECUTIVE' ELSE 'L4_STRATEGIC' END) level, version FROM "Report" GROUP BY 1,2,3 HAVING COUNT(*)>1) t`},
  {id:'G1-D4',title:'Informes aprobados sin evidencia de aprobación',sql:`SELECT COUNT(*)::integer n FROM "Report" r WHERE r.status::text IN ('APPROVED','DISTRIBUTED') AND NOT EXISTS (SELECT 1 FROM "AuditEvent" au WHERE au."targetId"=r.id AND au.action='REPORT_APPROVED')`},
  {id:'G1-D5',title:'AnalysisRun PENDING sin evento RUN_ANALYSIS aún disponible',sql:`SELECT COUNT(*)::integer n FROM "AnalysisRun" r WHERE r.status::text='PENDING' AND NOT EXISTS (SELECT 1 FROM "OutboxEvent" o WHERE o.type::text='RUN_ANALYSIS' AND o.payload->>'analysisRunId'=r.id)`},
];
let report={schema:'proofline-g1-db-readonly-v1',createdAt:new Date().toISOString(),mode:'TRANSACTION_READ_ONLY',certified:false,checks:[]};
try{
  await client.connect();connected=true;await client.query('BEGIN TRANSACTION READ ONLY');transaction=true;
  await client.query("SET LOCAL statement_timeout='10000ms'");
  for(const check of checks){const result=await client.query(check.sql);const n=Number(result.rows[0]?.n??0);report.checks.push({id:check.id,title:check.title,count:n,status:n===0?'NO_ANOMALY_OBSERVED':'INVESTIGATE'});console.log(`[${n?'REVISAR':'OK LECTURA'}] ${check.id}: ${n} hallazgo(s) · ${check.title}`);}
  report.status=report.checks.some(x=>x.count>0)?'DATA_ANOMALIES_TO_INVESTIGATE':'READONLY_DATA_CHECKS_PASS_E2E_PENDING';
}catch(e){report.status='PENDING_DB_CHECK';report.errorCode=e?.code??'QUERY_OR_CONNECTION_FAILURE';console.error('[PENDIENTE] Lectura local:',report.errorCode,'(sin publicar credenciales ni datos personales).');}
finally{if(transaction)try{await client.query('ROLLBACK');}catch{}if(connected)await client.end().catch(()=>{});}
const path=join(root,'.runtime','g1');mkdirSync(path,{recursive:true});writeFileSync(join(path,'latest-db-readonly.json'),JSON.stringify(report,null,2));console.log('G1 DB:',report.status,'· no modifica registros · no es piloto E2E');if(report.status==='PENDING_DB_CHECK')process.exitCode=2;
