import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { permittedAssessmentIds, requireAnyResultRead, requireCapability } from "../auth/access-control.js";
import { ClientDevAuthGuard, identityFrom, type HeaderRequest } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { decryptText, randomPseudonym, sha256 } from "../security/crypto.js";
import { AssessmentsService } from "./assessments.service.js";
import { buildPopulationSnapshot, participantSegments } from "./population-snapshot.js";
import {
  defaultScoredForType,
  normalizeAssessmentScoringConfig,
  normalizeQuestionScoring,
  questionCode,
} from "./scoring-contract.js";

const StatusSchema = z.object({ status: z.enum(["DRAFT", "PREPARATION", "REVIEW", "READY", "ACTIVE", "CLOSED", "ARCHIVED"]) });
const PolaritySchema = z.enum(["POSITIVE", "REVERSE", "CUSTOM"]);
const QuestionSchema = z.object({
  prompt: z.string().min(2).max(1500),
  type: z.enum(["SINGLE", "MULTI", "CHECKBOX", "YES_NO", "LIKERT", "NPS", "NUMERIC", "RANGE", "PERCENTAGE", "SLIDER", "MATRIX", "DUAL", "RANKING", "ALLOCATION", "SHORT_TEXT", "LONG_TEXT", "INFO"]),
  dimension: z.string().max(120).optional().nullable(),
  subdimension: z.string().max(120).optional().nullable(),
  required: z.boolean().default(true),
  scored: z.boolean().optional(),
  weight: z.number().min(0.25).max(5).default(1),
  polarity: PolaritySchema.optional(),
  reverseScore: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
});
const AssessmentConfigSchema = z.object({
  level: z.enum(["L1", "L2", "L3", "L4"]).optional(),
  scoringConfig: z.unknown().optional(),
}).refine((value) => value.level !== undefined || value.scoringConfig !== undefined, "No assessment configuration supplied");
const GovernanceSchema = z.object({
  privacyMode: z.enum(["IDENTIFIED", "CONFIDENTIAL", "ANONYMOUS"]),
  minCohortSize: z.number().int().min(5).max(50),
  locale: z.enum(["es", "en"]),
});
const ReorderSchema = z.object({ questionIds: z.array(z.string()).min(1).max(150) });
const ImportSchema = z.object({ text: z.string().min(5).max(20000), type: z.enum(["LIKERT", "SHORT_TEXT", "LONG_TEXT", "YES_NO"]).default("LIKERT"), dimension: z.string().max(120).optional().nullable() });
const LegalSchema = z.object({ controllerName: z.string().min(2), purpose: z.string().min(12), legalBasis: z.string().min(4), participationMode: z.string(), confidentiality: z.string(), retentionDays: z.number().int().min(1).max(3650), dpoContact: z.string().email().optional().or(z.literal("")), approve: z.boolean().default(false), locale: z.enum(["es", "en"]).default("es") });

