#!/usr/bin/env node

/**
 * PROOFLINE — Exportador de código de la web comercial
 *
 * Ejecutar desde la raíz del repositorio:
 *   node CREATE_PROOFLINE_SITE_ZIP.mjs
 *
 * Genera:
 *   PROOFLINE_SITE_SOURCE_YYYYMMDD-HHmm.zip
 *   PROOFLINE_SITE_SOURCE_YYYYMMDD-HHmm.zip.sha256.txt
 *
 * Incluye:
 * - apps/site completo
 * - packages internos referenciados por apps/site (recursivamente)
 * - archivos raíz mínimos del monorepo/configuración
 *
 * Excluye:
 * - node_modules, .next, dist, build, caches
 * - .git
 * - .env y secretos
 * - ZIPs/logs/bases locales
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const ROOT = process.cwd();
const SITE_DIR = path.join(ROOT, "apps", "site");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".pnpm-store",
  ".yarn",
  ".idea",
  ".venv",
  "venv",
  "__pycache__",
  "tmp",
  "temp",
  "logs",
]);

const SAFE_ENV_NAMES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.defaults",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
  ".tgz",
  ".log",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
]);

const ROOT_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "turbo.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "eslint.config.js",
  "eslint.config.mjs",
  ".npmrc",
];

const MAX_FILE_BYTES = 30 * 1024 * 1024;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timestamp(d = new Date()) {
  return (
    d.getFullYear() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "-" +
    pad2(d.getHours()) +
    pad2(d.getMinutes())
  );
}

function norm(p) {
  return p.split(path.sep).join("/");
}

function isSecretEnvFile(name) {
  const lower = name.toLowerCase();
  if (SAFE_ENV_NAMES.has(lower)) return false;
  return lower === ".env" || lower.startsWith(".env.");
}

function shouldExcludeFile(full, stat) {
  const name = path.basename(full).toLowerCase();
  const ext = path.extname(name);

  if (isSecretEnvFile(name)) return true;
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;

  if (
    name === "credentials.json" ||
    name === "service-account.json" ||
    name === "service_account.json" ||
    name === "id_rsa" ||
    name === "id_ed25519"
  ) return true;

  if (stat.size > MAX_FILE_BYTES) return true;

  return false;
}

function safeJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function listWorkspacePackages() {
  const roots = ["packages", "apps", "services"];
  const map = new Map();

  for (const rootName of roots) {
    const root = path.join(ROOT, rootName);
    if (!fs.existsSync(root)) continue;

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const pkgFile = path.join(dir, "package.json");
      if (!fs.existsSync(pkgFile)) continue;

      const pkg = safeJson(pkgFile);
      if (pkg?.name) {
        map.set(pkg.name, dir);
      }
    }
  }

  return map;
}

function dependencyNames(pkg) {
  if (!pkg) return [];
  return Object.keys({
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
    ...(pkg.optionalDependencies || {}),
  });
}

function discoverLocalDependencies(startDir, workspaceMap) {
  const selected = new Set([startDir]);
  const queue = [startDir];

  while (queue.length) {
    const dir = queue.shift();
    const pkg = safeJson(path.join(dir, "package.json"));
    for (const dep of dependencyNames(pkg)) {
      const localDir = workspaceMap.get(dep);
      if (localDir && !selected.has(localDir)) {
        selected.add(localDir);
        queue.push(localDir);
      }
    }
  }

  return [...selected];
}

function collectDir(dir, out, excluded) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);

    if (entry.isSymbolicLink()) {
      excluded.push(`${norm(rel)} :: symlink`);
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        excluded.push(`${norm(rel)}/ :: excluded directory`);
        continue;
      }
      collectDir(full, out, excluded);
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = fs.statSync(full);
    if (shouldExcludeFile(full, stat)) {
      excluded.push(`${norm(rel)} :: excluded file`);
      continue;
    }

    out.set(norm(rel), {
      full,
      rel: norm(rel),
      size: stat.size,
      mtime: stat.mtime,
    });
  }
}

function addRootFiles(out) {
  for (const rel of ROOT_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const stat = fs.statSync(full);

    if (!shouldExcludeFile(full, stat)) {
      out.set(norm(rel), {
        full,
        rel: norm(rel),
        size: stat.size,
        mtime: stat.mtime,
      });
    }
  }
}

// ---- ZIP implementation (sin dependencias externas) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);

  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return { dosTime, dosDate };
}

function localHeader(nameBuf, crc, compressedSize, rawSize, dosTime, dosDate) {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4);
  h.writeUInt16LE(0x0800, 6);
  h.writeUInt16LE(8, 8);
  h.writeUInt16LE(dosTime, 10);
  h.writeUInt16LE(dosDate, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(compressedSize, 18);
  h.writeUInt32LE(rawSize, 22);
  h.writeUInt16LE(nameBuf.length, 26);
  h.writeUInt16LE(0, 28);
  return h;
}

function centralHeader(nameBuf, crc, compressedSize, rawSize, dosTime, dosDate, offset) {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4);
  h.writeUInt16LE(20, 6);
  h.writeUInt16LE(0x0800, 8);
  h.writeUInt16LE(8, 10);
  h.writeUInt16LE(dosTime, 12);
  h.writeUInt16LE(dosDate, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(compressedSize, 20);
  h.writeUInt32LE(rawSize, 24);
  h.writeUInt16LE(nameBuf.length, 28);
  h.writeUInt16LE(0, 30);
  h.writeUInt16LE(0, 32);
  h.writeUInt16LE(0, 34);
  h.writeUInt16LE(0, 36);
  h.writeUInt32LE(0, 38);
  h.writeUInt32LE(offset, 42);
  return h;
}

function eocd(count, centralSize, centralOffset) {
  const h = Buffer.alloc(22);
  h.writeUInt32LE(0x06054b50, 0);
  h.writeUInt16LE(0, 4);
  h.writeUInt16LE(0, 6);
  h.writeUInt16LE(count, 8);
  h.writeUInt16LE(count, 10);
  h.writeUInt32LE(centralSize, 12);
  h.writeUInt32LE(centralOffset, 16);
  h.writeUInt16LE(0, 20);
  return h;
}

function createZip(outputPath, entries, manifest) {
  const all = entries.map((x) => ({
    name: x.rel,
    data: fs.readFileSync(x.full),
    mtime: x.mtime,
  }));

  all.push({
    name: "_PROOFLINE_SITE_EXPORT_MANIFEST.txt",
    data: Buffer.from(manifest, "utf8"),
    mtime: new Date(),
  });

  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of all) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const raw = e.data;
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const { dosTime, dosDate } = dosDateTime(e.mtime);

    const lh = localHeader(nameBuf, crc, compressed.length, raw.length, dosTime, dosDate);
    locals.push(lh, nameBuf, compressed);

    const ch = centralHeader(
      nameBuf,
      crc,
      compressed.length,
      raw.length,
      dosTime,
      dosDate,
      offset
    );
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + compressed.length;
  }

  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const end = eocd(all.length, centralBuf.length, localBuf.length);

  fs.writeFileSync(outputPath, Buffer.concat([localBuf, centralBuf, end]));
}

// ---- Main ----

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  console.error("ERROR: No encuentro package.json en esta carpeta.");
  console.error("Ejecuta el script desde la raíz de PROOFLINE.");
  process.exit(1);
}

if (!fs.existsSync(SITE_DIR)) {
  console.error("ERROR: No encuentro apps/site.");
  console.error("Comprueba que estás en la raíz del repositorio PROOFLINE.");
  process.exit(1);
}

const workspaceMap = listWorkspacePackages();
const dirs = discoverLocalDependencies(SITE_DIR, workspaceMap);

const files = new Map();
const excluded = [];

for (const dir of dirs) {
  collectDir(dir, files, excluded);
}
addRootFiles(files);

const entries = [...files.values()].sort((a, b) => a.rel.localeCompare(b.rel));
const totalBytes = entries.reduce((sum, f) => sum + f.size, 0);

const now = new Date();
const stamp = timestamp(now);
const zipName = `PROOFLINE_SITE_SOURCE_${stamp}.zip`;
const zipPath = path.join(ROOT, zipName);
const shaPath = `${zipPath}.sha256.txt`;

const selectedDirs = dirs.map((d) => norm(path.relative(ROOT, d)));

const manifest = [
  "PROOFLINE — WEB COMERCIAL / SOURCE EXPORT",
  `Generated: ${now.toISOString()}`,
  "",
  "PRIMARY SURFACE",
  "apps/site",
  "",
  "LOCAL WORKSPACE DIRECTORIES INCLUDED",
  ...selectedDirs,
  "",
  `FILES INCLUDED: ${entries.length}`,
  `SOURCE SIZE: ${totalBytes} bytes`,
  "",
  "ROOT CONFIG FILES INCLUDED WHEN PRESENT",
  ...ROOT_FILES,
  "",
  "SECURITY EXCLUSIONS",
  "- .env and .env.* except example/sample/template/defaults",
  "- private keys and common credential files",
  "- node_modules, .next, dist, build, caches",
  "- archives, logs and local databases",
  "",
  "FILES",
  ...entries.map((f) => `${f.rel} :: ${f.size} bytes`),
  "",
  "EXCLUDED",
  ...excluded,
  "",
].join("\n");

console.log("");
console.log("PROOFLINE — exportando web comercial");
console.log("------------------------------------");
console.log(`Superficie: apps/site`);
console.log(`Dependencias locales detectadas: ${selectedDirs.length - 1}`);
for (const d of selectedDirs) console.log(`  - ${d}`);
console.log(`Archivos: ${entries.length}`);
console.log(`Tamaño fuente: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log("");

createZip(zipPath, entries, manifest);

const zipBytes = fs.readFileSync(zipPath);
const sha = crypto.createHash("sha256").update(zipBytes).digest("hex");

fs.writeFileSync(
  shaPath,
  `${sha}  ${zipName}\n`,
  "utf8"
);

console.log("LISTO");
console.log(`ZIP:    ${zipName}`);
console.log(`SHA256: ${path.basename(shaPath)}`);
console.log("");
console.log("Envíame el ZIP generado. El .sha256.txt también, si quieres verificar integridad.");
console.log("");
