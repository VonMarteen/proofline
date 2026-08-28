import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const root = process.cwd();
const failures = [];
const notes = [];
const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    if (["node_modules", ".next", ".git", ".pytest_cache"].includes(name)) continue;
    const rel = join(dir, name);
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walk(rel, out); else out.push(rel.replaceAll("\\", "/"));
  }
  return out;
}

const files = walk("apps").concat(walk("packages"));
const source = files.filter((f) => /\.(ts|tsx|js|mjs)$/.test(f));

// React 19 / Next 16: raw script tags inside React components can produce a client-render console error.
for (const f of source.filter((x) => x.endsWith(".tsx"))) {
  const s = read(f);
  if (/<script(?:\s|>)/.test(s)) fail(`${f}: raw <script> tag found; use next/script.`);
}

for (const app of ["site", "web", "respond", "control", "support"]) {
  const f = `apps/${app}/app/layout.tsx`;
  const s = read(f);
  if (s.includes('next/script') || s.includes('THEME_BOOTSTRAP_SCRIPT')) fail(`${f}: root layout must remain script-free in the local foundation.`);
  if (/<head[\s>]/i.test(s)) fail(`${f}: do not manually render <head> in App Router root layout.`);
}

// All Next surfaces must use identical React/Next versions and unique dev ports.
const appPkgs = ["site", "web", "respond", "control", "support"].map((app) => ({ app, json: JSON.parse(read(`apps/${app}/package.json`)) }));
const versions = new Set(appPkgs.map(({json}) => `${json.dependencies.next}|${json.dependencies.react}|${json.dependencies["react-dom"]}`));
if (versions.size !== 1) fail("Next/React versions differ between frontend surfaces.");
const ports = new Map();
for (const {app,json} of appPkgs) {
  const m = String(json.scripts.dev ?? "").match(/-p\s+(\d+)/);
  if (!m) fail(`apps/${app}/package.json: dev port missing.`);
  else if (ports.has(m[1])) fail(`Port ${m[1]} reused by ${ports.get(m[1])} and ${app}.`);
  else ports.set(m[1], app);
}

// Server-to-server API calls should avoid Windows localhost -> ::1 ambiguity.
for (const f of ["apps/web/lib/api.ts", "apps/control/lib/api.ts", "apps/respond/lib/api.ts", "apps/support/lib/api.ts"]) {
  const s = read(f);
  if (s.includes("http://localhost:4100")) fail(`${f}: server API default must use 127.0.0.1.`);
}


// Nest must execute code compiled by TypeScript, not directly through tsx/esbuild.
// Proofline relies on decorator metadata / Nest DI and tsx is reserved for standalone scripts
// such as seed/db-check that do not construct the Nest application.
const apiPackage = JSON.parse(read("apps/api/package.json"));
if (/\btsx\b/.test(String(apiPackage.scripts?.dev ?? ""))) {
  fail("apps/api/package.json: API dev runtime must not use tsx; compile with tsc and execute dist/main.js.");
}
if (/tsx\s+src\/runtime-check/.test(String(apiPackage.scripts?.["runtime:check"] ?? ""))) {
  fail("apps/api/package.json: runtime:check must execute compiled JavaScript, not tsx.");
}
if (!/tsc\s+-p\s+tsconfig\.build\.json/.test(String(apiPackage.scripts?.build ?? ""))) {
  fail("apps/api/package.json: API build must use the TypeScript compiler so decorator metadata is emitted.");
}
const rootPackage = JSON.parse(read("package.json"));
const rootDev = String(rootPackage.scripts?.dev ?? "");
const orchestratedDev = rootDev.includes("scripts/dev-all.mjs") && read("scripts/dev-all.mjs").includes('"@proofline/api", "build"');
if (!rootDev.includes("@proofline/api build") && !orchestratedDev) {
  fail("package.json: root dev must compile @proofline/api before starting application processes.");
}
if (/tsx/.test(String(rootPackage.scripts?.["dev:api"] ?? ""))) {
  fail("package.json: dev:api must not execute the Nest app with tsx.");
}
// Keep explicit @Inject tokens as an additional guardrail.
for (const f of source.filter((x) => x.startsWith("apps/api/src/") && x.endsWith(".ts"))) {
  const s = read(f);
  if (!s.includes("@Controller(") && !s.includes("@Injectable()")) continue;
  const ctor = s.match(/constructor\s*\(([^)]*(?:\)[^{]*)?[^}]*)\)\s*\{/s);
  if (!ctor) continue;
  const body = ctor[1] ?? "";
  const injectedParams = (body.match(/private\s+readonly/g) ?? []).length;
  const explicitTokens = (body.match(/@Inject\s*\(/g) ?? []).length;
  if (injectedParams > explicitTokens) {
    fail(`${f}: Nest constructor injection is implicit (${injectedParams} dependency parameter(s), ${explicitTokens} @Inject token(s)).`);
  }
}

