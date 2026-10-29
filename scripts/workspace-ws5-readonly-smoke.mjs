#!/usr/bin/env node
/**
 * PROOFLINE Workspace WS-5 — local READ-ONLY smoke.
 * GET only, loopback only, no stored credentials, no writes or migrations.
 * Uses the existing local demo identity; never run as a production certification.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = 'http://127.0.0.1:4201';
const web = 'http://127.0.0.1:4202';
const headers = Object.freeze({ 'x-proofline-user': 'ana@acme.local', 'x-proofline-role': 'OWNER' });
const hasPagination = p => Boolean(p && Array.isArray(p.items) && p.pagination && Number.isInteger(p.pagination.total) && p.pagination.total >= 0 && Number.isInteger(p.pagination.pageSize));
export const contract = Object.freeze({
  health: p => p?.ok === true && p?.database === 'ready',
  dashboard: p => Boolean(p?.organization?.slug && p?.summary && Array.isArray(p?.activeAssessments)),
  assessments: hasPagination,
  reports: hasPagination,
  privacy: p => Array.isArray(p?.retentionPolicies) && Array.isArray(p?.documents),
  privacyTable: hasPagination,
  support: p => hasPagination(p) && typeof p.activeCount === 'number' && typeof p.unreadCount === 'number',
  billing: p => typeof p?.visible === 'boolean' && Boolean(p?.capacity),
  team: p => Array.isArray(p?.members),
});
export const readChecks = [
  { name: 'API + PostgreSQL', url: `${api}/health`, schema: 'health', auth: false },
  { name: 'Workspace · dashboard', url: `${api}/v1/dashboard?locale=es`, schema: 'dashboard', auth: true },
  { name: 'Workspace · assessments', url: `${api}/v1/assessments/table?page=1&pageSize=25`, schema: 'assessments', auth: true },
  { name: 'Workspace · informes', url: `${api}/v1/workspace/reports/table?page=1&pageSize=25`, schema: 'reports', auth: true },
  { name: 'Workspace · privacidad', url: `${api}/v1/workspace/legal?locale=es&assessments=none`, schema: 'privacy', auth: true },
  { name: 'Workspace · privacidad (tabla)', url: `${api}/v1/workspace/legal/assessments/table?page=1&pageSize=25`, schema: 'privacyTable', auth: true },
  { name: 'Workspace · soporte', url: `${api}/v1/workspace/support/table?page=1&pageSize=25`, schema: 'support', auth: true },
  { name: 'Workspace · plan y uso', url: `${api}/v1/workspace/billing`, schema: 'billing', auth: true },
  { name: 'Workspace · equipo', url: `${api}/v1/workspace/team`, schema: 'team', auth: true },
];

export async function run({request=fetch, print=console.log}={}) {
  let failures=0;
  print('PROOFLINE WS-5 · Smoke READ-ONLY local (sin mutaciones)');
  for (const c of readChecks) {
    try {
      const response=await request(c.url, {method:'GET', headers:c.auth?headers:{}, cache:'no-store', signal:AbortSignal.timeout(8000), redirect:'manual'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      if (!contract[c.schema](payload)) throw new Error('Respuesta incompatible con el contrato esperado');
      print(`[OK] ${c.name}`);
    } catch (error) {
      failures++;
      print(`[FALLO] ${c.name}: ${error instanceof Error?error.message:String(error)}`);
    }
  }
  for(const locale of ['es','en']){
    try {
      const response=await request(`${web}/${locale}`, {method:'GET',redirect:'manual',signal:AbortSignal.timeout(8000)});
      // 3xx redirects are expected if Workspace requires a login session.
      if(response.status >= 500 || response.status < 200 || response.status >= 400)throw new Error(`HTTP ${response.status}`);
      print(`[OK] Workspace ${locale.toUpperCase()} responde (${response.status===200?'página':'redirección autenticada'})`);
    }catch(error){failures++;print(`[FALLO] Workspace ${locale.toUpperCase()}: ${error instanceof Error?error.message:String(error)}`)}
  }
  print(failures?`WS-5: ${failures} fallo(s). NO CERTIFICADO.`:'WS-5: lecturas locales OK. Las acciones de escritura, Respond y Pilot E2E siguen pendientes.');
  return failures;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures=await run();
  if(failures)process.exitCode=1;
}
