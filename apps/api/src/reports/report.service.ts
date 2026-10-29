import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { decryptText } from "../security/crypto.js";
import { buildProoflinePdf, snapshotHash } from "./pdf.js";
import {
  isReportEnvelope,
  legacyReportKind,
  normalizeReportLevel,
  reportDepth,
  reportLevelLabel,
  type CanonicalReportSnapshot,
  type ReportEnvelope,
  type ReportLevel,
} from "./report-contract.js";

@Injectable()
export class ReportService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async canonicalSnapshot(id: string, synthetic = false): Promise<CanonicalReportSnapshot> {
    const assessment = await this.db.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        participants: true,
        analysisRuns: { where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 1 },
        frameworkVersion: true,
        versions: { orderBy: { version: "desc" }, take: 20 },
        organization: { include: { branding: true } },
      },
    });
    if (!assessment) throw new NotFoundException("Assessment not found");

    const run = assessment.analysisRuns[0];
    if (!synthetic && !run) throw new BadRequestException("Run and complete analysis before generating a real report");
    const actual = (run?.result ?? {}) as any;
    const frozenVersion = run?.assessmentVersionId ? assessment.versions.find((version) => version.id === run.assessmentVersionId) : assessment.versions.find((version) => version.version === assessment.launchedVersion);
    const frozenSnapshot = (frozenVersion?.snapshot ?? null) as any;
    const sourceQuestions: any[] = Array.isArray(frozenSnapshot?.questions) && frozenSnapshot.questions.length ? frozenSnapshot.questions : assessment.questions;
    const sourceParticipants = run?.assessmentVersionId ? assessment.participants.filter((participant) => participant.assessmentVersionId === run.assessmentVersionId) : assessment.participants;
    const completed = sourceParticipants.filter((participant) => participant.status === "COMPLETED").length;
    const total = sourceParticipants.length;
    const questionDimensions = [...new Set(sourceQuestions.map((question) => question.dimension).filter(Boolean))] as string[];
    const frameworkDimensions = Array.isArray(assessment.frameworkVersion?.dimensions) ? assessment.frameworkVersion.dimensions.map(String) : [];
    const dimensionNames = questionDimensions.length ? questionDimensions : frameworkDimensions;

    const dimensionScores: Record<string, number> = synthetic
      ? Object.fromEntries(dimensionNames.map((dimension, index) => [dimension, Math.max(52, 84 - ((index * 9) % 27))]))
      : actual.dimensionScores ?? {};
    const dimensionTargets: Record<string, number> = synthetic
      ? Object.fromEntries(Object.keys(dimensionScores).map((dimension) => [dimension, 80]))
      : actual.dimensionTargets ?? {};
    const dimensionGaps: Record<string, number> = synthetic
      ? Object.fromEntries(Object.entries(dimensionScores).map(([dimension, score]) => [dimension, Math.round((80 - Number(score)) * 10) / 10]))
      : actual.dimensionGaps ?? {};
    const dimensionSamples: Record<string, number> = synthetic
      ? Object.fromEntries(Object.keys(dimensionScores).map((dimension) => [dimension, 64]))
      : actual.sampleMetadata?.dimensions ?? {};

    const dimensions = Object.entries(dimensionScores).map(([name, score]) => ({
      name,
      score: Number(score),
      target: dimensionTargets[name] == null ? null : Number(dimensionTargets[name]),
      gap: dimensionGaps[name] == null ? null : Number(dimensionGaps[name]),
      n: Number(dimensionSamples[name] ?? actual.sampleMetadata?.overallN ?? completed),
    }));

    const questionScores: Record<string, number> = actual.questionScores ?? {};
    const questionTargets: Record<string, number> = actual.questionTargets ?? {};
    const questionGaps: Record<string, number> = actual.questionGaps ?? {};
    const questionSamples: Record<string, any> = actual.sampleMetadata?.questions ?? {};
    const questions = sourceQuestions.slice().sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)).map((question, index) => {
      const syntheticScore = synthetic && question.scored ? Math.max(50, 82 - ((index * 7) % 29)) : null;
      const score = syntheticScore ?? (questionScores[question.id] == null ? null : Number(questionScores[question.id]));
      const target = synthetic && question.scored ? 80 : (questionTargets[question.id] == null ? null : Number(questionTargets[question.id]));
      const gap = score == null || target == null ? null : Math.round((target - score) * 10) / 10;
      const sample = synthetic && question.scored
        ? { total: 74, answered: 68, scored: 64, na: 2, missing: 6, invalid: 2 }
        : normalizeSample(questionSamples[question.id]);
      return {
        id: question.id,
        code: question.code ?? `Q${String(question.order).padStart(2, "0")}`,
        prompt: question.prompt,
        type: String(question.type),
        dimension: question.dimension,
        scored: question.scored,
        score,
        target,
        gap: synthetic ? gap : (questionGaps[question.id] == null ? gap : Number(questionGaps[question.id])),
        sample,
      };
    });

    const responseSummaries = synthetic
      ? [
          "Las preguntas cerradas muestran distribución y tamaño de muestra.",
          "Ranking, matrices y repartos conservan su lectura específica en resultados.",
        ]
      : summaries(actual, sourceQuestions);
    const highlights = synthetic
      ? [
          "La estructura prioriza la respuesta ejecutiva antes del detalle.",
          "Las comparaciones respetan el umbral de confidencialidad.",
          "Observación, asociación, hipótesis y recomendación permanecen diferenciadas.",
        ]
      : Array.isArray(actual.highlights) && actual.highlights.length
        ? actual.highlights.map(String)
        : responseSummaries.slice(0, 3);
    const qualitativeThemes = synthetic
      ? [
          { theme: "claridad", mentions: 18, example: "Necesitamos mayor claridad sobre prioridades y decisiones." },
          { theme: "coordinación", mentions: 12, example: "La coordinación entre áreas aparece como señal recurrente." },
        ]
      : Array.isArray(actual.qualitativeThemes)
        ? actual.qualitativeThemes.map((theme: any) => ({ theme: String(theme?.theme ?? "tema"), mentions: Number(theme?.mentions ?? 0), example: theme?.example == null ? null : String(theme.example) }))
        : [];

    const cohorts = synthetic ? { visible: [] as Array<{ key: string; n: number; score: number | null }>, suppressedCount: 0 } : safeCohorts(actual.cohorts);
    const launchedBranding = (frozenSnapshot?.branding ?? (assessment.versions.find((version) => version.version === assessment.launchedVersion)?.snapshot as any)?.branding ?? null) as any;
    const currentBranding = assessment.organization.branding;
    const branding = launchedBranding ?? (currentBranding ? {
      enabled: currentBranding.enabled,
      configured: Boolean(currentBranding.enabled && currentBranding.logoDocumentId && currentBranding.updatedBy),
      primaryColor: currentBranding.primaryColor,
      backgroundColor: currentBranding.backgroundColor,
      surfaceColor: currentBranding.surfaceColor,
      textColor: currentBranding.textColor,
      logoDocumentId: currentBranding.logoDocumentId,
      logoAltText: currentBranding.logoAltText,
    } : undefined);

    const overall = synthetic
      ? dimensions.length ? Math.round((dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length) * 10) / 10 : 74
      : actual.overallScore == null ? null : Number(actual.overallScore);
    const overallTarget = synthetic ? 80 : (actual.overallTarget == null ? null : Number(actual.overallTarget));
    const overallGap = overall == null || overallTarget == null ? null : (actual.overallGap == null ? Math.round((overallTarget - overall) * 10) / 10 : Number(actual.overallGap));
    const stableGeneratedAt = synthetic
      ? new Date().toISOString()
      : String(actual.generatedAt ?? run?.completedAt?.toISOString() ?? run?.createdAt.toISOString());

    return {
      schemaVersion: "proofline-report-snapshot-v1",
      organization: { name: assessment.organization.name, legalName: assessment.organization.legalName, country: assessment.organization.country },
      branding,
      assessment: {
        id: assessment.id,
        title: String(frozenSnapshot?.title ?? assessment.title),
        objective: String(frozenSnapshot?.objective ?? assessment.objective),
        level: String(frozenSnapshot?.level ?? assessment.level),
        privacyMode: String(frozenSnapshot?.privacyMode ?? assessment.privacyMode),
        minCohortSize: Number(frozenSnapshot?.minCohortSize ?? assessment.minCohortSize),
        assessmentVersionId: run?.assessmentVersionId ?? frozenVersion?.id ?? null,
        assessmentVersion: actual.assessmentVersion == null ? (frozenVersion?.version ?? assessment.launchedVersion) : Number(actual.assessmentVersion),
      },
      source: {
        synthetic,
        analysisRunId: run?.id ?? null,
        sourceHash: synthetic ? null : String(actual.sourceHash ?? run?.sourceHash ?? "") || null,
        calculationHash: synthetic ? null : String(actual.calculationHash ?? "") || null,
        engineName: synthetic ? "proofline-preview" : String(actual.engine?.name ?? "proofline-deterministic"),
        engineVersion: synthetic ? "synthetic" : String(actual.engine?.version ?? run?.engineVersion ?? "unknown"),
        generatedAt: stableGeneratedAt,
      },
      participation: synthetic ? { completed: 64, total: 74, rate: 86 } : { completed, total, rate: total ? Math.round((completed / total) * 100) : 0 },
      score: {
        overall,
        target: overallTarget,
        gap: overallGap,
        gapConvention: String(actual.gapConvention ?? "target-minus-observed"),
        n: synthetic ? 64 : Number(actual.sampleMetadata?.overallN ?? completed),
      },
      dimensions,
      questions,
      responseSummaries,
      highlights,
      qualitativeThemes,
      cohorts,
      distributions: {
        choice: (actual.choiceDistributions ?? {}) as Record<string, Record<string, number>>,
        ranking: (actual.rankingResults ?? {}) as Record<string, Array<{ option: string; averageRank: number; n: number }>>,
        allocation: (actual.allocationResults ?? {}) as Record<string, Record<string, number>>,
        matrix: (actual.matrixDistributions ?? {}) as Record<string, Record<string, Record<string, number>>>,
      },
      methodology: assessment.frameworkVersion?.methodology ?? "Assessment estructurado Proofline con scoring determinista, versionado y trazabilidad de fuente.",
      evidencePolicy: String(actual.evidencePolicy ?? "Sólo observación; no se generan afirmaciones causales automáticas."),
      limitations: [
        synthetic ? "Datos sintéticos: no representan resultados reales" : "Interpretar junto con participación, contexto y diseño",
        "No se generan afirmaciones causales automáticas",
        ...(Array.isArray(actual.targetWarnings) && actual.targetWarnings.length ? ["Algunos targets configurados no pudieron convertirse a la escala de scoring y se excluyeron de gaps agregados"] : []),
      ],
    };
  }

  async preview(id: string, synthetic = false, requestedLevel: unknown = "L1_EXECUTIVE") {
    const level = normalizeReportLevel(requestedLevel);
    const canonical = await this.canonicalSnapshot(id, synthetic);
    return present(canonical, level);
  }

  async generate(id: string, requestedLevel: unknown, actorId = "system") {
    const level = normalizeReportLevel(requestedLevel);
    const completedAnalysis = await this.db.analysisRun.findFirst({ where: { assessmentId: id, status: "COMPLETED" }, orderBy: { completedAt: "desc" } });
    if (!completedAnalysis) throw new BadRequestException("Run and complete analysis before generating a real report");
    const result = (completedAnalysis.result ?? {}) as any;
    const hasStructuredResults = Boolean(result.dimensionScores && Object.keys(result.dimensionScores).length)
      || Boolean(result.choiceDistributions && Object.keys(result.choiceDistributions).length)
      || Boolean(result.rankingResults && Object.keys(result.rankingResults).length)
      || Boolean(result.allocationResults && Object.keys(result.allocationResults).length)
      || Boolean(result.matrixDistributions && Object.keys(result.matrixDistributions).length);
    if (!hasStructuredResults) throw new BadRequestException("Completed analysis has no usable structured results");

    const canonical = await this.canonicalSnapshot(id, false);
    if (!canonical.participation.completed) throw new BadRequestException("A real report requires completed responses");
    const envelope: ReportEnvelope = { schemaVersion: "proofline-report-envelope-v2", level, canonical };
    const existing = await this.db.report.findMany({ where: { assessmentId: id }, select: { version: true, kind: true, snapshot: true } });
    const version = existing.filter((row) => storedLevel(row.kind, row.snapshot) === level).reduce((max, row) => Math.max(max, row.version), 0) + 1;
    const report = await this.db.report.create({
      data: {
        assessmentId: id,
        kind: legacyReportKind(level),
        version,
        snapshot: envelope as any,
        snapshotHash: snapshotHash(canonical),
        retentionUntil: new Date(Date.now() + 36 * 30 * 86400000),
      },
    });
    const assessmentMeta = await this.db.assessment.findUniqueOrThrow({ where: { id }, select: { organizationId: true } });
    await this.audit.record({ organizationId: assessmentMeta.organizationId, actorType: actorId === "system" ? "SYSTEM" : "USER", actorId, action: "REPORT_GENERATED", targetType: "Report", targetId: report.id, metadata: { assessmentId: id, level, version, snapshotHash: report.snapshotHash } });
    return report;
  }

  async list(id: string) {
    const rows = await this.db.report.findMany({ where: { assessmentId: id }, include: { deliveries: { include: { recipient: true } } }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({ ...row, level: storedLevel(row.kind, row.snapshot), levelLabel: reportLevelLabel(storedLevel(row.kind, row.snapshot), "es") }));
  }

  async get(id: string) {
    const report = await this.db.report.findUnique({ where: { id }, include: { assessment: { include: { organization: true } }, deliveries: { include: { recipient: true } } } });
    if (!report) throw new NotFoundException("Report not found");
    return { ...report, level: storedLevel(report.kind, report.snapshot) };
  }

  async approve(id: string, actorId = "system") {
    const current = await this.get(id);
    const report = await this.db.report.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    await this.audit.record({ organizationId: current.assessment.organizationId, actorType: actorId === "system" ? "SYSTEM" : "USER", actorId, action: "REPORT_APPROVED", targetType: "Report", targetId: id, metadata: { assessmentId: current.assessmentId, level: current.level, version: current.version, snapshotHash: current.snapshotHash } });
    return report;
  }

  async view(id: string) {
    const report = await this.get(id);
    const { canonical, level } = canonicalFromStored(report.snapshot, report.kind);
    return { ...present(canonical, level), reportId: report.id, version: report.version, status: report.status, snapshotHash: report.snapshotHash };
  }

  async pdf(id: string) {
    const report = await this.get(id);
    const { canonical, level } = canonicalFromStored(report.snapshot, report.kind);
    return buildProoflinePdf(canonical, level);
  }

  async exportJson(id: string) {
    const report = await this.get(id);
    const { canonical, level } = canonicalFromStored(report.snapshot, report.kind);
    return Buffer.from(JSON.stringify({ reportId: report.id, level, levelLabel: reportLevelLabel(level, "es"), version: report.version, snapshotHash: report.snapshotHash, snapshot: canonical }, null, 2), "utf8");
  }

  async exportCsv(id: string) {
    const report = await this.get(id);
    const { canonical, level } = canonicalFromStored(report.snapshot, report.kind);
    const rows = [
      ["recordType", "code", "label", "dimension", "score", "target", "gap", "n", "snapshotHash", "reportLevel"],
      ["overall", "", canonical.assessment.title, "", canonical.score.overall, canonical.score.target, canonical.score.gap, canonical.score.n, report.snapshotHash, level],
      ...canonical.dimensions.map((dimension) => ["dimension", "", dimension.name, dimension.name, dimension.score, dimension.target, dimension.gap, dimension.n, report.snapshotHash, level]),
      ...canonical.questions.filter((question) => question.scored).map((question) => ["question", question.code, question.prompt, question.dimension ?? "", question.score, question.target, question.gap, question.sample?.scored ?? 0, report.snapshotHash, level]),
    ];
    return Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "utf8");
  }

  // Queue creation is a single, auditable transaction. A conditional report
  // claim stops two concurrent requests from scheduling the same recipients.
  // Keep distributedAt for actual completion (the worker owns that field).
  async distribute(id: string, actorId = "system") {
    const report = await this.get(id);
    if (report.status !== "APPROVED") throw new BadRequestException("Approve report before distribution");
    if (report.distributedAt) throw new ConflictException("This report was already distributed. Review its deliveries");
    // Generate the attachment before claiming the report, so rendering errors
    // never leave the report locked without queue jobs.
    const pdf = (await this.pdf(id)).toString("base64");
    const level = normalizeReportLevel(report.level);
    let queued = 0;
    await this.db.$transaction(async (tx) => {
      // Optimistic report claim uses @updatedAt, without changing the meaning
      // of distributedAt (which means all emails have been processed as SENT).
      const previousUpdate = new Date(report.updatedAt);
      const claim = await tx.report.updateMany({
        where: { id, status: "APPROVED", updatedAt: previousUpdate },
        data: { updatedAt: new Date(Math.max(Date.now(), previousUpdate.getTime() + 1)) },
      });
      if (claim.count !== 1) throw new ConflictException("Report distribution has already been requested");
      // Also guard reports queued by older versions, before distributedAt was set.
      const existing = await tx.reportDelivery.count({ where: { reportId: id } });
      if (existing) throw new ConflictException("Existing deliveries found; review them before retrying failed recipients");
      const recipients = await tx.resultRecipient.findMany({ where: { assessmentId: report.assessmentId, active: true } });
      if (!recipients.length) throw new BadRequestException("Add result recipients");
      queued = recipients.length;
      for (const recipient of recipients) {
        const delivery = await tx.reportDelivery.create({ data: { reportId: id, recipientId: recipient.id } });
        await tx.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: reportDeliveryPayload(report, recipient, delivery.id, level, pdf) } });
      }
      await tx.auditEvent.create({ data: {
        organizationId: report.assessment.organizationId,
        actorType: actorId === "system" ? "SYSTEM" : "USER", actorId,
        action: "REPORT_DISTRIBUTION_QUEUED", targetType: "Report", targetId: id,
        metadata: { assessmentId: report.assessmentId, level, recipients: recipients.length, snapshotHash: report.snapshotHash },
      } });
    }, { timeout: 30000 });
    return { ok: true, queued, level, snapshotHash: report.snapshotHash };
  }

  // Explicit recovery of FAILED deliveries only. Never resend SENT deliveries,
  // and never interfere with jobs still PENDING. Claim failures atomically.
  async retryFailedDeliveries(id: string, actorId = "system") {
    const report = await this.get(id);
    if (report.status !== "APPROVED")
      throw new BadRequestException("Only approved reports with failed deliveries can be retried");
    const [pending, failed] = await Promise.all([
      this.db.reportDelivery.count({ where: { reportId: id, status: "PENDING" } }),
      this.db.reportDelivery.findMany({ where: { reportId: id, status: "FAILED" }, include: { recipient: true } }),
    ]);
    if (pending) throw new ConflictException("Wait for pending deliveries before retrying failures");
    if (!failed.length) throw new BadRequestException("No failed deliveries to retry");
    if (failed.some((delivery) => !delivery.recipient?.active))
      throw new ConflictException("A recipient is no longer active; review recipients before retrying");
    const pdf = (await this.pdf(id)).toString("base64");
    const level = normalizeReportLevel(report.level);
    await this.db.$transaction(async (tx) => {
      // The report row is not mutated; each FAILED delivery is claimed once.
      const stillPending = await tx.reportDelivery.count({ where: { reportId: id, status: "PENDING" } });
      if (stillPending) throw new ConflictException("Delivery state changed; refresh before retrying");
      for (const delivery of failed) {
        const claim = await tx.reportDelivery.updateMany({
          where: { id: delivery.id, reportId: id, status: "FAILED" },
          data: { status: "PENDING", error: null, sentAt: null },
        });
        if (claim.count !== 1) throw new ConflictException("Delivery changed while preparing a retry");
        await tx.outboxEvent.create({ data: {
          type: "SEND_EMAIL", payload: reportDeliveryPayload(report, delivery.recipient, delivery.id, level, pdf),
        } });
      }
      await tx.auditEvent.create({ data: {
        organizationId: report.assessment.organizationId,
        actorType: actorId === "system" ? "SYSTEM" : "USER", actorId,
        action: "REPORT_FAILED_DELIVERIES_RETRY_QUEUED", targetType: "Report", targetId: id,
        metadata: { assessmentId: report.assessmentId, level, recipients: failed.length, snapshotHash: report.snapshotHash },
      } });
    }, { timeout: 30000 });
    return { ok: true, queued: failed.length, failedOnly: true, level, snapshotHash: report.snapshotHash };
  }

}


