import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

const root = process.cwd();
const win = process.platform === "win32";
const pidFile = resolve(root, ".proofline-pids.json");
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli || !existsSync(pnpmCli)) {
  console.error("[FALLO] No se pudo localizar el ejecutable de pnpm de esta sesión.");
  process.exit(1);
}

function runNodeScript(relative) {
  return spawnSync(process.execPath, [resolve(root, relative)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

function runPnpm(args) {
  return spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "sin respuesta";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return true;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  console.error(`[FALLO] ${url} no quedó disponible en ${Math.round(timeoutMs / 1000)}s (${lastError}).`);
  return false;
}

console.log("\nPROOFLINE · Arranque local controlado\n");
console.log("[1/4] Cerrando instancias locales anteriores y limpiando locks de Next...");
runNodeScript("scripts/stop-local.mjs");

for (const app of ["site", "web", "respond", "control", "support"]) {
  try { rmSync(resolve(root, "apps", app, ".next", "dev", "lock"), { force: true }); } catch {}
}

console.log("[2/4] Asegurando PostgreSQL, Analytics y servicios Docker...");
const infra = runPnpm(["infra:up"]);
if ((infra.status ?? 1) !== 0) {
  console.error("[FALLO] La infraestructura Docker no pudo arrancar. No se inicia un entorno incompleto.");
  console.error('        Comprueba Docker Desktop y ejecuta después "Proofline: 2 · ARRANCAR TODO".');
  process.exit(infra.status ?? 1);
}

console.log("[3/4] Compilando API...");
const apiBuild = runPnpm(["--filter", "@proofline/api", "build"]);
if ((apiBuild.status ?? 1) !== 0) {
  console.error("[FALLO] La API no compiló. No se inicia un entorno parcial.");
  process.exit(apiBuild.status ?? 1);
}

const children = new Map();
let stopping = false;

function prefixStream(stream, label, isErr = false) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", line => {
    const out = `[${label}] ${line}`;
    (isErr ? console.error : console.log)(out);
  });
}

function savePids() {
  try {
    writeFileSync(pidFile, JSON.stringify({ pids: [...children.values()].map(c => c.pid).filter(Boolean) }, null, 2));
  } catch {}
}

function startService(key, pkg, script = "dev") {
  const child = spawn(process.execPath, [pnpmCli, "--filter", pkg, script], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  children.set(key, child);
  savePids();
  prefixStream(child.stdout, key);
  prefixStream(child.stderr, key, true);
  child.on("exit", (code, signal) => {
    children.delete(key);
    savePids();
    if (!stopping) {
      const detail = signal ? `señal ${signal}` : `código ${code ?? "?"}`;
      console.error(`\n[FALLO] ${key} se detuvo (${detail}). Las demás superficies permanecen activas para diagnóstico.`);
      console.error('        Ejecuta "Proofline: 2B · DETENER APPS" cuando quieras cerrar el entorno.\n');
    }
  });
  return child;
}

function killTree(pid) {
  if (!pid) return;
  if (win) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", shell: true });
  } else {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\nCerrando procesos locales de Proofline...");
  for (const child of children.values()) killTree(child.pid);
  children.clear();
  try { rmSync(pidFile, { force: true }); } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  if (!stopping) for (const child of children.values()) killTree(child.pid);
});

console.log("[4/4] Levantando API cliente + API interna de Control y esperando readiness...");
startService("API", "@proofline/api");
startService("CONTROL_API", "@proofline/api", "dev:control");
const [apiReady, controlApiReady] = await Promise.all([waitForHttp("http://127.0.0.1:4201/health", 30000), waitForHttp("http://127.0.0.1:4206/health", 30000)]);
if (!apiReady || !controlApiReady) {
  console.error("[FALLO] Alguna API no está lista. Worker y frontends no se arrancan para evitar errores en cascada.");
  console.error('        La causa real queda visible arriba en las líneas [API] o [CONTROL_API].');
  process.exitCode = 1;
} else {
  console.log("[OK] API cliente, Control API y PostgreSQL disponibles. Levantando Worker y las cinco superficies Next con Webpack...\n");
  startService("WORKER", "@proofline/worker");
  startService("SITE", "@proofline/site");
  startService("WEB", "@proofline/web");
  startService("RESPOND", "@proofline/respond");
  startService("CONTROL", "@proofline/control");
  startService("SUPPORT", "@proofline/support");

  console.log("Servicios solicitados:");
  console.log("  Comercial     http://localhost:4200/es");
  console.log("  Workspace     http://localhost:4202/es");
  console.log("  Participante  http://localhost:4203/es/demo-token-2026");
  console.log("  Control       http://localhost:4204/es");
  console.log("  Support       http://localhost:4205/es");
  console.log("  API cliente   http://127.0.0.1:4201/health");
  console.log("  Control API   http://127.0.0.1:4206/health");
  console.log("  Analytics     http://localhost:4281/health");
  console.log("\nLa terminal permanece abierta mientras Proofline está ejecutándose.\n");
}
