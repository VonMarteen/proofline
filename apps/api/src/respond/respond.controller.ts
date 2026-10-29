import { Body, ConflictException, Controller, Get, GoneException, NotFoundException, Param, Post, Query, Inject } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service.js";
import { sha256 } from "../security/crypto.js";
import { BrandingService } from "../branding/branding.service.js";

const SubmitSchema = z.object({
  noticeVersionId: z.string(),
  locale: z.enum(["es", "en"]),
  answers: z.record(z.string(), z.unknown()),
});

@Controller("v1/respond")
export class RespondController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(BrandingService) private readonly branding: BrandingService,
  ) {}

  private async resolve(token: string) {
    const participant = await this.db.participant.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        assessmentVersion: true,
        response: { include: { answers: true } },
        assessment: {
          include: {
            organization: true,
            questions: { orderBy: { order: "asc" }, include: { translations: true } },
            translations: true,
            participantNotices: { where: { active: true } },
            versions: { orderBy: { version: "desc" }, take: 10 },
          },
        },
      },
    });
    if (!participant || participant.status === "REVOKED") throw new NotFoundException("Invitation not found");
    if (participant.status === "COMPLETED" && !participant.response?.completedAt) {
      throw new ConflictException("Completed response evidence is missing. Contact support.");
    }
    if (participant.status !== "COMPLETED" && participant.expiresAt && participant.expiresAt <= new Date()) {
      throw new GoneException("This invitation has expired");
    }
    return participant;
  }

  private versionSnapshot(participant: any) {
    const direct = participant.assessmentVersion?.snapshot as any;
    if (direct?.questions?.every((q: any) => q?.id)) return direct;
    const launched = participant.assessment.versions.find((v: any) => v.version === participant.assessment.launchedVersion)?.snapshot as any;
    if (launched?.questions?.every((q: any) => q?.id)) return launched;
    return null;
  }

  private questionsFor(participant: any) {
    const snapshot = this.versionSnapshot(participant);
    if (snapshot?.questions?.length) return snapshot.questions as any[];
    return participant.assessment.questions.map((q: any) => ({
      id: q.id,
      code: q.code ?? `Q${String(q.order).padStart(3, "0")}`,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      dimension: q.dimension,
      subdimension: q.subdimension,
      required: q.required,
      scored: q.scored,
      weight: q.weight,
      polarity: q.polarity ?? (q.reverseScore ? "REVERSE" : "POSITIVE"),
      reverseScore: q.reverseScore,
      config: q.config,
      translations: q.translations ?? [],
    }));
  }

  @Get(":token")
  async get(@Param("token") token: string, @Query("locale") localeRaw?: string) {
    const p = await this.resolve(token);
    const locale = localeRaw === "en" ? "en" : p.locale === "en" ? "en" : "es";
    const notice = p.assessment.participantNotices.find((n) => n.locale === locale) ?? p.assessment.participantNotices[0];
    if (!notice) throw new NotFoundException("Participant notice missing");

    const snapshot = this.versionSnapshot(p);
    const assessmentTranslation = Array.isArray(snapshot?.translations)
      ? snapshot.translations.find((t: any) => t.locale === locale)
      : p.assessment.translations.find((t) => t.locale === locale);
    const launchedSnapshot = snapshot?.branding ?? (p.assessment.versions.find((v) => v.version === p.assessment.launchedVersion)?.snapshot as any)?.branding;
    const branding = launchedSnapshot
      ? await this.branding.fromSnapshot(p.assessment.organizationId, launchedSnapshot)
      : await this.branding.get(p.assessment.organizationId, true);

    const questions = this.questionsFor(p);
    return {
      id: p.assessment.id,
      assessmentVersionId: p.assessmentVersionId,
      assessmentLevel: snapshot?.level ?? p.assessment.level,
      title: assessmentTranslation?.title ?? snapshot?.title ?? p.assessment.title,
      objective: assessmentTranslation?.objective ?? snapshot?.objective ?? p.assessment.objective,
      locale,
      organization: { name: p.assessment.organization.name },
      branding,
      status: p.status,
      assessmentStatus: p.assessment.status,
      notice: { id: notice.id, version: notice.version, title: notice.title, content: notice.content },
      draft: p.response ? {
        answers: Object.fromEntries(p.response.answers.map((a) => [a.questionId, a.value])),
        startedAt: p.response.startedAt.toISOString(),
        savedAt: p.response.answers.reduce<Date | null>((latest, a) => !latest || a.createdAt > latest ? a.createdAt : latest, null)?.toISOString() ?? p.response.startedAt.toISOString(),
        completedAt: p.response.completedAt?.toISOString() ?? null,
      } : null,
      questions: questions.map((q: any) => ({
        id: q.id,
        code: q.code,
        order: q.order,
        type: q.type,
        prompt: Array.isArray(q.translations) ? q.translations.find((t: any) => t.locale === locale)?.prompt ?? q.prompt : q.prompt,
        dimension: q.dimension,
        required: q.required,
        config: q.config,
      })),
    };
  }

  @Post(":token/save")
  async save(@Param("token") token: string, @Body() body: unknown) {
    const value = SubmitSchema.parse(body);
    const p = await this.resolve(token);
    if (p.status === "COMPLETED") {
      return { ok: true, alreadyCompleted: true, savedAt: p.response?.completedAt?.toISOString() ?? p.completedAt?.toISOString() ?? null };
    }
    if (p.assessment.status !== "ACTIVE") throw new ConflictException("This assessment is no longer accepting responses");

    this.assertNotice(p, value.noticeVersionId);
    const answers = this.sanitizeAndValidateAnswers(p, value.answers, false);
    const now = new Date();

    const result = await this.db.$transaction(async (tx) => {
      const liveAssessment = await tx.assessment.findUnique({ where: { id: p.assessmentId }, select: { status: true } });
      if (liveAssessment?.status !== "ACTIVE") throw new ConflictException("This assessment is no longer accepting responses");
      const startedNow = await tx.participant.updateMany({
        where: { id: p.id, status: "INVITED" },
        data: { status: "STARTED", startedAt: p.startedAt ?? now },
      });
      if (startedNow.count === 0) {
        const current = await tx.participant.findUnique({ where: { id: p.id }, select: { status: true, startedAt: true } });
        if (!current || current.status === "REVOKED") throw new NotFoundException("Invitation not found");
        if (current.status === "COMPLETED") return { alreadyCompleted: true as const };
        if (current.status !== "STARTED") throw new ConflictException("This invitation cannot accept draft responses");
        if (!current.startedAt) await tx.participant.update({ where: { id: p.id }, data: { startedAt: now } });
      }

      const response = await tx.response.upsert({
        where: { participantId: p.id },
        create: { participantId: p.id, assessmentVersionId: p.assessmentVersionId, startedAt: p.startedAt ?? now },
        update: { assessmentVersionId: p.assessmentVersionId, completedAt: null },
      });
      await tx.answer.deleteMany({ where: { responseId: response.id } });
      if (Object.keys(answers).length) {
        await tx.answer.createMany({ data: Object.entries(answers).map(([questionId, answer]) => ({ responseId: response.id, questionId, value: answer as any })) });
      }
      if (startedNow.count === 1) {
        await tx.auditEvent.create({
          data: {
            organizationId: p.assessment.organizationId,
            actorType: "PARTICIPANT",
            actorId: p.pseudonym,
            action: "ASSESSMENT_STARTED",
            targetType: "Assessment",
            targetId: p.assessmentId,
            metadata: { responseId: response.id, assessmentVersionId: p.assessmentVersionId },
          },
        });
      }
      return { alreadyCompleted: false as const };
    });

    if (result.alreadyCompleted) {
      return { ok: true, alreadyCompleted: true, savedAt: p.response?.completedAt?.toISOString() ?? p.completedAt?.toISOString() ?? null };
    }
    return { ok: true, alreadyCompleted: false, savedAt: now.toISOString(), answerCount: Object.keys(answers).length };
  }

  @Post(":token/submit")
  async submit(@Param("token") token: string, @Body() body: unknown) {
    const value = SubmitSchema.parse(body);
    const p = await this.resolve(token);
    if (p.status === "COMPLETED") return this.completedResult(value.locale, true);
    if (p.assessment.status !== "ACTIVE") throw new ConflictException("This assessment is no longer accepting responses");

    this.assertNotice(p, value.noticeVersionId);
    const answers = this.sanitizeAndValidateAnswers(p, value.answers, true);
    const now = new Date();

    const result = await this.db.$transaction(async (tx) => {
      const liveAssessment = await tx.assessment.findUnique({ where: { id: p.assessmentId }, select: { status: true } });
      if (liveAssessment?.status !== "ACTIVE") throw new ConflictException("This assessment is no longer accepting responses");
      const claimed = await tx.participant.updateMany({
        where: { id: p.id, status: { in: ["INVITED", "STARTED"] } },
        data: { status: "COMPLETED", startedAt: p.startedAt ?? now, completedAt: now },
      });
      if (claimed.count === 0) {
        const current = await tx.participant.findUnique({ where: { id: p.id }, select: { status: true } });
        if (current?.status === "COMPLETED") return { alreadyCompleted: true as const };
        if (!current || current.status === "REVOKED") throw new NotFoundException("Invitation not found");
        throw new ConflictException("This invitation cannot be submitted in its current state");
      }

      const response = await tx.response.upsert({
        where: { participantId: p.id },
        create: { participantId: p.id, assessmentVersionId: p.assessmentVersionId, startedAt: p.startedAt ?? now, completedAt: now },
        update: { assessmentVersionId: p.assessmentVersionId, completedAt: now },
      });
      await tx.answer.deleteMany({ where: { responseId: response.id } });
      if (Object.keys(answers).length) {
        await tx.answer.createMany({ data: Object.entries(answers).map(([questionId, answer]) => ({ responseId: response.id, questionId, value: answer as any })) });
      }

      const evidenceVersion = await tx.legalDocumentVersion.findFirstOrThrow({
        where: { document: { key: "participant-notice-evidence" }, locale: value.locale, active: true },
      });
      await tx.legalInteraction.create({
        data: {
          documentVersionId: evidenceVersion.id,
          actorType: "PARTICIPANT",
          actorRef: p.pseudonym,
          action: "ACKNOWLEDGE",
          locale: value.locale,
          evidence: { participantNoticeVersionId: value.noticeVersionId, assessmentId: p.assessmentId, assessmentVersionId: p.assessmentVersionId },
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.assessment.organizationId,
          actorType: "PARTICIPANT",
          actorId: p.pseudonym,
          action: "ASSESSMENT_COMPLETED",
          targetType: "Assessment",
          targetId: p.assessmentId,
          metadata: { responseId: response.id, assessmentVersionId: p.assessmentVersionId },
        },
      });
      await tx.usageEvent.create({
        data: {
          organizationId: p.assessment.organizationId,
          assessmentId: p.assessmentId,
          idempotencyKey: `response-completed:${response.id}`,
          eventType: "RESPONSE_COMPLETED",
          quantity: 1,
          unit: "response",
          billable: true,
          periodKey: now.toISOString().slice(0, 7),
          metadata: { participantId: p.pseudonym, assessmentVersionId: p.assessmentVersionId },
        },
      });
      return { alreadyCompleted: false as const };
    });

    return this.completedResult(value.locale, result.alreadyCompleted);
  }

  private assertNotice(p: any, noticeVersionId: string) {
    const validNotice = p.assessment.participantNotices.some((n: any) => n.id === noticeVersionId);
    if (!validNotice) throw new ConflictException("Notice version mismatch. Reload the assessment before continuing.");
  }

  private sanitizeAndValidateAnswers(p: any, submitted: Record<string, unknown>, requireComplete: boolean) {
    const questions = this.questionsFor(p);
    const answerable = questions.filter((q: any) => q.type !== "INFO");
    const questionIds = new Set(answerable.map((q: any) => String(q.id)));
    for (const key of Object.keys(submitted)) if (!questionIds.has(key)) throw new ConflictException("Unknown question in submission");

    const visible = answerable.filter((q: any) => isVisible(q.config, submitted));
    const visibleIds = new Set(visible.map((q: any) => String(q.id)));
    const answers = Object.fromEntries(Object.entries(submitted).filter(([questionId]) => visibleIds.has(questionId)));

    if (requireComplete) {
      const required = visible.filter((q: any) => q.required).map((q: any) => String(q.id));
      const missing = required.filter((id: string) => !(id in answers) || isEmptyAnswer(answers[id]));
      if (missing.length) throw new ConflictException(`Missing ${missing.length} required answers`);
    }
    for (const q of visible) {
      const id = String(q.id);
      if (id in answers && !isEmptyAnswer(answers[id])) validateAnswer(q.type, q.config, answers[id], requireComplete && q.required, !requireComplete);
    }
    return answers;
  }

  private completedResult(locale: "es" | "en", alreadyCompleted: boolean) {
    return {
      ok: true,
      alreadyCompleted,
      message: locale === "es" ? "Gracias. Tu respuesta se ha registrado de forma segura." : "Thank you. Your response has been securely recorded.",
      analysisQueued: false,
      resultsGeneratedAfterClose: true,
    };
  }

}