// Server-owned attachment envelope; recipient contact data stays in the outbox,
// never in the controller response or audit metadata.
function reportDeliveryPayload(report: any, recipient: any, deliveryId: string, level: ReportLevel, pdf: string) {
  return {
    category: "report-distribution", assessmentId: report.assessmentId, reportId: report.id,
    reportDeliveryId: deliveryId, locale: recipient.locale === "en" ? "en" : "es",
    to: decryptText(recipient.emailEncrypted),
    subject: `Proofline · ${report.assessment.organization.name} · ${report.assessment.title}`,
    text: `${recipient.displayName},\n\n${report.assessment.organization.name} ha completado el assessment «${report.assessment.title}».\n\nAdjuntamos el informe ${reportLevelLabel(level, "es")}, versión ${report.version}, aprobado y trazable al snapshot ${report.snapshotHash.slice(0, 12)}.\n\nOrganización: ${report.assessment.organization.legalName ?? report.assessment.organization.name}${report.assessment.organization.country ? ` · ${report.assessment.organization.country}` : ""}.`,
    attachments: [{ filename: `proofline-${level.toLowerCase()}-${report.id}.pdf`, contentBase64: pdf, contentType: "application/pdf" }],
  };
}

function normalizeSample(value: any) {
  if (!value || typeof value !== "object") return null;
  return {
    total: Number(value.total ?? 0),
    answered: Number(value.answered ?? 0),
    scored: Number(value.scored ?? 0),
    na: Number(value.na ?? 0),
    missing: Number(value.missing ?? 0),
    invalid: Number(value.invalid ?? 0),
  };
}