const transitions: Record<string, string[]> = {
  DRAFT: ["PREPARATION", "ARCHIVED"],
  PREPARATION: ["DRAFT", "REVIEW", "ARCHIVED"],
  REVIEW: ["PREPARATION", "READY", "ARCHIVED"],
  READY: ["REVIEW", "ACTIVE", "ARCHIVED"],
  ACTIVE: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

@Controller("v1/assessments")
@UseGuards(ClientDevAuthGuard)
export class AssessmentsController {
  constructor(
    @Inject(AssessmentsService) private svc: AssessmentsService,
    @Inject(PrismaService) private db: PrismaService,
    @Inject(AuditService) private audit: AuditService,
  ) {}

  @Get()
  async list(@Req() req: HeaderRequest) {
    const { ctx, ids, unrestricted } = await permittedAssessmentIds(this.db, req);
    if (!ctx.capabilities.includes("assessment.read")) throw new BadRequestException("Assessment access required");
    return this.svc.list(ctx.organization.id, unrestricted ? undefined : ids);
  }


  @Get("table")
  async listTable(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string) {
    const { ctx, ids, unrestricted } = await permittedAssessmentIds(this.db, req);
    if (!ctx.capabilities.includes("assessment.read")) throw new BadRequestException("Assessment access required");
    return this.svc.listPage(ctx.organization.id, unrestricted ? undefined : ids,{page,pageSize,q,status});
  }

  @Get(":id")
  async get(@Req() req: HeaderRequest, @Param("id") id: string) {
    const ctx = await requireCapability(this.db, req, "assessment.read", id);
    const a: any = await this.svc.get(id);
    const canResults = ctx.capabilities.includes("results.read") || ctx.capabilities.includes("results.authorized_read");
    return {
      ...a,
      participants: ctx.capabilities.includes("population.prepare") ? a.participants : [],
      analysisRuns: canResults ? a.analysisRuns : [],
      reports: canResults ? a.reports : [],
      resultRecipients: ctx.capabilities.includes("assessment.edit") ? a.resultRecipients : [],
    };
  }

  @Get(":id/check")
  async check(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireCapability(this.db, req, "assessment.edit", id);
    return this.svc.check(id);
  }

  @Post(":id/check")
  async checkPost(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireCapability(this.db, req, "assessment.edit", id);
    return this.svc.check(id);
  }

  @Get(":id/launch-checklist")
  async launchChecklist(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireCapability(this.db, req, "assessment.read", id);
    return this.svc.launchChecklist(id);
  }

  @Post(":id/visual-approval")
  async approveVisual(@Req() req: HeaderRequest, @Param("id") id: string) {
    const ctx = await requireCapability(this.db, req, "assessment.edit", id);
    return this.svc.approveVisual(id, ctx.identity.email);
  }

  @Get(":id/analysis-runs/latest")
  async latest(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireAnyResultRead(this.db, req, id);
    return await this.db.analysisRun.findFirst({ where: { assessmentId: id }, orderBy: { createdAt: "desc" } }) ?? { status: "NONE" };
  }

  @Post(":id/governance")
  async governance(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    const ctx = await requireCapability(this.db, req, "assessment.edit", id);
    const value = GovernanceSchema.parse(body);
    const assessment = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(assessment.status)) throw new BadRequestException("Assessment governance is locked");
    const updated = await this.db.assessment.update({
      where: { id },
      data: { privacyMode: value.privacyMode, minCohortSize: value.minCohortSize, locale: value.locale, readinessScore: null },
    });
    await this.audit.record({
      organizationId: assessment.organizationId,
      actorType: "USER",
      actorId: ctx.identity.email,
      action: "ASSESSMENT_GOVERNANCE_UPDATED",
      targetType: "Assessment",
      targetId: id,
      metadata: { privacyMode: updated.privacyMode, minCohortSize: updated.minCohortSize, locale: updated.locale },
    });
    return { ok: true, privacyMode: updated.privacyMode, minCohortSize: updated.minCohortSize, locale: updated.locale };
  }

  @Post(":id/config")
  async configure(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    const ctx = await requireCapability(this.db, req, "assessment.edit", id);
    const value = AssessmentConfigSchema.parse(body);
    const assessment = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(assessment.status)) throw new BadRequestException("Assessment configuration is locked");
    const data: Record<string, unknown> = { readinessScore: null };
    if (value.level) data.level = value.level;
    if (value.scoringConfig !== undefined) data.scoringConfig = normalizeAssessmentScoringConfig(value.scoringConfig);
    const updated = await this.db.assessment.update({ where: { id }, data: data as any });
    await this.audit.record({
      organizationId: assessment.organizationId,
      actorType: "USER",
      actorId: ctx.identity.email,
      action: "ASSESSMENT_METHOD_CONFIG_UPDATED",
      targetType: "Assessment",
      targetId: id,
      metadata: { level: updated.level, scoringConfig: updated.scoringConfig },
    });
    return { ok: true, level: updated.level, scoringConfig: updated.scoringConfig };
  }

  @Delete(":id")
  async removeAssessment(@Req() req: HeaderRequest, @Param("id") id: string) {
    const ctx = await requireCapability(this.db, req, "assessment.delete", id);
    const a = await this.svc.get(id);
    const activeLegalHolds = await this.db.legalHold.count({ where: { assessmentId: id, status: "ACTIVE" } });
    const hasExecution = Boolean(a.launchedAt || a.closedAt) || ["ACTIVE", "CLOSED"].includes(a.status) || a.participants.length > 0 || a.reports.length > 0;
    if (hasExecution) throw new BadRequestException("Assessment has execution history and cannot be deleted. Archive it instead.");
    if (activeLegalHolds) throw new BadRequestException("Assessment is under legal hold and cannot be deleted.");
    await this.db.assessment.delete({ where: { id } });
    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: ctx.identity.email, action: "ASSESSMENT_DELETED", targetType: "Assessment", targetId: id, metadata: { title: a.title, status: a.status, neverLaunched: true } });
    return { ok: true, deleted: true };
  }

  @Post(":id/questions")
  async addQuestion(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const value = QuestionSchema.parse(body);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Questionnaire is locked");
    const last = await this.db.question.findFirst({ where: { assessmentId: id }, orderBy: { order: "desc" } });
    const order = (last?.order ?? 0) + 1;
    const config = (value.config ?? defaultQuestionConfig(value.type)) as any;
    const scoring = normalizeQuestionScoring({ ...value, config });
    const q = await this.db.question.create({
      data: {
        assessmentId: id,
        order,
        code: questionCode(order),
        prompt: value.prompt,
        type: value.type,
        dimension: value.dimension || null,
        subdimension: value.subdimension || null,
        required: value.type === "INFO" ? false : value.required,
        scored: scoring.scored,
        weight: scoring.weight,
        polarity: scoring.polarity,
        reverseScore: scoring.reverseScore,
        config: scoring.config as any,
      },
    });
    await this.db.questionTranslation.create({ data: { questionId: q.id, locale: a.locale, prompt: q.prompt } });
    await this.db.assessment.update({ where: { id }, data: { readinessScore: null, status: a.status === "DRAFT" ? "PREPARATION" : a.status } });
    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "QUESTION_ADDED", targetType: "Question", targetId: q.id, metadata: { code: q.code, type: value.type, dimension: value.dimension ?? null, scored: q.scored, polarity: q.polarity } });
    return { ok: true, questionId: q.id };
  }

  @Post(":id/questions/import")
  async importQuestions(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const value = ImportSchema.parse(body);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Questionnaire is locked");
    const prompts = value.text.split(/\r?\n/).map((x) => x.replace(/^[-*\d.)\s]+/, "").trim()).filter((x) => x.length >= 5).slice(0, 100);
    const last = await this.db.question.findFirst({ where: { assessmentId: id }, orderBy: { order: "desc" } });
    if (!prompts.length) throw new BadRequestException("No valid questions");
    const baseOrder = last?.order ?? 0;
    const scored = defaultScoredForType(value.type);
    await this.db.question.createMany({
      data: prompts.map((prompt, i) => ({
        assessmentId: id,
        order: baseOrder + 1 + i,
        code: questionCode(baseOrder + 1 + i),
        prompt,
        type: value.type,
        dimension: value.dimension || null,
        required: true,
        scored,
        weight: 1,
        polarity: "POSITIVE",
        reverseScore: false,
        config: value.type === "LIKERT" ? { min: 1, max: 5 } : undefined,
      })),
    });
    await this.db.assessment.update({ where: { id }, data: { readinessScore: null, status: a.status === "DRAFT" ? "PREPARATION" : a.status } });
    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "QUESTIONS_IMPORTED", targetType: "Assessment", targetId: id, metadata: { count: prompts.length } });
    return { ok: true, count: prompts.length };
  }

  @Post(":id/questions/:qid/update")
  async updateQuestion(@Req() req: HeaderRequest, @Param("id") id: string, @Param("qid") qid: string, @Body() body: unknown) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const value = QuestionSchema.parse(body);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Questionnaire is locked");
    const q = await this.db.question.findFirst({ where: { id: qid, assessmentId: id } });
    if (!q) throw new NotFoundException("Question not found");
    const config = (value.config ?? defaultQuestionConfig(value.type)) as any;
    const scoring = normalizeQuestionScoring({ ...value, config });
    await this.db.question.update({
      where: { id: qid },
      data: {
        prompt: value.prompt,
        type: value.type,
        dimension: value.dimension || null,
        subdimension: value.subdimension || null,
        required: value.type === "INFO" ? false : value.required,
        scored: scoring.scored,
        weight: scoring.weight,
        polarity: scoring.polarity,
        reverseScore: scoring.reverseScore,
        config: scoring.config as any,
      },
    });
    await this.db.questionTranslation.upsert({ where: { questionId_locale: { questionId: qid, locale: a.locale } }, update: { prompt: value.prompt }, create: { questionId: qid, locale: a.locale, prompt: value.prompt } });
    await this.db.assessment.update({ where: { id }, data: { readinessScore: null } });
    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "QUESTION_UPDATED", targetType: "Question", targetId: qid, metadata: { type: value.type, scored: scoring.scored, polarity: scoring.polarity, weight: scoring.weight } });
    return { ok: true };
  }

  @Post(":id/questions/reorder")
  async reorder(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const value = ReorderSchema.parse(body);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Questionnaire is locked");
    const existing = await this.db.question.findMany({ where: { assessmentId: id }, select: { id: true } });
    const ids = new Set(existing.map((q) => q.id));
    if (value.questionIds.length !== existing.length || value.questionIds.some((qid) => !ids.has(qid))) throw new BadRequestException("Reorder list must contain all assessment questions exactly once");
    await this.db.$transaction(value.questionIds.map((qid, index) => this.db.question.update({ where: { id: qid }, data: { order: index + 1 } })));
    await this.db.assessment.update({ where: { id }, data: { readinessScore: null } });
    return { ok: true };
  }

  @Post(":id/questions/:qid/remove")
  async removeQuestion(@Req() req: HeaderRequest, @Param("id") id: string, @Param("qid") qid: string) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Questionnaire is locked");
    const q = await this.db.question.findFirst({ where: { id: qid, assessmentId: id } });
    if (!q) throw new NotFoundException();
    await this.db.question.delete({ where: { id: qid } });
    const rest = await this.db.question.findMany({ where: { assessmentId: id }, orderBy: { order: "asc" }, select: { id: true } });
    await this.db.$transaction(rest.map((x, index) => this.db.question.update({ where: { id: x.id }, data: { order: index + 1 } })));
    await this.db.assessment.update({ where: { id }, data: { readinessScore: null } });
    return { ok: true };
  }

  @Post(":id/legal-profile")
  async legal(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    await requireCapability(this.db, req, "assessment.edit", id);
    const value = LegalSchema.parse(body);
    const a = await this.svc.get(id);
    if (!["DRAFT", "PREPARATION", "REVIEW"].includes(a.status)) throw new BadRequestException("Assessment configuration is locked");
    await this.db.$transaction(async tx => {
      const profile = await tx.assessmentLegalProfile.upsert({
        where: { assessmentId: id },
        update: { controllerName: value.controllerName, purpose: value.purpose, legalBasis: value.legalBasis, participationMode: value.participationMode, confidentiality: value.confidentiality, retentionDays: value.retentionDays, dpoContact: value.dpoContact || null, approvedAt: value.approve ? new Date() : null },
        create: { assessmentId: id, controllerName: value.controllerName, purpose: value.purpose, legalBasis: value.legalBasis, participationMode: value.participationMode, confidentiality: value.confidentiality, dataFields: { segmentation: "declared fields only" }, retentionDays: value.retentionDays, recipients: ["authorized stakeholders"], transferPolicy: "EU baseline", dpoContact: value.dpoContact || null, aiUse: { review: true, summaries: true, automatedEmploymentDecision: false }, approvedAt: value.approve ? new Date() : null },
      });
      const count = await tx.participantNoticeVersion.count({ where: { assessmentId: id, locale: value.locale } });
      await tx.participantNoticeVersion.updateMany({ where: { assessmentId: id, locale: value.locale, active: true }, data: { active: false } });
      const content = value.locale === "es"
        ? `${value.controllerName} utilizará las respuestas para ${value.purpose}. Participación: ${value.participationMode}. Base declarada: ${value.legalBasis}. Confidencialidad: ${value.confidentiality}. Retención prevista: ${value.retentionDays} días.`
        : `${value.controllerName} will use responses for ${value.purpose}. Participation: ${value.participationMode}. Declared basis: ${value.legalBasis}. Confidentiality: ${value.confidentiality}. Expected retention: ${value.retentionDays} days.`;
      await tx.participantNoticeVersion.create({ data: { assessmentId: id, version: `1.${count}`, locale: value.locale, title: value.locale === "es" ? "Antes de comenzar" : "Before you begin", content, contentHash: sha256(content), active: true } });
      await tx.assessment.update({ where: { id }, data: { readinessScore: null, status: a.status === "DRAFT" ? "PREPARATION" : a.status } });
      await tx.auditEvent.create({ data: { organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: value.approve ? "LEGAL_PROFILE_APPROVED" : "LEGAL_PROFILE_UPDATED", targetType: "AssessmentLegalProfile", targetId: profile.id, metadata: { locale: value.locale, approved: value.approve } } });
    });
    return { ok: true };
  }


  @Post(":id/status")
  async status(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    const value = StatusSchema.parse(body);
    const a = await this.svc.get(id);
    if (!(transitions[a.status] ?? []).includes(value.status)) throw new BadRequestException("Invalid transition");
    const approvalTargets = new Set(["READY", "ACTIVE", "CLOSED", "ARCHIVED"]);
    await requireCapability(this.db, req, approvalTargets.has(value.status) ? "assessment.approve" : "assessment.edit", id);
    if (value.status === "REVIEW" && !a.questions.length) throw new BadRequestException("Questions required");
    if (value.status === "READY" && ((a.readinessScore ?? 0) < 80 || !a.legalProfile?.approvedAt || !a.participantNotices.length)) throw new BadRequestException("Review, privacy and readiness are required");

    let frozenVersion: any = null;
    if (value.status === "READY") frozenVersion = await this.svc.freezeVersion(id, identityFrom(req).email);
    let launch: any = null;

    if (value.status === "ACTIVE") {
      const checklist = await this.svc.launchChecklist(id);
      if (!checklist.canLaunch) throw new BadRequestException(`Launch blocked: ${checklist.missing.join(", ")}`);

      const rows = await this.svc.resolvePopulation(id, a.organizationId);
      if (!rows.length) throw new BadRequestException("Launch blocked: population resolves to zero active participants");

      const populationSnapshot = buildPopulationSnapshot(rows, a.privacyMode, a.legalProfile?.dataFields);
      frozenVersion = await this.svc.freezeVersion(id, identityFrom(req).email, populationSnapshot);

      await this.db.$transaction(async (tx) => {
        const existingFrozenParticipants = await tx.participant.count({
          where: { assessmentId: id, assessmentVersionId: frozenVersion.id },
        });
        if (existingFrozenParticipants) {
          if (existingFrozenParticipants !== rows.length) {
            throw new BadRequestException("Launch recovery blocked: frozen population is incomplete");
          }
          return;
        }

        for (const person of rows) {
          const segments = participantSegments(person, a.legalProfile?.dataFields);
          const token = `pl_${randomBytes(18).toString("base64url")}`;
          const tokenHash = sha256(token);

          if (a.privacyMode === "ANONYMOUS") {
            await tx.participant.create({
              data: {
                assessmentId: id,
                assessmentVersionId: frozenVersion.id,
                pseudonym: randomPseudonym(),
                tokenHash,
                status: "INVITED",
                locale: person.locale,
                segmentSnapshot: segments as any,
              },
            });
          } else {
            const exists = await tx.participant.findFirst({ where: { assessmentId: id, identity: { emailLookup: person.emailLookup } } });
            if (exists) {
              await tx.participant.update({
                where: { id: exists.id },
                data: { assessmentVersionId: frozenVersion.id, locale: person.locale, segmentSnapshot: segments as any },
              });
              continue;
            }

            const participant = await tx.participant.create({
              data: {
                assessmentId: id,
                assessmentVersionId: frozenVersion.id,
                pseudonym: randomPseudonym(),
                tokenHash,
                status: "INVITED",
                locale: person.locale,
                segmentSnapshot: segments as any,
              },
            });
            await tx.participantIdentity.create({
              data: {
                participantId: participant.id,
                emailEncrypted: person.emailEncrypted,
                emailLookup: person.emailLookup,
                nameEncrypted: person.displayNameEncrypted,
              },
            });
          }

          await tx.outboxEvent.create({
            data: {
              type: "SEND_EMAIL",
              payload: {
                category: "participant-invite",
                assessmentId: id,
                assessmentVersionId: frozenVersion.id,
                locale: person.locale === "en" ? "en" : "es",
                to: decryptText(person.emailEncrypted),
                subject: `Proofline · ${a.title}`,
                text: `${a.title}\n${(process.env.RESPOND_APP_URL ?? "http://localhost:4203").replace(/\/$/, "")}/${person.locale}/${token}`,
              },
            },
          });
        }
      });

      launch = {
        resolved: rows.length,
        versionId: frozenVersion.id,
        version: frozenVersion.version,
        cohortFields: populationSnapshot.cohortFields,
        anonymous: a.privacyMode === "ANONYMOUS",
      };
      await this.db.usageEvent.create({
        data: {
          organizationId: a.organizationId,
          assessmentId: id,
          idempotencyKey: `assessment-launch:${id}`,
          eventType: "ASSESSMENT_LAUNCHED",
          quantity: 1,
          unit: "assessment",
          billable: false,
          periodKey: new Date().toISOString().slice(0, 7),
          metadata: {
            population: rows.length,
            level: a.level,
            assessmentVersionId: frozenVersion.id,
            cohortFields: populationSnapshot.cohortFields,
            anonymous: a.privacyMode === "ANONYMOUS",
          },
        },
      }).catch(() => undefined);
    }

    if (value.status === "ACTIVE" && !frozenVersion) frozenVersion = await this.svc.freezeVersion(id, identityFrom(req).email);
    const updated = await this.db.assessment.update({
      where: { id },
      data: {
        status: value.status,
        ...(value.status === "ACTIVE" ? { launchedAt: new Date(), launchedVersion: frozenVersion?.version ?? undefined } : {}),
        ...(value.status === "CLOSED" ? { closedAt: new Date() } : {}),
      },
    });

    let analysisRunId: string | null = null;
    if (value.status === "CLOSED") {
      const launchedVersion = a.launchedVersion
        ? await this.db.assessmentVersion.findUnique({ where: { assessmentId_version: { assessmentId: id, version: a.launchedVersion } } })
        : null;
      const run = await this.db.analysisRun.create({ data: { assessmentId: id, assessmentVersionId: launchedVersion?.id ?? null, status: "PENDING" } });
      analysisRunId = run.id;
      await this.db.outboxEvent.create({ data: { type: "RUN_ANALYSIS", payload: { assessmentId: id, assessmentVersionId: launchedVersion?.id ?? null, analysisRunId: run.id, locale: a.locale, minCohortSize: a.minCohortSize } } });
      await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "ASSESSMENT_SCORING_QUEUED", targetType: "AnalysisRun", targetId: run.id, metadata: { assessmentId: id, assessmentVersionId: launchedVersion?.id ?? null } });
    }

    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "ASSESSMENT_STATUS_CHANGED", targetType: "Assessment", targetId: id, metadata: { from: a.status, to: value.status, launch, version: frozenVersion?.version ?? null, analysisRunId } });
    return { ok: true, status: updated.status, launch, version: frozenVersion?.version ?? null, analysisRunId };
  }

  @Post(":id/analysis-runs")
  async run(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireCapability(this.db, req, "analysis.run", id);
    const a = await this.svc.get(id);
    if (!["CLOSED", "ARCHIVED"].includes(a.status)) throw new BadRequestException("Results can only be calculated after the assessment is closed");
    const launchedVersion = a.launchedVersion
      ? await this.db.assessmentVersion.findUnique({ where: { assessmentId_version: { assessmentId: id, version: a.launchedVersion } } })
      : null;
    const run = await this.db.analysisRun.create({ data: { assessmentId: id, assessmentVersionId: launchedVersion?.id ?? null, status: "PENDING" } });
    await this.db.outboxEvent.create({ data: { type: "RUN_ANALYSIS", payload: { assessmentId: id, assessmentVersionId: launchedVersion?.id ?? null, analysisRunId: run.id, locale: a.locale, minCohortSize: a.minCohortSize } } });
    await this.audit.record({ organizationId: a.organizationId, actorType: "USER", actorId: identityFrom(req).email, action: "ANALYSIS_RUN_REQUESTED", targetType: "Assessment", targetId: id, metadata: { assessmentVersionId: launchedVersion?.id ?? null, analysisRunId: run.id } });
    return { ok: true, runId: run.id, status: "PENDING", assessmentVersionId: launchedVersion?.id ?? null };
  }
}

