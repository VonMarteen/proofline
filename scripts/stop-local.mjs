import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const win = process.platform === "win32";
const root = process.cwd();
const pidFile = resolve(root, ".proofline-pids.json");

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (win) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", shell: true });
  } else {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
}

const pids = new Set();
if (existsSync(pidFile)) {
  try {
    const data = JSON.parse(readFileSync(pidFile, "utf8"));
    for (const pid of data.pids ?? []) pids.add(Number(pid));
  } catch {}
}

if (win) {
  const out = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8", shell: true }).stdout ?? "";
  const targetPorts = new Set([3100, 3101, 3102, 3103, 3104, 4100, 4200]);
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (m && targetPorts.has(Number(m[1]))) pids.add(Number(m[2]));
  }
}

for (const pid of pids) killPid(pid);

for (const app of ["site", "web", "respond", "control", "support"]) {
  try { rmSync(resolve(root, "apps", app, ".next", "dev", "lock"), { force: true }); } catch {}
}
try { rmSync(pidFile, { force: true }); } catch {}
console.log("[OK] Procesos locales de Proofline detenidos y locks de Next limpiados. Docker y PostgreSQL permanecen intactos.");
