import { createHash } from "node:crypto";
export type PdfSnapshot = {
  organization?: { name: string; legalName?: string | null; country?: string | null };
  branding?: { enabled: boolean; configured?: boolean; primaryColor: string; backgroundColor: string; surfaceColor: string; textColor: string; logoDocumentId?: string | null; logoAltText?: string | null };
  title: string;
  objective: string;
  kind: string;
  synthetic: boolean;
  generatedAt: string;
  participation: { completed: number; total: number; rate: number };
  overallScore: number | null;
  executiveAnswer: string;
  dimensions: Array<{ name: string; score: number }>;
  responseSummaries?: string[];
  highlights: string[];
  evidence: string[];
  methodology: string;
  limitations: string[];
};
function esc(s: string) { return s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\xFF]/g, "?"); }
function wrap(s: string, n = 78) { const o: string[] = []; let l = ""; for (const w of s.split(/\s+/)) { const x = l ? `${l} ${w}` : w; if (x.length > n && l) { o.push(l); l = w; } else l = x; } if (l) o.push(l); return o; }
export function snapshotHash(s: unknown) { return createHash("sha256").update(JSON.stringify(s)).digest("hex"); }
export function buildProoflinePdf(s: PdfSnapshot) {
  const pages: string[] = [];
  const t = (x: number, y: number, z: number, v: string, b = false) => `BT /F${b ? 2 : 1} ${z} Tf 0.94 0.95 0.97 rg ${x} ${y} Td (${esc(v)}) Tj ET`;
  const lines = (x: number, y: number, z: number, v: string, n = 78) => wrap(v, n).map((l, i) => t(x, y - i * (z + 6), z, l)).join("\n");
  let b = t(48, 790, 10, "PROOFLINE · Signal & Structure", true) + t(48, 762, 11, s.organization?.name ?? "Organización", true) + t(48, 724, 27, s.title, true) + lines(48, 690, 11, s.objective) + t(48, 625, 9, `${s.synthetic ? "PREVISUALIZACIÓN SINTÉTICA · " : ""}${s.kind} · ${new Date(s.generatedAt).toLocaleDateString("es-ES")}`) + t(48, 570, 11, `Participación ${s.participation.rate}% · ${s.participation.completed}/${s.participation.total} · Índice ${s.overallScore ?? "-"}`, true) + t(48, 515, 10, "RESPUESTA EJECUTIVA", true) + lines(48, 490, 13, s.executiveAnswer, 70) + t(48, 370, 10, "SEÑALES PRINCIPALES", true) + s.highlights.slice(0, 5).map((h, i) => lines(58, 345 - i * 34, 10, "• " + h, 72)).join("\n") + t(48, 44, 8, "PROOFLINE · by ARMAR TECHNOLOGIES");
  pages.push(b);
  b = t(48, 785, 24, s.dimensions.length ? "Dimensiones y evidencia" : "Distribuciones y evidencia", true);
  let y = 735;
  for (const d of s.dimensions.slice(0, 9)) {
    b += t(48, y, 10, d.name, true) + t(470, y, 9, `${d.score}/100`) + `\n0.16 0.18 0.23 rg 48 ${y - 15} 440 7 re f\n0.49 0.56 1 rg 48 ${y - 15} ${Math.max(0, Math.min(440, d.score * 4.4))} 7 re f\n`;
    y -= 55;
  }
  if (!s.dimensions.length) {
    for (const item of (s.responseSummaries ?? []).slice(0, 10)) {
      b += lines(48, y, 10, "• " + item, 72);
      y -= 42;
    }
  }
  if (s.evidence.length) {
    b += t(48, Math.max(150, y - 10), 10, "EVIDENCIA CUALITATIVA", true);
    let ey = Math.max(126, y - 34);
    for (const item of s.evidence.slice(0, 4)) { b += lines(58, ey, 9, "• " + item, 72); ey -= 38; }
  }
  b += t(48, 105, 9, "Metodología: " + s.methodology) + t(48, 82, 8, "Limitaciones: " + s.limitations.join(" · ")) + t(48, 44, 8, "PROOFLINE · Informe versionado");
  pages.push(b);
  const objs: string[] = [];
  const add = (x: string) => { objs.push(x); return objs.length; };
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const cs = pages.map(p => add(`<< /Length ${Buffer.byteLength(p, "latin1")} >>\nstream\nq\n0.07 0.08 0.10 rg 0 0 595 842 re f\n${p}\nQ\nendstream`));
  const ps = add("PAGES");
  const ids = cs.map(c => add(`<< /Type /Page /Parent ${ps} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
  objs[ps - 1] = `<< /Type /Pages /Kids [${ids.map(i => `${i} 0 R`).join(" ")}] /Count ${ids.length} >>`;
  const root = add(`<< /Type /Catalog /Pages ${ps} 0 R >>`);
  let out = "%PDF-1.4\n%âãÏÓ\n"; const off = [0];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out, "latin1"); out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < off.length; i++) out += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${root} 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