function safeCohorts(value: unknown) {
  const visible: Array<{ key: string; n: number; score: number | null }> = [];
  let suppressedCount = 0;
  if (!value || typeof value !== "object") return { visible, suppressedCount };
  for (const [key, raw] of Object.entries(value as Record<string, any>)) {
    if (raw?.suppressed) { suppressedCount += 1; continue; }
    visible.push({ key, n: Number(raw?.n ?? 0), score: raw?.score == null ? null : Number(raw.score) });
  }
  return { visible, suppressedCount };
}

function summaries(result: any, questions: any[]) {
  const byId = new Map(questions.map((question) => [question.id, question]));
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
  for (const [qid, rows] of Object.entries(result.matrixDistributions ?? {})) out.push(`${byId.get(qid)?.prompt ?? qid}: matriz analizada en ${Object.keys(rows as object).length} filas.`);
  return out.slice(0, 12);
}

function storedLevel(kind: unknown, snapshot: unknown): ReportLevel {
  if (isReportEnvelope(snapshot)) return normalizeReportLevel(snapshot.level);
  return normalizeReportLevel(kind);
}

function canonicalFromStored(snapshot: unknown, kind: unknown): { canonical: CanonicalReportSnapshot; level: ReportLevel } {
  if (isReportEnvelope(snapshot)) return { canonical: snapshot.canonical, level: normalizeReportLevel(snapshot.level) };
  const legacy = snapshot as any;
  const level = normalizeReportLevel(kind);
  const dimensions = Array.isArray(legacy?.dimensions) ? legacy.dimensions.map((dimension: any) => ({ name: String(dimension.name), score: Number(dimension.score), target: null, gap: null, n: Number(legacy?.participation?.completed ?? 0) })) : [];
  return {
    level,
    canonical: {
      schemaVersion: "proofline-report-snapshot-v1",
      organization: legacy?.organization ?? { name: "Proofline" },
      branding: legacy?.branding,
      assessment: { id: "legacy", title: String(legacy?.title ?? "Informe Proofline"), objective: String(legacy?.objective ?? ""), level: "L2", privacyMode: "CONFIDENTIAL", minCohortSize: 5, assessmentVersionId: null, assessmentVersion: null },
      source: { synthetic: Boolean(legacy?.synthetic), analysisRunId: null, sourceHash: null, calculationHash: null, engineName: "legacy", engineVersion: "legacy", generatedAt: String(legacy?.generatedAt ?? new Date(0).toISOString()) },
      participation: legacy?.participation ?? { completed: 0, total: 0, rate: 0 },
      score: { overall: legacy?.overallScore ?? null, target: null, gap: null, gapConvention: "target-minus-observed", n: Number(legacy?.participation?.completed ?? 0) },
      dimensions,
      questions: [],
      responseSummaries: Array.isArray(legacy?.responseSummaries) ? legacy.responseSummaries : [],
      highlights: Array.isArray(legacy?.highlights) ? legacy.highlights : [],
      qualitativeThemes: [],
      cohorts: { visible: [], suppressedCount: 0 },
      distributions: { choice: {}, ranking: {}, allocation: {}, matrix: {} },
      methodology: String(legacy?.methodology ?? "Informe histórico Proofline."),
      evidencePolicy: "Snapshot histórico anterior a C2.5.4.",
      limitations: Array.isArray(legacy?.limitations) ? legacy.limitations : ["Snapshot histórico con contrato de reporting anterior."],
    },
  };
}

