import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { decryptText } from "../security/crypto.js";
import { buildProoflinePdf, snapshotHash, type PdfSnapshot } from "./pdf.js";

@Injectable()
export class ReportService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async snapshot(id: string, synthetic = false): Promise<PdfSnapshot> {
    const a = await this.db.assessment.findUnique({
      where: { id },
      include: {
        questions: true,
        participants: true,
        analysisRuns: { where: { status: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 1 },
        frameworkVersion: true,
        versions: { orderBy: { version: "desc" }, take: 20 },
        organization: { include: { branding: true } },
      },
    });
    if (!a) throw new NotFoundException("Assessment not found");

    const completed = a.participants.filter((p) => p.status === "COMPLETED").length;
    const total = a.participants.length;
    const actual: any = a.analysisRuns[0]?.result ?? {};
    const questionDims = [...new Set(a.questions.map((q) => q.dimension).filter(Boolean))] as string[];
    const frameworkDims = Array.isArray(a.frameworkVersion?.dimensions) ? a.frameworkVersion.dimensions.map(String) : [];
    const dims = questionDims.length ? questionDims : frameworkDims;
    const ds = synthetic
      ? Object.fromEntries(dims.map((d, i) => [d, Math.max(52, 84 - ((i * 9) % 27))]))
      : actual.dimensionScores ?? {};
    const dimensions = Object.entries(ds).map(([name, score]) => ({ name, score: Number(score) }));
    const overall = synthetic
      ? dimensions.length
        ? Math.round(dimensions.reduce((n, d) => n + d.score, 0) / dimensions.length)
        : 74
      : actual.overallScore ?? null;
    const responseSummaries = synthetic
      ? [
          "Las preguntas cerradas mostrarán distribución y tamaño de muestra.",
          "Ranking, matrices y repartos conservarán su lectura específica en resultados.",
        ]
      : summaries(actual, a.questions);

    const launchedBranding = ((a.versions.find(v=>v.version===a.launchedVersion)?.snapshot as any)?.branding ?? null) as any;
    const currentBranding = a.organization.branding;
    const branding = launchedBranding ?? (currentBranding ? { enabled: currentBranding.enabled, configured: Boolean(currentBranding.enabled&&currentBranding.logoDocumentId&&currentBranding.updatedBy), primaryColor: currentBranding.primaryColor, backgroundColor: currentBranding.backgroundColor, surfaceColor: currentBranding.surfaceColor, textColor: currentBranding.textColor, logoDocumentId: currentBranding.logoDocumentId, logoAltText: currentBranding.logoAltText } : undefined);
    return {
      organization: { name: a.organization.name, legalName: a.organization.legalName, country: a.organization.country },
      branding,
      title: a.title,
      objective: a.objective,
      kind: "EXECUTIVE",
      synthetic,
      generatedAt: new Date().toISOString(),
      participation: synthetic
        ? { completed: 64, total: 74, rate: 86 }
        : { completed, total, rate: total ? Math.round((completed / total) * 100) : 0 },
      overallScore: overall,
      executiveAnswer: synthetic
        ? "Esta previsualización muestra cómo Proofline sintetiza la respuesta al objetivo y conecta señal, evidencia y límites. Los valores son sintéticos y no anticipan resultados reales."
        : actual.highlights?.[0] ?? responseSummaries[0] ?? "El análisis está disponible para revisión.",
      dimensions,
      responseSummaries,
      highlights: synthetic
        ? [
            "La estructura prioriza la respuesta ejecutiva antes del detalle.",
            "Las comparaciones respetan el umbral de confidencialidad.",
            "Observación, asociación, hipótesis y recomendación permanecen diferenciadas.",
          ]
        : actual.highlights?.length
          ? actual.highlights
          : responseSummaries.slice(0, 3),
      evidence: (actual.qualitativeThemes ?? []).slice(0, 4).map((t: any) => `${t.theme}: ${t.mentions} menciones`),
      methodology: a.frameworkVersion?.methodology ?? "Assessment estructurado Proofline con estadísticas reproducibles.",
      limitations: [
        synthetic ? "Datos sintéticos: no representan resultados reales" : "Interpretar junto con participación, contexto y diseño",
        "No se generan afirmaciones causales automáticas",
      ],
    };
  }