function isVisible(config: unknown, answers: Record<string, unknown>) {
  const show = (config as any)?.logic?.showIf;
  if (!show?.questionId) return true;
  const actual = answers[show.questionId];
  const expected = show.value;
  switch (show.operator) {
    case "not_equals": return String(actual) !== String(expected);
    case "contains": return Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? "").includes(String(expected));
    case "gte": return Number(actual) >= Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    default: return String(actual) === String(expected);
  }
}
function isEmptyAnswer(value: unknown) {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}
function optionValues(config: unknown) {
  const options = (config as any)?.options;
  return Array.isArray(options) ? options.map((x: any) => String(typeof x === "string" ? x : x.value)) : [];
}
function validateAnswer(type: string, config: unknown, value: unknown, required: boolean, allowPartial = false) {
  const c = (config ?? {}) as any;
  const fail = (message: string): never => { throw new ConflictException(message); };
  if (value === null || value === undefined || value === "") { if (required) fail("Required answer is empty"); return; }
  if (type === "SINGLE") {
    const allowed = optionValues(c);
    if (allowed.length && !allowed.includes(String(value))) fail("Invalid single-choice option");
  }
  if (type === "MULTI" || type === "CHECKBOX") {
    if (!Array.isArray(value)) fail("Multiple-choice answer must be an array");
    const arr = value as unknown[];
    const allowed = optionValues(c);
    if (arr.some((x) => allowed.length && !allowed.includes(String(x)))) fail("Invalid multiple-choice option");
    if (!allowPartial && Number(c.minSelections ?? 0) > arr.length) fail("Minimum selections not reached");
    if (Number(c.maxSelections ?? 0) > 0 && arr.length > Number(c.maxSelections)) fail("Maximum selections exceeded");
  }
  if (type === "YES_NO" && !( ["yes", "no", ...(c.allowNA ? ["na"] : [])].includes(String(value)) )) fail("Invalid yes/no answer");
  if (["LIKERT", "NPS", "NUMERIC", "RANGE", "PERCENTAGE", "SLIDER"].includes(type)) {
    const n = Number(value);
    const min = Number(c.min ?? (type === "NPS" ? 0 : 0));
    const max = Number(c.max ?? (type === "PERCENTAGE" ? 100 : type === "NPS" ? 10 : 100));
    if (!Number.isFinite(n) || n < min || n > max) fail("Numeric answer is outside configured range");
  }
  if (type === "DUAL") {
    if (typeof value !== "object" || !value) fail("Dual answer must contain both ratings");
    const v = value as any;
    const min = Number(c.min ?? 1);
    const max = Number(c.max ?? 5);
    const rawValues = allowPartial ? [v.importance, v.performance].filter((x) => x !== undefined && x !== null && x !== "") : [v.importance, v.performance];
    for (const raw of rawValues) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min || n > max) fail("Dual rating is outside configured range");
    }
  }
  if (type === "MATRIX") {
    if (typeof value !== "object" || !value) fail("Matrix answer must be an object");
    const rows = Array.isArray(c.rows) ? c.rows.map((x: any) => String(typeof x === "string" ? x : x.value)) : [];
    const cols = Array.isArray(c.columns) ? c.columns.map((x: any) => String(typeof x === "string" ? x : x.value)) : [];
    const v = value as any;
    if (required && rows.some((r: string) => !(r in v))) fail("Complete all required matrix rows");
    for (const [row, col] of Object.entries(v)) {
      if (rows.length && !rows.includes(row)) fail("Unknown matrix row");
      if (cols.length && !cols.includes(String(col))) fail("Unknown matrix option");
    }
  }
  if (type === "RANKING") {
    if (!Array.isArray(value)) fail("Ranking answer must be an array");
    const allowed = optionValues(c);
    const arr = (value as unknown[]).map(String);
    if (allowed.length && (arr.length !== allowed.length || new Set(arr).size !== allowed.length || arr.some((x) => !allowed.includes(x)))) fail("Ranking must contain each option exactly once");
  }
  if (type === "ALLOCATION") {
    if (typeof value !== "object" || !value) fail("Allocation answer must be an object");
    const allowed = optionValues(c);
    const v = value as any;
    let sum = 0;
    for (const [key, raw] of Object.entries(v)) {
      if (allowed.length && !allowed.includes(key)) fail("Unknown allocation option");
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) fail("Allocation values must be non-negative");
      sum += n;
    }
    const total = Number(c.total ?? 100);
    if (allowPartial ? sum - total > 0.001 : Math.abs(sum - total) > 0.001) fail(allowPartial ? `Allocation cannot exceed ${total}` : `Allocation must total ${total}`);
  }
  if (type === "SHORT_TEXT" || type === "LONG_TEXT") {
    if (typeof value !== "string") throw new ConflictException("Text answer must be text");
    const text = value as string;
    if (text.length > Number(c.maxLength ?? (type === "LONG_TEXT" ? 1200 : 500))) throw new ConflictException("Text answer exceeds maximum length");
  }
}
