#!/usr/bin/env node
/** G1: diagnóstico de invariantes, solo lectura. Hallazgos ABIERTOS no equivalen a certificación. */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const src=(path)=>readFileSync(join(root,path),'utf8');
const methods=(text,name,next)=>{const a=text.indexOf(name);if(a<0)throw Error(`No se encuentra ${name}`);return text.slice(a,next?text.indexOf(next,a+name.length):undefined);};
export function inspectSources({assessment,report,schema}){
  const status=methods(assessment,'async status(', '@Post(":id/analysis-runs")');
  const run=methods(assessment,'async run(', '\n}\n\nfunction defaultQuestionConfig');
  const gen=methods(report,'async generate(', 'async list(');
  const approve=methods(report,'async approve(', 'async view(');
  const launch=status.slice(status.indexOf('if (value.status === "ACTIVE")'),status.indexOf('if (value.status === "ACTIVE" && !frozenVersion)'));
  const close=status.slice(status.indexOf('if (value.status === "CLOSED")'),status.indexOf('await this.audit.record({ organizationId: a.organizationId',status.indexOf('if (value.status === "CLOSED")')));
  const guards=[
    {id:'G1-H1-LAUNCH',title:'Lanzamiento + participantes + consumo + estado + auditoría atómicos',pass:!(/usageEvent\.create\([\s\S]*?\.catch\(\(\) => undefined\)/.test(launch))&&/tx\.usageEvent\.(create|upsert)/.test(launch)&&/tx\.assessment\.(update|updateMany)/.test(launch)&&/tx\.auditEvent\.create/.test(launch),evidence:'assessments.controller.ts / status ACTIVE; uso y estado dentro de la transacción, sin catch silencioso'},
    {id:'G1-H1-CLOSE',title:'Cierre + AnalysisRun + Outbox + auditoría atómicos',pass:/\$transaction\(/.test(close)&&/tx\.assessment\.(update|updateMany)/.test(close)&&/tx\.analysisRun\.create/.test(close)&&/tx\.outboxEvent\.create/.test(close)&&/tx\.auditEvent\.create/.test(close),evidence:'assessments.controller.ts / status CLOSED'},
    {id:'G1-H1-MANUAL',title:'Ejecución manual + outbox + auditoría atómicos',pass:/\$transaction\(/.test(run)&&/tx\.analysisRun\.create/.test(run)&&/tx\.outboxEvent\.create/.test(run)&&/tx\.auditEvent\.create/.test(run),evidence:'assessments.controller.ts / run'},
    {id:'G1-H2',title:'Aprobación solo desde DRAFT, protección concurrente y auditoría atómica',pass:/\$transaction\(/.test(approve)&&/tx\.report\.updateMany/.test(approve)&&/status:\s*["']DRAFT["']/.test(approve)&&/tx\.auditEvent\.create/.test(approve),evidence:'report.service.ts / approve'},
    {id:'G1-H3',title:'Versiones de informes serializadas por assessment + persistencia y auditoría atómicas',pass:/\$transaction\(/.test(gen)&&(/FOR UPDATE/i.test(gen)||/pg_advisory_xact_lock/.test(gen))&&/tx\.report\.findMany/.test(gen)&&/tx\.report\.create/.test(gen)&&/tx\.auditEvent\.create/.test(gen),evidence:'report.service.ts / generate'},
  ];
  return guards.map(({pass,...p})=>({...p,status:pass?'CODE_GUARD_PRESENT':'OPEN'}));
}
export function summaryFor(checks){const open=checks.filter(x=>x.status==='OPEN').length;return {status:open?'NOT_CERTIFIED_OPEN_FINDINGS':'CODE_GUARDS_PRESENT_DB_E2E_PENDING',open,codeGuardsPresent:checks.length-open,certified:false};}
async function main(){const checks=inspectSources({assessment:src('apps/api/src/assessments/assessments.controller.ts'),report:src('apps/api/src/reports/report.service.ts'),schema:src('apps/api/prisma/schema.prisma')});const output=join(root,'.runtime','g1');mkdirSync(output,{recursive:true});const summary=summaryFor(checks);const baseline=join(root,'.runtime','g0','latest-baseline.json');const dbcopy=join(root,'.runtime','g0','latest-db-backup.json');const report={schema:'proofline-g1-diagnostic-v1',createdAt:new Date().toISOString(),...summary,g0BaselinePresent:existsSync(baseline),g0DbBackupPresent:existsSync(dbcopy),checks};writeFileSync(join(output,'latest.json'),JSON.stringify(report,null,2));for(const item of checks)console.log(`[${item.status==='OPEN'?'ABIERTO':'GUARDA'}] ${item.id}: ${item.title}`);console.log(`G1: ${summary.status}. ${summary.open} defectos estructurales pendientes de cerrar.`);console.log(`G0 código: ${report.g0BaselinePresent?'presente':'PENDIENTE'}, copia PostgreSQL: ${report.g0DbBackupPresent?'presente':'PENDIENTE'}`);console.log('El código inspeccionado NO ha sido modificado. El resultado G1 NO es una certificación E2E.');if(process.argv.includes('--require-pass')&&summary.open)process.exitCode=2;}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
