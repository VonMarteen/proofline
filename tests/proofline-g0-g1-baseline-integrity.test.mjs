import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {zipUnpack} from '../scripts/proofline-g0.mjs';
import {inspectSources,summaryFor} from '../scripts/proofline-g1.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const read=x=>readFileSync(join(root,x),'utf8');
test('G0 captura realmente fuentes no Git y genera ZIP verificable',()=>{
  const folder=mkdtempSync(join(tmpdir(),'proofline-g0-test-'));
  try{
    mkdirSync(join(folder,'scripts'));mkdirSync(join(folder,'apps','api','src'),{recursive:true});mkdirSync(join(folder,'.github','workflows'),{recursive:true});
    mkdirSync(join(folder,'node_modules'),{recursive:true});
    copyFileSync(join(root,'scripts','proofline-g0.mjs'),join(folder,'scripts','proofline-g0.mjs'));
    writeFileSync(join(folder,'package.json'),'{"name":"fixture","type":"module"}');
    writeFileSync(join(folder,'apps','api','src','index.ts'),'export const real=42;');
    writeFileSync(join(folder,'.github','workflows','ci.yml'),'name: ci');
    writeFileSync(join(folder,'.env'),'PGPASSWORD=NO_COMPARTIR');
    writeFileSync(join(folder,'node_modules','excluded.js'),'module.exports=1;');
    const r=spawnSync(process.execPath,[join(folder,'scripts','proofline-g0.mjs')],{cwd:folder,encoding:'utf8',timeout:15000});
    assert.equal(r.status,0,r.stderr);
    const latest=JSON.parse(readFileSync(join(folder,'.runtime','g0','latest-baseline.json'),'utf8'));
    const members=zipUnpack(readFileSync(latest.archive));
    assert.equal(members.get('apps/api/src/index.ts').toString(),'export const real=42;');
    assert.equal(members.get('.github/workflows/ci.yml').toString(),'name: ci');
    assert.equal(members.has('.env'),false);
    assert.equal(members.has('node_modules/excluded.js'),false);
    assert.equal(members.has('_G0/manifest.json'),true);
    const v=spawnSync(process.execPath,[join(folder,'scripts','proofline-g0.mjs'),'--verify','--archive',latest.archive],{cwd:folder,encoding:'utf8'});
    assert.equal(v.status,0,v.stderr);
    assert.match(v.stdout,/0 discrepancias internas/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('G0 detects ZIP corruption via central-directory/CRC validation',()=>{
  assert.throws(()=>zipUnpack(Buffer.from('corrupt-file')),/central directory/);
});
test('G1 detects the actual open H1, H2, H3 guards from snapshot',()=>{
 const checks=inspectSources({assessment:read('apps/api/src/assessments/assessments.controller.ts'),report:read('apps/api/src/reports/report.service.ts'),schema:read('apps/api/prisma/schema.prisma')});
 assert.deepEqual(checks.map(x=>x.id),['G1-H1-LAUNCH','G1-H1-CLOSE','G1-H1-MANUAL','G1-H2','G1-H3']);
 assert.equal(checks.every(x=>x.status==='OPEN'),true,'La versión 23/10 aún presenta los cinco hallazgos auditados');
 assert.equal(summaryFor(checks).certified,false);
 assert.equal(summaryFor(checks).open,5);
});
test('G1 reports green code guards without ever declaring E2E certified',()=>{
 const checks=inspectSources({assessment:read('apps/api/src/assessments/assessments.controller.ts'),report:read('apps/api/src/reports/report.service.ts'),schema:read('apps/api/prisma/schema.prisma')});
 for(const c of checks)c.status='CODE_GUARD_PRESENT';
 const result=summaryFor(checks);
 assert.equal(result.open,0);
 assert.equal(result.status,'CODE_GUARDS_PRESENT_DB_E2E_PENDING');
 assert.equal(result.certified,false);
});
test('G1 database probe forbids mutation SQL and restricts connection to localhost',()=>{
 const db=read('scripts/proofline-g1-db-readonly.mjs');
 assert.match(db,/BEGIN TRANSACTION READ ONLY/);
 assert.match(db,/ROLLBACK/);
 assert.match(db,/localhost/);
 assert.ok(!/client\.query\([`'\"]\s*(?:DELETE|UPDATE|INSERT|CREATE|DROP|TRUNCATE)\b/i.test(db));
});
test('G0 backup requires explicit local DB opt-in, never production',()=>{
 const db=read('scripts/proofline-g0-db.mjs');
 assert.match(db,/--confirm-local-database/);
 assert.match(db,/NODE_ENV==='production'/);
 assert.match(db,/pg_dump/);
 assert.match(db,/pg_restore/);
});

import {probeReportApproval,probeReportVersionRace,probeCloseFailure,probeLaunchLedgerFailure} from '../scripts/proofline-g1-faultlab.mjs';
test('G1 reproduce paso de DISTRIBUTED a APPROVED en el método real con mock',async()=>{
  const r=await probeReportApproval();assert.equal(r.reproduced,true,JSON.stringify(r));
});
test('G1 reproduce versiones concurrentes iguales bajo lectura sincronizada',async()=>{
  const r=await probeReportVersionRace();assert.equal(r.reproduced,true,JSON.stringify(r));
});
test('G1 reproduce cierre persistido pese a fallo en AnalysisRun',async()=>{
  const r=await probeCloseFailure();assert.equal(r.reproduced,true,JSON.stringify(r));
});
test('G1 reproduce estado ACTIVE aunque falle el ledger',async()=>{
  const r=await probeLaunchLedgerFailure();assert.equal(r.reproduced,true,JSON.stringify(r));
});
