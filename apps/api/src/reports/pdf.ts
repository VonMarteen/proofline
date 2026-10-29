import { createHash } from "node:crypto";
import { reportDepth, reportLevelLabel, type CanonicalReportSnapshot, type ReportLevel } from "./report-contract.js";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stable(row[key])}`).join(",")}}`;
}

export function snapshotHash(snapshot: CanonicalReportSnapshot) {
  return createHash("sha256").update(stable(snapshot)).digest("hex");
}

function esc(s: string) {
  return s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\xFF]/g, "?");
}
function wrap(s: string, n = 78) {
  const out: string[] = []; let line = "";
  for (const word of String(s ?? "").split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > n && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export function buildProoflinePdf(snapshot: CanonicalReportSnapshot, level: ReportLevel) {
  const depth = reportDepth(level);
  const pages: string[] = [];
  const text = (x: number, y: number, size: number, value: string, bold = false) => `BT /F${bold ? 2 : 1} ${size} Tf 0.94 0.95 0.97 rg ${x} ${y} Td (${esc(value)}) Tj ET\n`;
  const lines = (x: number, y: number, size: number, value: string, n = 78) => wrap(value, n).map((line, i) => text(x, y - i * (size + 6), size, line)).join("\n");
  const footer = (label: string) => text(48, 44, 8, `PROOFLINE · ${label}`);
  const score = snapshot.score.overall == null ? "-" : `${snapshot.score.overall}/100`;
  const target = snapshot.score.target == null ? "-" : `${snapshot.score.target}/100`;
  const gap = snapshot.score.gap == null ? "-" : `${snapshot.score.gap > 0 ? "+" : ""}${snapshot.score.gap}`;
  const execAnswer = snapshot.highlights[0] ?? snapshot.responseSummaries[0] ?? "El análisis está disponible para revisión.";

  let page = text(48, 790, 10, "PROOFLINE · Signal & Structure", true)
    + text(48, 762, 11, snapshot.organization.name, true)
    + text(48, 724, 25, snapshot.assessment.title, true)
    + lines(48, 688, 11, snapshot.assessment.objective, 72)
    + text(48, 620, 9, `${snapshot.source.synthetic ? "PREVISUALIZACIÓN SINTÉTICA · " : ""}${reportLevelLabel(level, "es")} · ${new Date(snapshot.source.generatedAt).toLocaleDateString("es-ES")}`)
    + text(48, 575, 10, `Participación ${snapshot.participation.rate}% · ${snapshot.participation.completed}/${snapshot.participation.total} · Índice ${score}`, true)
    + text(48, 536, 9, `Target ${target} · Gap ${gap} · N ${snapshot.score.n}`)
    + text(48, 490, 10, "LECTURA EJECUTIVA", true)
    + lines(48, 464, 12, execAnswer, 70)
    + text(48, 356, 10, "SEÑALES PRINCIPALES", true)
    + snapshot.highlights.slice(0, 5).map((item, i) => lines(58, 330 - i * 38, 9, `- ${item}`, 72)).join("\n")
    + footer(`${reportLevelLabel(level, "es")} · snapshot ${snapshotHash(snapshot).slice(0, 12)}`);
  pages.push(page);

  page = text(48, 785, 23, "Dimensiones", true);
  let y = 735;
  for (const d of snapshot.dimensions.slice(0, 9)) {
    const suffix = `${d.score}/100${d.target == null ? "" : ` · target ${d.target}${d.gap == null ? "" : ` · gap ${d.gap > 0 ? "+" : ""}${d.gap}`}`} · n=${d.n}`;
    page += text(48, y, 10, d.name, true) + text(350, y, 8, suffix)
      + `\n0.16 0.18 0.23 rg 48 ${y - 15} 440 7 re f\n0.49 0.56 1 rg 48 ${y - 15} ${Math.max(0, Math.min(440, d.score * 4.4))} 7 re f\n`;
    y -= 55;
  }
  if (!snapshot.dimensions.length) {
    for (const item of snapshot.responseSummaries.slice(0, 10)) { page += lines(48, y, 9, `- ${item}`, 72); y -= 38; }
  }
  page += text(48, 105, 8, `Evidencia: ${snapshot.evidencePolicy}`) + footer("Resultados derivados del snapshot canónico");
  pages.push(page);

  if (depth >= 2) {
    page = text(48, 785, 23, "Diagnóstico y brechas", true);
    y = 740;
    const gapRows = snapshot.dimensions.filter((d) => d.gap != null).sort((a, b) => Math.abs(Number(b.gap)) - Math.abs(Number(a.gap)));
    for (const d of gapRows.slice(0, 8)) {
      page += text(48, y, 10, d.name, true) + text(350, y, 9, `observado ${d.score} · target ${d.target} · gap ${Number(d.gap) > 0 ? "+" : ""}${d.gap}`);
      y -= 34;
    }
    page += text(48, Math.max(350, y - 8), 10, "TAMAÑO DE MUESTRA", true)
      + text(58, Math.max(324, y - 34), 9, `Respuestas completas: ${snapshot.participation.completed} · N puntuado global: ${snapshot.score.n}`)
      + text(48, 270, 10, "LIMITACIONES", true)
      + snapshot.limitations.slice(0, 6).map((item, i) => lines(58, 244 - i * 38, 9, `- ${item}`, 72)).join("\n")
      + footer("L2+ · diagnóstico trazable");
    pages.push(page);
  }

  if (depth >= 3) {
    page = text(48, 785, 23, "Análisis detallado", true);
    y = 742;
    for (const q of snapshot.questions.filter((q) => q.scored && q.score != null).slice(0, 12)) {
      const suffix = `${q.score}/100${q.target == null ? "" : ` · target ${q.target}${q.gap == null ? "" : ` · gap ${Number(q.gap) > 0 ? "+" : ""}${q.gap}`}`} · n=${q.sample?.scored ?? 0}`;
      page += lines(48, y, 8, `${q.code} · ${q.prompt}`, 60) + text(385, y, 8, suffix);
      y -= 42;
      if (y < 170) break;
    }
    const safeCohorts = snapshot.cohorts.visible.slice(0, 5);
    page += text(48, 145, 10, "COHORTES SEGURAS", true)
      + (safeCohorts.length ? safeCohorts.map((c, i) => text(58, 121 - i * 18, 8, `${c.key} · n=${c.n} · ${c.score ?? "-"}/100`)).join("\n") : text(58, 121, 8, "No hay cohortes publicables para este snapshot."))
      + footer(`L3+ · cohortes suprimidas: ${snapshot.cohorts.suppressedCount}`);
    pages.push(page);
  }

  if (depth >= 4) {
    page = text(48, 785, 23, "Lectura estratégica", true)
      + text(48, 740, 10, "PRIORIDADES DERIVADAS", true);
    const priorities = snapshot.dimensions.slice().sort((a, b) => {
      const ga = a.gap == null ? 0 : Math.abs(a.gap); const gb = b.gap == null ? 0 : Math.abs(b.gap);
      return gb - ga || a.score - b.score;
    }).slice(0, 5);
    y = 714;
    for (const d of priorities) {
      page += lines(58, y, 9, `- ${d.name}: ${d.score}/100${d.gap == null ? "" : `; gap ${d.gap > 0 ? "+" : ""}${d.gap}`}. Prioridad para investigar y decidir con contexto.`, 72);
      y -= 46;
    }
    page += text(48, 430, 10, "EVIDENCIA CUALITATIVA", true);
    y = 404;
    for (const item of snapshot.qualitativeThemes.slice(0, 5)) {
      page += lines(58, y, 9, `- ${item.theme}: ${item.mentions} menciones${item.example ? ` · “${item.example}”` : ""}`, 72);
      y -= 48;
    }
    page += text(48, 150, 10, "METODOLOGÍA", true)
      + lines(58, 124, 8, snapshot.methodology, 76)
      + footer("L4 · recomendación humana sobre evidencia, no causalidad automática");
    pages.push(page);
  }

  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const streams = pages.map((body) => {
    const streamBody = `q\n0.07 0.08 0.10 rg 0 0 595 842 re f\n${body}Q\n`;
    return add(`<< /Length ${Buffer.byteLength(streamBody, "latin1")} >>\nstream\n${streamBody}endstream`);
  });
  const pagesObject = add("PAGES");
  const pageIds = streams.map((content) => add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`));
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const root = add(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);
  let out = "%PDF-1.4\n%âãÏÓ\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(out, "latin1"); out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
