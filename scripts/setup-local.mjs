import { spawnSync } from 'node:child_process';

const win = process.platform === 'win32';
function exec(command, args, label) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(command, args, { stdio: 'inherit', shell: win });
  if (r.status !== 0) {
    console.error(`\n[ERROR] ${label} falló (código ${r.status ?? 'desconocido'}).`);
    process.exit(r.status ?? 1);
  }
}
const npx = win ? 'npx.cmd' : 'npx';

exec('node', ['scripts/doctor.mjs'], '0/9 Diagnóstico');
exec('node', ['scripts/static-audit.mjs'], '1/9 Auditoría estática');
exec(npx, ['-y', 'pnpm@10.15.1', 'install', '--no-frozen-lockfile'], '2/9 Dependencias Node');
exec('docker', ['compose', '-f', 'docker-compose.dev.yml', 'up', '-d', '--wait', '--remove-orphans'], '3/9 Infraestructura local');
exec(npx, ['-y', 'pnpm@10.15.1', 'db:setup'], '4/9 Base de datos + seed demo');
exec(npx, ['-y', 'pnpm@10.15.1', 'auth:bootstrap-local'], '5/9 Autenticación local cliente + Control');
exec(npx, ['-y', 'pnpm@10.15.1', 'db:check'], '6/9 Conexión directa PostgreSQL + Prisma');
exec(npx, ['-y', 'pnpm@10.15.1', 'runtime:check'], '7/9 Nest runtime compilado + DI + flujos seed');
exec(npx, ['-y', 'pnpm@10.15.1', 'typecheck'], '8/9 TypeScript / typecheck completo');
exec(npx, ['-y', 'pnpm@10.15.1', 'build'], '9/9 Build de producción completo');
console.log('\n=== PREPARACIÓN COMPLETA ===');
console.log('La instalación, schema, tipos y build han pasado antes del primer arranque.');
console.log('Ahora ejecuta en VS Code: “Proofline: 2 · ARRANCAR TODO”.\n');