// Tenant-isolation guardrail: assessment listing must always be constrained by the resolved organization.
const assessmentListService = read("apps/api/src/assessments/assessments.service.ts");
const assessmentListController = read("apps/api/src/assessments/assessments.controller.ts");
if (!/async list\(organizationId:string,ids\?:string\[\]\)/.test(assessmentListService) || !/where:ids\?\{organizationId,id:\{in:ids\}\}:\{organizationId\}/.test(assessmentListService)) {
  fail("apps/api/src/assessments/assessments.service.ts: assessment list must be tenant-scoped by organizationId.");
}
if (!assessmentListController.includes("this.svc.list(ctx.organization.id,unrestricted?undefined:ids)")) {
  fail("apps/api/src/assessments/assessments.controller.ts: resolved organization must be passed into assessment listing.");
}

// Prisma schema regression that broke v0.1.2.
const schema = read("apps/api/prisma/schema.prisma");
if (/^\s*\w+\s+[^\n]*@index\b/m.test(schema)) fail("Prisma schema contains field-level @index; use @@index([...]).");

// Verify workspace imports are declared by their owning package/app.
const workspaceNames = new Set();
for (const f of files.filter((x) => x.endsWith("package.json"))) {
  try { const j = JSON.parse(read(f)); if (j.name?.startsWith("@proofline/")) workspaceNames.add(j.name); } catch {}
}
function packageJsonFor(file) {
  let d = dirname(file);
  while (d && d !== ".") {
    const candidate = `${d}/package.json`;
    if (files.includes(candidate)) return JSON.parse(read(candidate));
    d = dirname(d);
  }
  return null;
}
const importRe = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;
for (const f of source) {
  const pkg = packageJsonFor(f); if (!pkg) continue;
  const declared = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies};
  const s = read(f); let m;
  while ((m = importRe.exec(s))) {
    const spec = m[2];
    if (!spec.startsWith("@proofline/")) continue;
    const base = spec.split("/").slice(0,2).join("/");
    if (workspaceNames.has(base) && !declared[base]) fail(`${f}: imports ${base} but ${pkg.name} does not declare it.`);
  }
}

// The VS Code distribution must not reintroduce external launchers.
const forbidden = walk(".").filter((f) => /\.(bat|ps1)$/i.test(f));
if (forbidden.length) fail(`External Windows launchers found: ${forbidden.join(", ")}`);

note(`Checked ${source.length} source files.`);
note(`Frontend dev ports: ${[...ports.entries()].map(([p,a])=>`${a}:${p}`).join(" · ")}.`);

console.log("\nPROOFLINE · Static compatibility audit\n");
for (const n of notes) console.log(`[OK]    ${n}`);
if (failures.length) {
  for (const f of failures) console.error(`[FALLO] ${f}`);
  console.error(`\nStatic audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("[OK]    Next 16 / React 19 layouts, compiled Nest runtime, explicit Nest DI, workspace imports, ports and Prisma guardrails passed.\n");
