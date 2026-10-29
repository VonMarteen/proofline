import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const legacyPorts = new Set([3100,3101,3102,3103,3104,4100,51025,55432,58025,58100,59000,59001]);
const allowedLocalPorts = new Set([4200,4201,4202,4203,4204,4205,4206,4225,4232,4279,4280,4281,4290,4291]);
const internalContainerPorts = new Set([5432,6379,1025,8025,8000,9000,9001]);
const failures = [];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".pytest_cache", "dist", "coverage", "_DIFF"].includes(name)) continue;
    const abs = join(dir, name); const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out); else out.push(abs);
  }
  return out;
}
function activeFile(abs) {
  const rel = relative(root, abs).replaceAll("\\", "/");
  const base = rel.split("/").at(-1) ?? "";
  if (/\.tsbuildinfo$|pnpm-lock\.yaml$/.test(rel)) return false;
  if (["scripts/armar-infra-audit.mjs","scripts/normalize-local-env.mjs"].includes(rel)) return false;
  if (/^(APLICAR_|CHANGELOG_|VALIDACION_|FILES_|MANIFEST_|ANALISIS_|AUDITORIA_)/.test(base)) return false;
  if (rel.startsWith("PROOFLINE_PATCH_")) return false;
  return /\.(?:ts|tsx|js|mjs|json|ya?ml|md|txt|example)$/.test(rel) || base === ".env.example";
}

for (const abs of walk(root).filter(activeFile)) {
  const rel = relative(root, abs).replaceAll("\\", "/");
  let text; try { text = readFileSync(abs, "utf8"); } catch { continue; }
  for (const p of legacyPorts) {
    const re = new RegExp(`(?:localhost|127\\.0\\.0\\.1):${p}\\b|[\"']${p}:`, "g");
    if (re.test(text)) failures.push(`${rel}: referencia legacy al puerto ${p}`);
  }
  const localRe = /(?:localhost|127\.0\.0\.1):(\d{2,5})\b/g; let m;
  while ((m = localRe.exec(text))) {
    const port = Number(m[1]);
    if (rel === "docker-compose.dev.yml" && internalContainerPorts.has(port)) continue;
    if (!allowedLocalPorts.has(port)) failures.push(`${rel}: puerto local ${port} fuera del bloque PROOFLINE 4200–4299`);
  }
}

const expectedPackages = {site:4200,web:4202,respond:4203,control:4204,support:4205};
for (const [app, expected] of Object.entries(expectedPackages)) {
  const file = join(root, "apps", app, "package.json"); if (!existsSync(file)) continue;
  const json = JSON.parse(readFileSync(file, "utf8"));
  const match = String(json.scripts?.dev ?? "").match(/-p\s+(\d+)/);
  if (!match || Number(match[1]) !== expected) failures.push(`apps/${app}/package.json: dev debe usar ${expected}`);
}

const compose = readFileSync(join(root, "docker-compose.dev.yml"), "utf8");
for (const expected of ["4232:5432","4225:1025","4280:8025","4281:8000","4290:9000","4291:9001"]) {
  if (!compose.includes(expected)) failures.push(`docker-compose.dev.yml: falta mapping ${expected}`);
}
if (!/^name:\s*armar-proofline\s*$/m.test(compose)) failures.push("docker-compose.dev.yml: Docker project debe ser armar-proofline");
for (const name of ["proofline-postgres","proofline-mailpit","proofline-analytics","proofline-minio","proofline-net"]) {
  if (!compose.includes(name)) failures.push(`docker-compose.dev.yml: falta nombre ${name}`);
}

console.log("\nPROOFLINE · ARMAR infrastructure audit\n");
if (failures.length) {
  for (const f of [...new Set(failures)]) console.error(`[FALLO] ${f}`);
  console.error(`\nInfra audit failed with ${new Set(failures).size} issue(s).`);
  process.exit(1);
}
console.log("[OK] Puertos activos normalizados al bloque 4200–4299.");
console.log("[OK] Docker project / containers / network normalizados.");
console.log("[OK] No quedan referencias activas a los puertos legacy conocidos.\n");
