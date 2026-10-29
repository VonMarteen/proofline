#!/usr/bin/env node

/**
 * PROOFLINE — Audit ZIP generator
 *
 * Run from the repository root:
 *   node CREATE_PROOFLINE_AUDIT_ZIP.mjs
 *
 * No npm packages required.
 *
 * Creates:
 *   PROOFLINE_AUDIT_YYYYMMDD-HHmm.zip
 *   PROOFLINE_AUDIT_YYYYMMDD-HHmm.zip.sha256.txt
 *
 * The ZIP intentionally excludes dependencies, build output, caches,
 * Git internals, local databases, previous ZIPs and secret-bearing files.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const ROOT = process.cwd();

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
  ".crt",
  ".cer",
]);

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file

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

function normalizeZipPath(p) {
  return p.split(path.sep).join("/");
}

function isSecretEnvFile(name) {
  const lower = name.toLowerCase();
  if (SAFE_ENV_NAMES.has(lower)) return false;
  return lower === ".env" || lower.startsWith(".env.");
}

function shouldExcludeFile(fullPath, relPath, stat) {
  const name = path.basename(fullPath);
  const lowerName = name.toLowerCase();
  const ext = path.extname(lowerName);

  if (isSecretEnvFile(lowerName)) {
    return "secret env file";
  }

  if (
    lowerName === "id_rsa" ||
    lowerName === "id_ed25519" ||
    lowerName === "credentials.json" ||
    lowerName === "service-account.json" ||
    lowerName === "service_account.json"
  ) {
    return "credential/private-key file";
  }

  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return `excluded extension ${ext}`;
  }

  if (/^proofline_audit_\d{8}-\d{4}/i.test(lowerName)) {
    return "previous audit artifact";
  }

  if (stat.size > MAX_FILE_BYTES) {
    return `file larger than ${MAX_FILE_BYTES} bytes`;
  }

  return null;
}

function walk(dir, included, excluded) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);

    if (entry.isSymbolicLink()) {
      excluded.push(`${normalizeZipPath(rel)} :: symlink`);
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        excluded.push(`${normalizeZipPath(rel)}/ :: excluded directory`);
        continue;
      }
      walk(full, included, excluded);
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = fs.statSync(full);
    const reason = shouldExcludeFile(full, rel, stat);
    if (reason) {
      excluded.push(`${normalizeZipPath(rel)} :: ${reason}`);
      continue;
    }

    included.push({
      full,
      rel: normalizeZipPath(rel),
      mtime: stat.mtime,
      size: stat.size,
    });
  }
}

// CRC32 implementation for ZIP headers
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
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);

  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return { dosTime, dosDate };
}

function localFileHeader(nameBuf, crc, compressedSize, uncompressedSize, dosTime, dosDate) {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4); // version needed
  h.writeUInt16LE(0x0800, 6); // UTF-8
  h.writeUInt16LE(8, 8); // deflate
  h.writeUInt16LE(dosTime, 10);
  h.writeUInt16LE(dosDate, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(compressedSize, 18);
  h.writeUInt32LE(uncompressedSize, 22);
  h.writeUInt16LE(nameBuf.length, 26);
  h.writeUInt16LE(0, 28); // extra len
  return h;
}

function centralDirectoryHeader(nameBuf, crc, compressedSize, uncompressedSize, dosTime, dosDate, offset) {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4); // version made by
  h.writeUInt16LE(20, 6); // version needed
  h.writeUInt16LE(0x0800, 8); // UTF-8
  h.writeUInt16LE(8, 10); // deflate
  h.writeUInt16LE(dosTime, 12);
  h.writeUInt16LE(dosDate, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(compressedSize, 20);
  h.writeUInt32LE(uncompressedSize, 24);
  h.writeUInt16LE(nameBuf.length, 28);
  h.writeUInt16LE(0, 30); // extra len
  h.writeUInt16LE(0, 32); // comment len
  h.writeUInt16LE(0, 34); // disk start
  h.writeUInt16LE(0, 36); // internal attrs
  h.writeUInt32LE(0, 38); // external attrs
  h.writeUInt32LE(offset, 42);
  return h;
}

function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const h = Buffer.alloc(22);
  h.writeUInt32LE(0x06054b50, 0);
  h.writeUInt16LE(0, 4);
  h.writeUInt16LE(0, 6);
  h.writeUInt16LE(entryCount, 8);
  h.writeUInt16LE(entryCount, 10);
  h.writeUInt32LE(centralSize, 12);
  h.writeUInt32LE(centralOffset, 16);
  h.writeUInt16LE(0, 20);
  return h;
}

function createZip(outputPath, files, manifestText) {
  const allEntries = files.map((f) => ({
    name: f.rel,
    data: fs.readFileSync(f.full),
    mtime: f.mtime,
  }));

  allEntries.push({
    name: "_PROOFLINE_AUDIT_MANIFEST.txt",
    data: Buffer.from(manifestText, "utf8"),
    mtime: new Date(),
  });

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of allEntries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const raw = entry.data;
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);
    const { dosTime, dosDate } = dosDateTime(entry.mtime);

    const localHeader = localFileHeader(
      nameBuf,
      crc,
      compressed.length,
      raw.length,
      dosTime,
      dosDate
    );

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = centralDirectoryHeader(
      nameBuf,
      crc,
      compressed.length,
      raw.length,
      dosTime,
      dosDate,
      offset
    );

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const localBuffer = Buffer.concat(localParts);
  const eocd = endOfCentralDirectory(
    allEntries.length,
    centralBuffer.length,
    centralOffset
  );

  fs.writeFileSync(outputPath, Buffer.concat([localBuffer, centralBuffer, eocd]));
}

function validateRepositoryRoot() {
  const packageJson = path.join(ROOT, "package.json");
  const appsDir = path.join(ROOT, "apps");

  if (!fs.existsSync(packageJson)) {
    console.error("ERROR: package.json not found.");
    console.error("Run this script from the PROOFLINE repository root.");
    process.exit(1);
  }

  if (!fs.existsSync(appsDir)) {
    console.warn("WARNING: apps/ directory not found. Verify that this is the PROOFLINE root.");
  }
}

validateRepositoryRoot();

const included = [];
const excluded = [];
walk(ROOT, included, excluded);

included.sort((a, b) => a.rel.localeCompare(b.rel));
excluded.sort();

const now = new Date();
const stamp = timestamp(now);
const zipName = `PROOFLINE_AUDIT_${stamp}.zip`;
const zipPath = path.join(ROOT, zipName);
const shaPath = `${zipPath}.sha256.txt`;

const totalBytes = included.reduce((sum, f) => sum + f.size, 0);

const manifest = [
  "PROOFLINE — AUDIT PACKAGE",
  `Generated: ${now.toISOString()}`,
  `Repository root: ${ROOT}`,
  `Included files: ${included.length}`,
  `Included source bytes: ${totalBytes}`,
  "",
  "PURPOSE",
  "Current-repository audit before applying the next incremental PROOFLINE patch.",
  "",
  "SECURITY / SIZE EXCLUSIONS",
  "- .env and .env.* are excluded except .env.example/.sample/.template/.defaults",
  "- private keys/certificates and common credential files are excluded",
  "- node_modules, .git, build output and caches are excluded",
  "- local databases, logs and previous archives are excluded",
  `- individual files larger than ${MAX_FILE_BYTES} bytes are excluded`,
  "",
  "INCLUDED FILES",
  ...included.map((f) => `${f.rel} :: ${f.size} bytes`),
  "",
  "EXCLUDED PATHS",
  ...excluded,
  "",
].join("\n");

console.log("");
console.log("PROOFLINE — creating audit ZIP");
console.log("--------------------------------");
console.log(`Root: ${ROOT}`);
console.log(`Files included: ${included.length}`);
console.log(`Source size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log("");

createZip(zipPath, included, manifest);

const zipBytes = fs.readFileSync(zipPath);
const sha256 = crypto.createHash("sha256").update(zipBytes).digest("hex");
fs.writeFileSync(
  shaPath,
  `${sha256}  ${zipName}\n`,
  "utf8"
);

console.log("DONE");
console.log(`ZIP:    ${zipName}`);
console.log(`SHA256: ${path.basename(shaPath)}`);
console.log("");
console.log("Send me the generated ZIP. The .sha256.txt is optional but recommended.");
console.log("");