function present(canonical: CanonicalReportSnapshot, level: ReportLevel) {
  const depth = reportDepth(level);
  const hash = snapshotHash(canonical);
  const priorities = canonical.dimensions.slice().sort((a, b) => {
    const ga = a.gap == null ? 0 : Math.abs(a.gap); const gb = b.gap == null ? 0 : Math.abs(b.gap);
    return gb - ga || a.score - b.score;
  }).slice(0, depth >= 4 ? 6 : 3);
  return {
    level,
    levelLabel: reportLevelLabel(level, "es"),
    depth,
    snapshotHash: hash,
    synthetic: canonical.source.synthetic,
    organization: canonical.organization,
    branding: canonical.branding,
    title: canonical.assessment.title,
    objective: canonical.assessment.objective,
    generatedAt: canonical.source.generatedAt,
    participation: canonical.participation,
    overallScore: canonical.score.overall,
    overallTarget: canonical.score.target,
    overallGap: canonical.score.gap,
    overallN: canonical.score.n,
    executiveAnswer: canonical.highlights[0] ?? canonical.responseSummaries[0] ?? "El análisis está disponible para revisión.",
    dimensions: canonical.dimensions,
    responseSummaries: canonical.responseSummaries,
    highlights: canonical.highlights,
    evidence: canonical.qualitativeThemes.map((theme) => `${theme.theme}: ${theme.mentions} menciones`),
    methodology: canonical.methodology,
    evidencePolicy: canonical.evidencePolicy,
    limitations: canonical.limitations,
    questions: depth >= 3 ? canonical.questions : [],
    cohorts: depth >= 3 ? canonical.cohorts : { visible: [], suppressedCount: canonical.cohorts.suppressedCount },
    qualitativeThemes: depth >= 3 ? canonical.qualitativeThemes : [],
    distributions: depth >= 3 ? canonical.distributions : { choice: {}, ranking: {}, allocation: {}, matrix: {} },
    priorities: depth >= 2 ? priorities : [],
    source: depth >= 4 ? canonical.source : { synthetic: canonical.source.synthetic, generatedAt: canonical.source.generatedAt },
  };
}

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