function defaultQuestionConfig(type: string): Record<string, unknown> | undefined {
  switch (type) {
    case "LIKERT": return { min: 1, max: 5, minLabel: "Nada de acuerdo", maxLabel: "Totalmente de acuerdo" };
    case "NPS": return { min: 0, max: 10, minLabel: "Nada probable", maxLabel: "Totalmente probable" };
    case "PERCENTAGE": return { min: 0, max: 100, step: 1, unit: "%" };
    case "RANGE":
    case "SLIDER": return { min: 0, max: 10, step: 1 };
    case "NUMERIC": return { min: 0, max: 100, step: 1 };
    case "YES_NO": return { allowNA: false };
    case "SINGLE":
    case "MULTI":
    case "CHECKBOX":
    case "RANKING": return { options: [{ value: "option-1", label: "Opción 1" }, { value: "option-2", label: "Opción 2" }] };
    case "ALLOCATION": return { options: [{ value: "option-1", label: "Opción 1" }, { value: "option-2", label: "Opción 2" }], total: 100 };
    case "DUAL": return { min: 1, max: 5, leftLabel: "Importancia", rightLabel: "Situación actual" };
    case "MATRIX": return { rows: [{ value: "row-1", label: "Elemento 1" }], columns: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }, { value: 5, label: "5" }] };
    case "SHORT_TEXT": return { maxLength: 500 };
    case "LONG_TEXT": return { maxLength: 1200 };
    default: return undefined;
  }
}
