import { existsSync, writeFileSync, rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const win = process.platform === "win32";
const npx = win ? "npx.cmd" : "npx";
const pidFile = ".proofline-pids.json";
const children = [];
let stopping = false;

function sync(command, args, label) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(command, args, { stdio: "inherit", shell: win });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (v) => { socket.destroy(); resolve(v); };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function prefix(name, stream, target) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line) target.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => { if (buffer) target.write(`[${name}] ${buffer}\n`); });
}

function start(name, script) {
  const child = spawn(npx, ["-y", "pnpm@10.15.1", script], {
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: win,
    windowsHide: true,
    detached: !win,
  });
  children.push(child);
  prefix(name, child.stdout, process.stdout);
  prefix(name, child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    if (!stopping && code !== null) {
      console.error(`\n[FALLO] ${name} terminó inesperadamente (code=${code}, signal=${signal ?? "—"}).`);
      shutdown(1);
    }
  });
  writeFileSync(pidFile, JSON.stringify({ pids: children.map((c) => c.pid).filter(Boolean) }, null, 2));
  return child;
}

async function waitHttp(name, url, child, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`${name} terminó antes de estar listo.`);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1800) });
      if (r.status >= 200 && r.status < 400) {
        console.log(`[OK] ${name} listo → ${url}`);
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${name} no respondió en ${url} dentro de ${Math.round(ms/1000)}s.`);
}

function killChild(child) {
  if (!child.pid) return;
  if (win) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", shell: true });
  else { try { process.kill(-child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch {} } }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nDeteniendo aplicaciones Proofline...");
  for (const child of [...children].reverse()) killChild(child);
  try { rmSync(pidFile, { force: true }); } catch {}
  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => { try { rmSync(pidFile, { force: true }); } catch {} });

if (!existsSync("node_modules") || !existsSync("apps/api/src/generated/prisma/client.ts")) {
  console.error("\n[PROOFLINE] Falta la preparación inicial. Ejecuta primero la tarea ‘Proofline: 1 · PREPARAR LOCAL (primera vez)’.\n");
  process.exit(1);
}

sync("node", ["scripts/static-audit.mjs"], "Compatibilidad estática");
sync("docker", ["compose", "-f", "docker-compose.dev.yml", "up", "-d", "--wait", "--remove-orphans"], "Infraestructura");

for (const port of [3100,3101,3102,3103,3104,4100,4200]) {
  if (await portInUse(port)) {
    console.error(`\n[FALLO] El puerto ${port} ya está ocupado.`);
    console.error("Ejecuta desde VS Code la tarea ‘Proofline: 2B · DETENER APPS’ y vuelve a arrancar.\n");
    process.exit(1);
  }
}

console.log("\n=== Aplicaciones Proofline (logs integrados) ===");
console.log("Ctrl+C o Stop Task detendrá todos los procesos Node iniciados por esta tarea.\n");

try {
  const api = start("api", "dev:api");
  await waitHttp("API", "http://127.0.0.1:4100/health", api);

  start("worker", "dev:worker");

  const site = start("site", "dev:site");
  await waitHttp("Web comercial", "http://127.0.0.1:3100/es", site);

  const web = start("web", "dev:web");
  await waitHttp("App cliente", "http://127.0.0.1:3101/es", web);

  const respond = start("respond", "dev:respond");
  await waitHttp("Participante", "http://127.0.0.1:3102/es/demo-token-2026", respond);

  const control = start("control", "dev:control");
  await waitHttp("Proofline Control", "http://127.0.0.1:3103/es", control);

  const support = start("support", "dev:support");
  await waitHttp("Proofline Support", "http://127.0.0.1:3104/login?locale=es", support);

  console.log("\n[OK] Todas las superficies están listas.");
  console.log("Site     http://localhost:3100/es");
  console.log("App      http://localhost:3101/es");
  console.log("Respond  http://localhost:3102/es/demo-token-2026");
  console.log("Control  http://localhost:3103/es");
  console.log("Support  http://localhost:3104/es");
  console.log("API      http://localhost:4100/health");
  console.log("Mailpit  http://localhost:58025\n");
} catch (error) {
  console.error(`\n[FALLO] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
