#!/usr/bin/env node
/**
 * Workspace WS5 final acceptance gate.
 * Default: safe read-only HTTP checks + pure test scripts. No application writes.
 * --full: explicitly opt-in to service/runtime/pilot probes that may write demo data.
 * Reports contain only gate names/statuses (no tokens, secrets or API output).
 * Success of this command is NOT a production certification.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const node = process.execPath;
const pnpm = 'pnpm';
export const buildSteps = (full = false) => [
  { id: 'ws5-visual', title: 'Navegación, roles y borde superior', command: node, args: ['--test', 'tests/workspace-ws5-visual-final-20261022.test.mjs'], writeRisk: false },
  { id: 'ws5-functional', title: 'Regresión funcional WS-5', command: node, args: ['--test', 'tests/workspace-ws5-operational-quality.test.mjs'], writeRisk: false },
  { id: 'ws5-readonly', title: 'Smoke real de Workspace (GET)', command: node, args: ['scripts/workspace-ws5-readonly-smoke.mjs'], writeRisk: false },
  ...(full ? [
    { id: 'typecheck', title: 'Verificación de tipos completa', command: pnpm, args: ['typecheck'], writeRisk: false },
    { id: 'build', title: 'Compilación completa', command: pnpm, args: ['build'], writeRisk: false },
    { id: 'services', title: 'Servicios (puede disparar análisis de prueba)', command: pnpm, args: ['services:check'], writeRisk: true },
    { id: 'runtime', title: 'Runtime con datos locales', command: pnpm, args: ['runtime:check'], writeRisk: true },
    { id: 'pilot', title: 'Piloto E2E con escrituras de prueba', command: pnpm, args: ['pilot:check'], writeRisk: true },
  ] : []),
];
export function classifyStep(step, status, output = '') {
  if (status !== 0) return 'FAIL';
  // Some existing smokes return exit 0 when prerequisite evidence is missing.
  if (/\[PENDIENTE\]|\[FALLO\]|\bNO CERTIFICADO\b|did not complete before timeout/i.test(output)) return 'PENDING';
  return 'PASS';
}
export function evaluateSummary(results, full) {
  const failed = results.filter(x => x.status === 'FAIL').length;
  const pending = results.filter(x => x.status === 'PENDING').length;
  return {
    mode: full ? 'FULL_LOCAL' : 'SAFE_READONLY',
    status: failed ? 'FAIL' : pending ? 'PENDING' : full ? 'LOCAL_GATES_PASS' : 'READONLY_GATES_PASS',
    passed: results.filter(x => x.status === 'PASS').length,
    failed,
    pending,
    productionCertified: false,
    note: full ? 'Requiere validación manual UX, seguridad, correo real y entorno productivo por separado.' : 'Las escrituras E2E y el piloto no se ejecutan en modo seguro.',
  };
}
export async function runGate({ full = false, run = (step) => {
  const r = spawnSync(step.command, step.args, {
    cwd: root, encoding: 'utf8', timeout: step.id === 'pilot' ? 180000 : 120000,
    maxBuffer: 8 * 1024 * 1024, shell: process.platform === 'win32' && step.command === pnpm,
    env: process.env,
  });
  return { exit: r.status ?? 1, output: `${r.stdout ?? ''}\n${r.stderr ?? ''}`, error: r.error?.message };
}, log = console.log, save = true } = {}) {
  const results = [];
  for (const step of buildSteps(full)) {
    const start = Date.now();
    const response = await run(step);
    const status = classifyStep(step, response.exit, response.output ?? '');
    results.push({ id: step.id, title: step.title, status, durationMs: Date.now() - start, writeRisk: step.writeRisk });
    log(`[${status}] ${step.title}`);
  }
  const summary = evaluateSummary(results, full);
  if (save) {
    const folder = join(root, '.runtime');
    mkdirSync(folder, { recursive: true });
    const filename = join(folder, 'workspace-ws5-gate-latest.json');
    writeFileSync(filename, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary, checks: results }, null, 2), 'utf8');
    log('Informe local: .runtime/workspace-ws5-gate-latest.json');
  }
  log(`WS-5: ${summary.status} · ${summary.passed} OK · ${summary.failed} fallo(s) · ${summary.pending} pendiente(s). Producción NO certificada.`);
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const full = process.argv.includes('--full');
  const summary = await runGate({ full });
  if (summary.failed || summary.pending) process.exitCode = 1;
}
