import { Body, ConflictException, Controller, Get, Param, Post, Query, UseGuards, Inject } from "@nestjs/common";
import { z } from "zod";
import { ServiceTokenGuard } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { sha256 } from "../security/crypto.js";
import { redactFreeTextPII } from "../security/pii.js";
import { SupportService } from "../support/support.service.js";
import { AuditService } from "../audit/audit.service.js";

const Completion = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  claimToken: z.string().optional(),
  failureCode: z.enum(["SMTP_TEMPORARY", "SMTP_PERMANENT", "SMTP_UNCERTAIN"]).optional(),
});
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_STALE_AFTER_MS = 10 * 60_000;
const EMAIL_RETRY_BASE_MS = 60_000;
const EMAIL_RETRY_MAX_MS = 30 * 60_000;
const EMAIL_UNCERTAIN_ERROR = "EMAIL_DELIVERY_UNCERTAIN: check SMTP delivery evidence before manual retry";


function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function sourceHashFor(value: unknown) {
  return sha256(JSON.stringify(canonicalize(value)));
}

@Controller("v1/internal")
@UseGuards(ServiceTokenGuard)
export class InternalController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SupportService) private readonly support: SupportService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post("support/escalate-due")
  async supportEscalations() { return this.support.processSlaEscalations(); }

  // Recover only email jobs: a stale SMTP attempt has an UNKNOWN delivery outcome.
  // Replaying it automatically could send the same message twice.
  @Post("jobs/recover-stale-emails")
  async recoverStaleEmails() {
    const cutoff = new Date(Date.now() - EMAIL_STALE_AFTER_MS);
    return this.db.$transaction(async (tx) => {
      const stale = await tx.outboxEvent.findMany({
        where: {
          type: "SEND_EMAIL", status: "PROCESSING",
          OR: [{ lockedAt: { lt: cutoff } }, { lockedAt: null, updatedAt: { lt: cutoff } }],
        },
        orderBy: { updatedAt: "asc" }, take: 100,
        select: { id: true, lockedAt: true, attempts: true, payload: true },
      });
      let quarantined = 0;
      for (const job of stale) {
        const matched = await tx.outboxEvent.updateMany({
          where: { id: job.id, type: "SEND_EMAIL", status: "PROCESSING", lockedAt: job.lockedAt },
          data: { status: "FAILED", lockedAt: null, error: EMAIL_UNCERTAIN_ERROR },
        });
        if (matched.count !== 1) continue;
        quarantined++;
        const payload = job.payload as Record<string, unknown>;
        await tx.auditEvent.create({ data: {
          ...(typeof payload.organizationId === "string" ? { organizationId: payload.organizationId } : {}),
          actorType: "SYSTEM", actorId: "proofline-worker", action: "EMAIL_DELIVERY_UNCERTAIN",
          targetType: "OutboxEvent", targetId: job.id,
          metadata: { attempts: job.attempts, category: typeof payload.category === "string" ? payload.category : "email", requiresManualReview: true },
        } });
      }
      return { quarantined, reviewed: stale.length, remainingMayExist: stale.length === 100 };
    });
  }

  @Get("jobs/next")
  async next() {
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const job = await tx.outboxEvent.findFirst({
          where: { status: "PENDING", availableAt: { lte: now } },
          orderBy: { createdAt: "asc" },
        });
        if (!job) return null;
        const claimed = await tx.outboxEvent.updateMany({
          where: { id: job.id, status: "PENDING", availableAt: { lte: now } },
          data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
        });
        if (claimed.count === 1) return tx.outboxEvent.findUniqueOrThrow({ where: { id: job.id } });
      }
      return null; // another worker won the claim; retry next poll
    });
  }

  private async completeEmailJob(id: string, job: {
    lockedAt: Date | null;
    attempts: number;
    payload: unknown;
  }, value: z.infer<typeof Completion>) {
    const claimToken = job.lockedAt?.toISOString();
    if (!claimToken || value.claimToken !== claimToken) throw new ConflictException("Email job claim expired or does not match");
    const payload = job.payload as Record<string, unknown>;
    const result = value.result && typeof value.result === "object" ? value.result as Record<string, unknown> : {};
    const messageId = typeof result.messageId === "string" && result.messageId.trim() ? result.messageId : null;
    if (value.ok && !messageId) throw new ConflictException("SMTP acknowledgement has no messageId; manual reconciliation required");
    const retry = !value.ok && value.failureCode === "SMTP_TEMPORARY" && job.attempts < MAX_EMAIL_ATTEMPTS;
    const delay = Math.min(EMAIL_RETRY_BASE_MS * 2 ** Math.max(0, job.attempts - 1), EMAIL_RETRY_MAX_MS);
    const category = typeof result.category === "string" ? result.category : (typeof payload.category === "string" ? payload.category : "email");
    const templateId = typeof result.templateId === "string" ? result.templateId : null;
    const templateVersion = typeof result.templateVersion === "string" ? result.templateVersion : null;
    const family = typeof result.family === "string" ? result.family : null;
    const code = value.failureCode ?? "SMTP_UNCERTAIN";
    const scrubbedPayload = {
      scrubbed: true, category,
      ...(typeof payload.organizationId === "string" ? { organizationId: payload.organizationId } : {}),
      ...(typeof payload.ticketId === "string" ? { ticketId: payload.ticketId } : {}),
      ...(typeof payload.assessmentId === "string" ? { assessmentId: payload.assessmentId } : {}),
      ...(typeof payload.assessmentVersionId === "string" ? { assessmentVersionId: payload.assessmentVersionId } : {}),
      ...(typeof payload.reportId === "string" ? { reportId: payload.reportId } : {}),
      ...(typeof payload.reportDeliveryId === "string" ? { reportDeliveryId: payload.reportDeliveryId } : {}),
    };
    return this.db.$transaction(async (tx) => {
      const matched = await tx.outboxEvent.updateMany({
        where: { id, status: "PROCESSING", lockedAt: job.lockedAt },
        data: value.ok
          ? { status: "COMPLETED", lockedAt: null, error: null, result: {
              messageId, category, templateId, templateVersion, family, html: result.html === true, text: result.text === true,
            }, payload: scrubbedPayload }
          : retry
            ? { status: "PENDING", lockedAt: null, availableAt: new Date(Date.now() + delay), error: "SMTP_TEMPORARY: retry scheduled" }
            : { status: "FAILED", lockedAt: null, error: `${code}: delivery not confirmed; manual review before retry` },
      });
      if (matched.count !== 1) throw new ConflictException("Email job was already completed, retried or reclaimed");

      let organizationId = typeof payload.organizationId === "string" ? payload.organizationId : undefined;
      if (!organizationId && typeof payload.assessmentId === "string") {
        organizationId = (await tx.assessment.findUnique({ where: { id: payload.assessmentId }, select: { organizationId: true } }))?.organizationId;
      }
      if (typeof payload.reportDeliveryId === "string" && !retry) {
        const delivery = await tx.reportDelivery.update({
          where: { id: payload.reportDeliveryId },
          data: value.ok ? { status: "SENT", sentAt: new Date(), error: null } : { status: "FAILED", error: `${code}: delivery not confirmed` },
        });
        const report = await tx.report.findUnique({
          where: { id: delivery.reportId }, include: { assessment: { select: { organizationId: true } } },
        });
        if (report) {
          organizationId ??= report.assessment.organizationId;
          await tx.auditEvent.create({ data: {
            organizationId: report.assessment.organizationId, actorType: "SYSTEM", actorId: "proofline-worker",
            action: value.ok ? "REPORT_DELIVERY_SENT" : "REPORT_DELIVERY_FAILED", targetType: "ReportDelivery", targetId: delivery.id,
            metadata: { reportId: delivery.reportId, assessmentId: report.assessmentId, errorCode: value.ok ? null : code },
          } });
        }
        if (value.ok) {
          const remaining = await tx.reportDelivery.count({ where: { reportId: delivery.reportId, status: { not: "SENT" } } });
          if (remaining === 0) await tx.report.update({ where: { id: delivery.reportId }, data: { status: "DISTRIBUTED", distributedAt: new Date() } });
        }
      }
      await tx.auditEvent.create({ data: {
        ...(organizationId ? { organizationId } : {}),
        actorType: "SYSTEM", actorId: "proofline-worker",
        action: value.ok ? "EMAIL_DELIVERED" : retry ? "EMAIL_DELIVERY_RETRY_SCHEDULED" : "EMAIL_DELIVERY_FAILED",
        targetType: "OutboxEvent", targetId: id,
        metadata: { category, templateId, templateVersion, family, messageId: value.ok ? messageId : null,
          attempts: job.attempts, errorCode: value.ok ? null : code, ...(retry ? { retryDelayMs: delay } : {}) },
      } });
      return { ok: true, status: value.ok ? "COMPLETED" : retry ? "PENDING" : "FAILED" };
    });
  }

  @Get("analysis-payload/:assessmentId")
  async payload(@Param("assessmentId") assessmentId: string, @Query("analysisRunId") analysisRunId?: string) {
    const run = analysisRunId
      ? await this.db.analysisRun.findFirst({ where: { id: analysisRunId, assessmentId } })
      : await this.db.analysisRun.findFirst({ where: { assessmentId }, orderBy: { createdAt: "desc" } });

    const a = await this.db.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { order: "asc" } },
        versions: { orderBy: { version: "desc" }, take: 20 },
        participants: {
          where: { status: "COMPLETED" },
          include: { identity: true, response: { include: { answers: true } } },
        },
      },
    });

    const version = run?.assessmentVersionId
      ? a.versions.find((v) => v.id === run.assessmentVersionId) ?? await this.db.assessmentVersion.findUnique({ where: { id: run.assessmentVersionId } })
      : a.launchedVersion
        ? a.versions.find((v) => v.version === a.launchedVersion) ?? await this.db.assessmentVersion.findUnique({ where: { assessmentId_version: { assessmentId, version: a.launchedVersion } } })
        : null;
    const snapshot = (version?.snapshot ?? null) as any;
    const snapshotQuestions = Array.isArray(snapshot?.questions) && snapshot.questions.every((q: any) => q?.id)
      ? snapshot.questions
      : null;
    const questions = snapshotQuestions ?? a.questions.map((q) => ({
      id: q.id,
      code: q.code,
      type: q.type,
      prompt: q.prompt,
      dimension: q.dimension,
      scored: !["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(q.type) && q.scored,
      weight: q.weight,
      polarity: q.polarity,
      reverseScore: q.reverseScore,
      config: q.config,
    }));

    const questionType = new Map(questions.map((q: any) => [String(q.id), String(q.type)] as const));
    const validQuestionIds = new Set(questions.map((q: any) => String(q.id)));
    const safe = (qid: string, value: unknown) => {
      const type = questionType.get(qid);
      return (type === "LONG_TEXT" || type === "SHORT_TEXT") && typeof value === "string" ? redactFreeTextPII(value) : value;
    };

    const responses: any[] = [];
    for (const p of a.participants) {
      if (!p.response) continue;
      if (version?.id && p.assessmentVersionId && p.assessmentVersionId !== version.id) continue;
      const segments: Record<string, string> = {};
      if (p.segmentSnapshot && typeof p.segmentSnapshot === "object") {
        for (const [key, value] of Object.entries(p.segmentSnapshot as Record<string, unknown>)) if (typeof value === "string") segments[key] = value;
      }
      responses.push({
        participant: p.pseudonym,
        segments,
        answers: Object.fromEntries(p.response.answers.filter((x) => validQuestionIds.has(x.questionId)).map((x) => [x.questionId, safe(x.questionId, x.value)])),
      });
    }

    responses.sort((left, right) => String(left.participant).localeCompare(String(right.participant)));
    const payload = {
      assessmentId: a.id,
      assessmentVersionId: version?.id ?? null,
      assessmentVersion: version?.version ?? null,
      assessmentLevel: snapshot?.level ?? a.level,
      scoringConfig: snapshot?.scoringConfig ?? a.scoringConfig ?? { version: 1, scale: "0-100", dimensionWeights: {} },
      title: snapshot?.title ?? a.title,
      objective: snapshot?.objective ?? a.objective,
      locale: snapshot?.locale ?? a.locale,
      minCohortSize: snapshot?.minCohortSize ?? a.minCohortSize,
      population: snapshot?.population ?? null,
      questions: questions.map((q: any) => ({
        id: String(q.id),
        code: q.code ?? null,
        type: q.type,
        prompt: q.prompt,
        dimension: q.dimension ?? null,
        scored: !["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(String(q.type)) && (q.scored ?? true),
        weight: Number(q.weight ?? 1),
        polarity: q.polarity ?? (q.reverseScore ? "REVERSE" : "POSITIVE"),
        reverseScore: Boolean(q.reverseScore),
        config: q.config ?? null,
      })),
      responses,
    };
    const sourceHash = sourceHashFor(payload);
    if (run?.id && run.sourceHash !== sourceHash) {
      await this.db.analysisRun.update({ where: { id: run.id }, data: { sourceHash } });
    }
    return { ...payload, sourceHash };
  }

  @Post("jobs/:id/complete")
  async complete(@Param("id") id: string, @Body() body: unknown) {
    const value = Completion.parse(body);
    const job = await this.db.outboxEvent.findUniqueOrThrow({ where: { id } });
    if (job.type === "SEND_EMAIL") {
      if (job.status !== "PROCESSING") throw new ConflictException("Email job is not processing");
      return this.completeEmailJob(id, job, value);
    }
    const payload = job.payload as Record<string, unknown>;
    let completionOk = value.ok;
    let completionError = value.error;

    if (job.type === "RUN_ANALYSIS" && typeof payload.analysisRunId === "string") {
      const existingRun = await this.db.analysisRun.findUniqueOrThrow({ where: { id: payload.analysisRunId } });
      const result = value.result && typeof value.result === "object" ? value.result as Record<string, any> : null;
      const resultSourceHash = typeof result?.sourceHash === "string" ? result.sourceHash : undefined;
      const calculationHash = typeof result?.calculationHash === "string" ? result.calculationHash : undefined;
      const expectedSourceHash = existingRun.sourceHash ?? undefined;
      const expectedAssessmentId = typeof payload.assessmentId === "string" ? payload.assessmentId : existingRun.assessmentId;
      const resultAssessmentId = typeof result?.assessmentId === "string" ? result.assessmentId : undefined;
      const engineName = typeof result?.engine?.name === "string" ? result.engine.name : undefined;
      const engineVersion = typeof result?.engine?.version === "string" ? result.engine.version : undefined;

      if (value.ok) {
        if (!expectedSourceHash || !/^[a-f0-9]{64}$/i.test(expectedSourceHash)) {
          completionOk = false;
          completionError = "AnalysisRun sourceHash was not prepared before worker completion; API/runtime contract may be stale";
        } else if (!resultSourceHash || !/^[a-f0-9]{64}$/i.test(resultSourceHash)) {
          completionOk = false;
          completionError = "Analytics result sourceHash is missing or invalid";
        } else if (resultSourceHash !== expectedSourceHash) {
          completionOk = false;
          completionError = `Analytics sourceHash mismatch; expected ${expectedSourceHash}, received ${resultSourceHash}`;
        } else if (!calculationHash || !/^[a-f0-9]{64}$/i.test(calculationHash)) {
          completionOk = false;
          completionError = "Analytics calculationHash is missing or invalid";
        } else if (resultAssessmentId && resultAssessmentId !== expectedAssessmentId) {
          completionOk = false;
          completionError = `Analytics assessmentId mismatch; expected ${expectedAssessmentId}, received ${resultAssessmentId}`;
        }
      }

      const analysisRun = await this.db.analysisRun.update({
        where: { id: payload.analysisRunId },
        data: completionOk
          ? {
              status: "COMPLETED",
              result: value.result as any,
              sourceHash: resultSourceHash,
              engineVersion: engineName && engineVersion ? `${engineName}:${engineVersion}` : undefined,
              error: null,
              completedAt: new Date(),
            }
          : { status: "FAILED", error: completionError ?? "Unknown analysis completion error", completedAt: new Date() },
        include: { assessment: { select: { organizationId: true } } },
      });
      await this.audit.record({
        organizationId: analysisRun.assessment.organizationId,
        actorType: "SYSTEM",
        actorId: "proofline-worker",
        action: completionOk ? "ASSESSMENT_SCORING_COMPLETED" : "ASSESSMENT_SCORING_FAILED",
        targetType: "AnalysisRun",
        targetId: analysisRun.id,
        metadata: {
          assessmentId: analysisRun.assessmentId,
          sourceHash: resultSourceHash ?? expectedSourceHash ?? null,
          engineVersion: analysisRun.engineVersion ?? null,
          error: completionOk ? null : completionError ?? "Unknown analysis completion error",
        },
      });
    }
    let emailOrganizationId = typeof payload.organizationId === "string" ? payload.organizationId : undefined;
    if (job.type === "SEND_EMAIL" && !emailOrganizationId && typeof payload.assessmentId === "string") {
      emailOrganizationId = (await this.db.assessment.findUnique({ where: { id: payload.assessmentId }, select: { organizationId: true } }).catch(() => null))?.organizationId;
    }
    if (job.type === "SEND_EMAIL" && typeof payload.reportDeliveryId === "string") {
      const delivery = await this.db.reportDelivery.update({
        where: { id: payload.reportDeliveryId },
        data: completionOk ? { status: "SENT", sentAt: new Date(), error: null } : { status: "FAILED", error: completionError ?? "Unknown error" },
      }).catch(() => undefined);
      if (delivery) {
        const report = await this.db.report.findUnique({ where: { id: delivery.reportId }, include: { assessment: { select: { organizationId: true } } } });
        if (report) await this.audit.record({
          organizationId: report.assessment.organizationId,
          actorType: "SYSTEM",
          actorId: "proofline-worker",
          action: completionOk ? "REPORT_DELIVERY_SENT" : "REPORT_DELIVERY_FAILED",
          targetType: "ReportDelivery",
          targetId: delivery.id,
          metadata: { reportId: delivery.reportId, assessmentId: report.assessmentId, error: completionOk ? null : completionError ?? "Unknown error" },
        });
      }
      if (delivery && completionOk) {
        const remaining = await this.db.reportDelivery.count({ where: { reportId: delivery.reportId, status: { not: "SENT" } } });
        if (remaining === 0) await this.db.report.update({ where: { id: delivery.reportId }, data: { status: "DISTRIBUTED", distributedAt: new Date() } }).catch(() => undefined);
      }
    }
    if (job.type === "SEND_EMAIL") {
      const emailResult = value.result && typeof value.result === "object" ? value.result as Record<string, unknown> : {};
      const category = typeof emailResult.category === "string" ? emailResult.category : (typeof payload.category === "string" ? payload.category : "email");
      const templateId = typeof emailResult.templateId === "string" ? emailResult.templateId : null;
      const templateVersion = typeof emailResult.templateVersion === "string" ? emailResult.templateVersion : null;
      const family = typeof emailResult.family === "string" ? emailResult.family : null;
      const messageId = typeof emailResult.messageId === "string" ? emailResult.messageId : null;
      await this.audit.record({
        ...(emailOrganizationId ? { organizationId: emailOrganizationId } : {}),
        actorType: "SYSTEM",
        actorId: "proofline-worker",
        action: completionOk ? "EMAIL_DELIVERED" : "EMAIL_DELIVERY_FAILED",
        targetType: "OutboxEvent",
        targetId: job.id,
        metadata: { category, templateId, templateVersion, family, messageId, error: completionOk ? null : completionError ?? "Unknown error" },
      });
    }
    const emailResult = value.result && typeof value.result === "object" ? value.result as Record<string, unknown> : {};
    const scrubbedEmailPayload = {
      category: (typeof emailResult.category === "string" ? emailResult.category : (payload.category as string | undefined)) ?? "email",
      templateId: typeof emailResult.templateId === "string" ? emailResult.templateId : undefined,
      templateVersion: typeof emailResult.templateVersion === "string" ? emailResult.templateVersion : undefined,
      family: typeof emailResult.family === "string" ? emailResult.family : undefined,
      scrubbed: true,
      ...(emailOrganizationId ? { organizationId: emailOrganizationId } : {}),
      ...(typeof payload.ticketId === "string" ? { ticketId: payload.ticketId } : {}),
      ...(typeof payload.assessmentId === "string" ? { assessmentId: payload.assessmentId } : {}),
      ...(typeof payload.assessmentVersionId === "string" ? { assessmentVersionId: payload.assessmentVersionId } : {}),
      ...(typeof payload.reportId === "string" ? { reportId: payload.reportId } : {}),
      ...(typeof payload.reportDeliveryId === "string" ? { reportDeliveryId: payload.reportDeliveryId } : {}),
    };
    const completedData = job.type === "SEND_EMAIL"
      ? { status: "COMPLETED" as const, result: value.result as any, payload: scrubbedEmailPayload }
      : { status: "COMPLETED" as const, result: value.result as any };
    await this.db.outboxEvent.update({
      where: { id },
      data: completionOk ? completedData : { status: "FAILED", error: completionError ?? "Unknown error" },
    });
    return { ok: true };
  }
}