  async generate(id: string, kind: "EXECUTIVE" | "FULL") {
    const completedAnalysis = await this.db.analysisRun.findFirst({
      where: { assessmentId: id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
    if (!completedAnalysis) throw new BadRequestException("Run and complete analysis before generating a real report");
    const result = (completedAnalysis.result ?? {}) as any;
    const hasStructuredResults =
      Boolean(result.dimensionScores && Object.keys(result.dimensionScores).length) ||
      Boolean(result.choiceDistributions && Object.keys(result.choiceDistributions).length) ||
      Boolean(result.rankingResults && Object.keys(result.rankingResults).length) ||
      Boolean(result.allocationResults && Object.keys(result.allocationResults).length) ||
      Boolean(result.matrixDistributions && Object.keys(result.matrixDistributions).length);
    if (!hasStructuredResults) throw new BadRequestException("Completed analysis has no usable structured results");

    const s = await this.snapshot(id, false);
    s.kind = kind;
    if (!s.participation.completed) throw new BadRequestException("A real report requires completed responses");
    const v = (await this.db.report.aggregate({ where: { assessmentId: id, kind }, _max: { version: true } }))._max.version ?? 0;
    return this.db.report.create({
      data: {
        assessmentId: id,
        kind,
        version: v + 1,
        snapshot: s as any,
        snapshotHash: snapshotHash(s),
        retentionUntil: new Date(Date.now() + 36 * 30 * 86400000),
      },
    });
  }

  async list(id: string) {
    return this.db.report.findMany({ where: { assessmentId: id }, include: { deliveries: { include: { recipient: true } } }, orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const r = await this.db.report.findUnique({ where: { id }, include: { assessment: { include: { organization: true } }, deliveries: { include: { recipient: true } } } });
    if (!r) throw new NotFoundException("Report not found");
    return r;
  }

  approve(id: string) {
    return this.db.report.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
  }

  async pdf(id: string) {
    const r = await this.get(id);
    return buildProoflinePdf(r.snapshot as any);
  }

  async distribute(id: string) {
    const r = await this.get(id);
    if (r.status !== "APPROVED") throw new BadRequestException("Approve report before distribution");
    const recipients = await this.db.resultRecipient.findMany({ where: { assessmentId: r.assessmentId, active: true } });
    if (!recipients.length) throw new BadRequestException("Add result recipients");
    const pdf = (await this.pdf(id)).toString("base64");
    for (const x of recipients) {
      const d = await this.db.reportDelivery.upsert({
        where: { reportId_recipientId: { reportId: id, recipientId: x.id } },
        update: { status: "PENDING", error: null, sentAt: null },
        create: { reportId: id, recipientId: x.id },
      });
      await this.db.outboxEvent.create({
        data: {
          type: "SEND_EMAIL",
          payload: {
            category: "report-distribution",
            reportId: id,
            reportDeliveryId: d.id,
            to: decryptText(x.emailEncrypted),
            subject: `Proofline · ${r.assessment.organization.name} · ${r.assessment.title}`,
            text: `${x.displayName},\n\n${r.assessment.organization.name} ha completado el assessment «${r.assessment.title}».\n\nAdjuntamos el informe ${r.kind.toLowerCase()} aprobado, versión ${r.version}. El documento incluye participación, respuesta ejecutiva, dimensiones, evidencia y limitaciones de interpretación.\n\nOrganización: ${r.assessment.organization.legalName ?? r.assessment.organization.name}${r.assessment.organization.country ? ` · ${r.assessment.organization.country}` : ""}.`,
            attachments: [{ filename: `proofline-${id}.pdf`, contentBase64: pdf, contentType: "application/pdf" }],
          },
        },
      });
    }
    return { ok: true, queued: recipients.length };
  }
}

function summaries(result: any, questions: any[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: string[] = [];
  for (const [qid, dist] of Object.entries(result.choiceDistributions ?? {})) {
    const entries = Object.entries(dist as any).sort((a: any, b: any) => Number(b[1]) - Number(a[1]));
    if (entries[0]) out.push(`${byId.get(qid)?.prompt ?? qid}: ${entries[0][0]} es la respuesta más frecuente (${entries[0][1]}).`);
  }
  for (const [qid, rows] of Object.entries(result.rankingResults ?? {})) {
    const first = (rows as any[])?.[0];
    if (first) out.push(`${byId.get(qid)?.prompt ?? qid}: ${first.option} ocupa la primera posición media (${first.averageRank}).`);
  }
  for (const [qid, vals] of Object.entries(result.allocationResults ?? {})) {
    const first = Object.entries(vals as any).sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0];
    if (first) out.push(`${byId.get(qid)?.prompt ?? qid}: ${first[0]} recibe la mayor asignación media (${first[1]}).`);
  }
  for (const [qid, rows] of Object.entries(result.matrixDistributions ?? {})) {
    out.push(`${byId.get(qid)?.prompt ?? qid}: matriz analizada en ${Object.keys(rows as object).length} filas.`);
  }
  return out.slice(0, 12);
}
