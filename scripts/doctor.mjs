import { spawnSync } from 'node:child_process';

function run(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}
function line(ok, label, detail='') {
  console.log(`${ok ? '[OK]   ' : '[FALLO]'} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\nPROOFLINE · Diagnóstico local para VS Code\n');
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = (major === 20 && minor >= 19) || major === 22 || major === 24;
line(nodeOk, 'Node.js', `v${process.versions.node} (20.19+, 22 o 24; Node 24 recomendado)`);
const npm = run('npm', ['--version']);
line(npm.ok, 'npm', npm.out.split(/\r?\n/)[0] ?? '');
const docker = run('docker', ['version', '--format', '{{.Server.Version}}']);
line(docker.ok, 'Docker Desktop / daemon', docker.ok ? docker.out : 'Abre Docker Desktop y vuelve a ejecutar');
const compose = run('docker', ['compose', 'version', '--short']);
line(compose.ok, 'Docker Compose', compose.out);
console.log('\nPuertos Proofline: 3100 site · 3101 app · 3102 respond · 3103 control · 3104 support · 4100 client api · 4200 control api · 55432 postgres · 58025 mail · 58100 analytics');
console.log('\nSi todo sale [OK], ejecuta la tarea: “Proofline: 1 · Preparar local (primera vez)”.\n');
if (!nodeOk || !npm.ok || !docker.ok || !compose.ok) process.exitCode = 1;
