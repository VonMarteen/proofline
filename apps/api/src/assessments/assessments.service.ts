import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { BrandingService } from "../branding/branding.service.js";
import { AuditService } from "../audit/audit.service.js";
import { effectivePolarity, questionCode } from "./scoring-contract.js";
import { parsePagination, paged } from "../common/pagination.js";

@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(PrismaService) private db: PrismaService,
    @Inject(BrandingService) private branding: BrandingService,
    @Inject(AuditService) private audit: AuditService,
  ) {}

  async list(organizationId: string, ids?: string[]) {
    const rows = await this.db.assessment.findMany({
      where: ids ? { organizationId, id: { in: ids } } : { organizationId },
      include: {
        participants: true,
        legalProfile: true,
        audienceTargets: true,
        resultRecipients: { where: { active: true } },
        reports: true,
        frameworkVersion: { include: { framework: true } },
        imports: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { questions: true, participants: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((a) => {
      const completed = a.participants.filter((p) => p.status === "COMPLETED").length;
      const total = a.participants.length;
      return {
        id: a.id,
        organizationId: a.organizationId,
        title: a.title,
        objective: a.objective,
        level: a.level,
        scoringConfig: a.scoringConfig,
        status: a.status,
        locale: a.locale,
        privacyMode: a.privacyMode,
        minCohortSize: a.minCohortSize,
        readinessScore: a.readinessScore,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        launchedAt: a.launchedAt,
        closedAt: a.closedAt,
        frameworkVersion: a.frameworkVersion,
        sourceImport: a.imports[0]
          ? { id: a.imports[0].id, fileName: a.imports[0].fileName, classification: a.imports[0].classification }
          : null,
        legalProfile: a.legalProfile ? { approvedAt: a.legalProfile.approvedAt } : null,
        _count: a._count,
        participantsSummary: { total, completed, rate: total ? Math.round((completed / total) * 100) : 0 },
        populationConfigured: a.audienceTargets.length > 0,
        resultRecipientCount: a.resultRecipients.length,
        reportCount: a.reports.length,
      };
    });
  }


  async listPage(organizationId: string, ids: string[] | undefined, input: { page?: string; pageSize?: string; q?: string; status?: string }) {
    const { page,pageSize,skip,take }=parsePagination(input),q=(input.q??"").trim();
    const where:any={organizationId,...(ids?{id:{in:ids}}:{})};
    if(q)where.OR=[{title:{contains:q,mode:"insensitive"}},{objective:{contains:q,mode:"insensitive"}}];
    if(input.status)where.status=input.status;
    const [total,rows]=await Promise.all([this.db.assessment.count({where}),this.db.assessment.findMany({where,skip,take,include:{participants:true,legalProfile:true,audienceTargets:true,resultRecipients:{where:{active:true}},reports:true,frameworkVersion:{include:{framework:true}},imports:{orderBy:{createdAt:"desc"},take:1},_count:{select:{questions:true,participants:true}}},orderBy:[{updatedAt:"desc"},{id:"asc"}]})]);
    const items=rows.map((a)=>{const completed=a.participants.filter((p)=>p.status==="COMPLETED").length,totalParticipants=a.participants.length;return{id:a.id,organizationId:a.organizationId,title:a.title,objective:a.objective,level:a.level,scoringConfig:a.scoringConfig,status:a.status,locale:a.locale,privacyMode:a.privacyMode,minCohortSize:a.minCohortSize,readinessScore:a.readinessScore,createdAt:a.createdAt,updatedAt:a.updatedAt,launchedAt:a.launchedAt,closedAt:a.closedAt,frameworkVersion:a.frameworkVersion,sourceImport:a.imports[0]?{id:a.imports[0].id,fileName:a.imports[0].fileName,classification:a.imports[0].classification}:null,legalProfile:a.legalProfile?{approvedAt:a.legalProfile.approvedAt}:null,_count:a._count,participantsSummary:{total:totalParticipants,completed,rate:totalParticipants?Math.round((completed/totalParticipants)*100):0},populationConfigured:a.audienceTargets.length>0,resultRecipientCount:a.resultRecipients.length,reportCount:a.reports.length};});
    return paged(items,total,page,pageSize);
  }

  async get(id: string) {
    const a = await this.db.assessment.findUnique({
      where: { id },
      include: {
        organization: true,
        questions: { orderBy: { order: "asc" } },
        legalProfile: true,
        participantNotices: { where: { active: true }, orderBy: { createdAt: "desc" } },
        participants: true,
        analysisRuns: { orderBy: { createdAt: "desc" }, take: 5 },
        frameworkVersion: { include: { framework: true } },
        translations: true,
        audienceTargets: true,
        resultRecipients: { where: { active: true } },
        reports: { orderBy: { createdAt: "desc" }, take: 5 },
        imports: { include: { sourceRecord: true }, orderBy: { createdAt: "desc" }, take: 3 },
        versions: { orderBy: { version: "desc" }, take: 5 },
      },
    });
    if (!a) throw new NotFoundException("Assessment not found");

    const launchedSnapshot = (a.versions.find((v) => v.version === a.launchedVersion)?.snapshot as any)?.branding;
    const branding = launchedSnapshot
      ? await this.branding.fromSnapshot(a.organizationId, launchedSnapshot)
      : await this.branding.get(a.organizationId, true);
    const visualApproval = await this.visualApprovalState(id, branding);
    const completed = a.participants.filter((p) => p.status === "COMPLETED").length;

    return {
      ...a,
      branding,
      visualApproval,
      participantsSummary: {
        total: a.participants.length,
        completed,
        started: a.participants.filter((p) => p.status === "STARTED").length,
        invited: a.participants.filter((p) => p.status === "INVITED").length,
        rate: a.participants.length ? Math.round((completed / a.participants.length) * 100) : 0,
      },
    };
  }

  async check(id: string) {
    const a = await this.get(id);
    const qs = a.questions.filter((q) => q.type !== "INFO");
    const recommendations: string[] = [];
    const dimensions = new Set(qs.map((q) => q.dimension).filter(Boolean)).size;
    const coverage = qs.length ? Math.min(98, 68 + Math.min(5, dimensions) * 6 + (qs.length >= 6 ? 4 : 0)) : 30;

    let clarity = 96;
    for (const q of qs) {
      if (q.prompt.length > 260) clarity -= 3;
      if (/\b(y|and)\b.{0,35}\b(y|and)\b/i.test(q.prompt)) clarity -= 2;
    }
    clarity = Math.max(60, clarity);

    let redundancy = 98;
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        const aa = new Set(words(qs[i]!.prompt));
        const bb = new Set(words(qs[j]!.prompt));
        const overlap = [...aa].filter((x) => bb.has(x)).length / Math.max(1, Math.min(aa.size, bb.size));
        if (overlap > 0.7) {
          redundancy -= 6;
          recommendations.push(`Revisar posible redundancia entre preguntas ${i + 1} y ${j + 1}.`);
        }
      }
    }
    redundancy = Math.max(55, redundancy);

    let configQuality = 100;
    let logicIntegrity = 100;
    let scoringIntegrity = 100;
    const orderById = new Map(a.questions.map((q) => [q.id, q.order]));
    for (const q of a.questions) {
      const config = (q.config ?? {}) as any;
      if (["SINGLE", "MULTI", "CHECKBOX", "RANKING", "ALLOCATION"].includes(q.type) && (!Array.isArray(config.options) || config.options.length < 2)) {
        configQuality -= 12;
        recommendations.push(`La pregunta ${q.order} necesita al menos dos opciones.`);
      }
      if (q.type === "MATRIX" && (!Array.isArray(config.rows) || !config.rows.length || !Array.isArray(config.columns) || config.columns.length < 2)) {
        configQuality -= 15;
        recommendations.push(`Completar filas y columnas de la matriz ${q.order}.`);
      }
      if (["LIKERT", "NUMERIC", "RANGE", "PERCENTAGE", "SLIDER", "NPS", "DUAL"].includes(q.type) && Number(config.max ?? 10) <= Number(config.min ?? 0)) {
        configQuality -= 15;
        recommendations.push(`Revisar mínimo/máximo de la pregunta ${q.order}.`);
      }
      const show = config.logic?.showIf;
      if (show?.questionId && (orderById.get(show.questionId) ?? 999) >= q.order) {
        logicIntegrity -= 20;
        recommendations.push(`La lógica de la pregunta ${q.order} debe depender de una pregunta anterior.`);
      }

      const scoreableType = !["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(q.type);
      const scored = scoreableType && (q.scored ?? true);
      const polarity = effectivePolarity({ polarity: q.polarity as any, reverseScore: q.reverseScore });
      if (scored && (q.weight < 0.25 || q.weight > 5)) {
        scoringIntegrity -= 15;
        recommendations.push(`La pregunta ${q.order} tiene un peso fuera del rango 0,25–5.`);
      }
      if (scored && ["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(q.type)) {
        scoringIntegrity -= 20;
        recommendations.push(`La pregunta ${q.order} no debe contribuir al score en Assessment Engine v1.`);
      }
      if (scored && polarity === "CUSTOM") {
        const options = Array.isArray(config.options) ? config.options : [];
        const hasOptionScores = options.some((option: any) => option && typeof option === "object" && Number.isFinite(Number(option.score)));
        const hasCustomScores = config.customScores && typeof config.customScores === "object" && Object.keys(config.customScores).length > 0;
        if (!hasOptionScores && !hasCustomScores) {
          scoringIntegrity -= 20;
          recommendations.push(`La pregunta ${q.order} usa scoring CUSTOM pero no tiene scores configurados.`);
        }
      }
    }
    configQuality = Math.max(40, configQuality);
    logicIntegrity = Math.max(40, logicIntegrity);
    scoringIntegrity = Math.max(40, scoringIntegrity);

    const levelRanges: Record<string, [number, number]> = { L1: [10, 20], L2: [21, 40], L3: [41, 70], L4: [71, 100] };
    const [levelMin, levelMax] = levelRanges[a.level] ?? [10, 100];
    const questionCount = qs.length;
    const outside = questionCount < levelMin ? levelMin - questionCount : questionCount > levelMax ? questionCount - levelMax : 0;
    const levelFit = Math.max(55, 100 - outside * 4);
    if (outside) recommendations.push(`El nivel ${a.level} recomienda ${levelMin}–${levelMax} preguntas puntuables; actualmente hay ${questionCount}.`);

    const minutes = Math.max(1, Math.round(a.questions.reduce((m, q) => m + durationFor(q.type), 0)));
    const burden = Math.max(50, 100 - Math.max(0, minutes - 8) * 4);
    if (minutes > 15) recommendations.push(`Duración estimada ${minutes} min: revisar carga antes del lanzamiento.`);
    const privacy = a.legalProfile?.approvedAt ? 94 : 65;
    if (!a.legalProfile?.approvedAt) recommendations.push("Completar y aprobar privacidad y cumplimiento.");

    const total = Math.round((coverage + clarity + redundancy + configQuality + logicIntegrity + scoringIntegrity + levelFit + burden + privacy) / 9);
    await this.db.assessment.update({ where: { id }, data: { readinessScore: total } });
    return {
      score: total,
      status: total >= 85 ? "READY_WITH_RECOMMENDATIONS" : "REVIEW_RECOMMENDED",
      estimatedMinutes: minutes,
      level: a.level,
      recommendedQuestionRange: { min: levelMin, max: levelMax },
      checks: {
        objectiveCoverage: coverage,
        questionClarity: clarity,
        redundancy,
        questionConfiguration: configQuality,
        scoringIntegrity,
        levelFit,
        logicIntegrity,
        privacyReadiness: privacy,
        respondentBurden: burden,
      },
      recommendations: [...new Set(recommendations)].slice(0, 16),
    };
  }

  async visualApprovalState(id: string, loadedBranding?: any) {
    const a = await this.db.assessment.findUnique({
      where: { id },
      include: {
        organization: true,
        questions: { orderBy: { order: "asc" }, include: { translations: true } },
        translations: true,
        participantNotices: { where: { active: true }, orderBy: { createdAt: "asc" } },
        visualApprovals: { where: { revokedAt: null }, orderBy: { approvedAt: "desc" } },
      },
    });
    if (!a) throw new NotFoundException("Assessment not found");
    const branding = loadedBranding ?? await this.branding.get(a.organizationId, false);
    const configured = Boolean(branding.configured && branding.enabled && branding.logoDocumentId);
    const participantVisual = {
      organizationName: a.organization.name,
      title: a.title,
      objective: a.objective,
      locale: a.locale,
      privacyMode: a.privacyMode,
      translations: a.translations.map((t) => ({ locale: t.locale, title: t.title, objective: t.objective })),
      questions: a.questions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        dimension: q.dimension,
        subdimension: q.subdimension,
        required: q.required,
        config: q.config,
        translations: q.translations.map((t) => ({ locale: t.locale, prompt: t.prompt })),
      })),
      participantNotices: a.participantNotices.map((n) => ({ id: n.id, version: n.version, locale: n.locale, title: n.title, contentHash: n.contentHash })),
      branding: {
        enabled: branding.enabled,
        primaryColor: branding.primaryColor,
        backgroundColor: branding.backgroundColor,
        surfaceColor: branding.surfaceColor,
        textColor: branding.textColor,
        logoDocumentId: branding.logoDocumentId,
        logoAltText: branding.logoAltText,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(participantVisual)).digest("hex");
    const approval = a.visualApprovals.find((v) => v.contentHash === contentHash) ?? null;
    return {
      configured,
      contentHash,
      approved: Boolean(approval),
      approval: approval ? { id: approval.id, approvedBy: approval.approvedBy, approvedAt: approval.approvedAt, contentHash: approval.contentHash } : null,
      reasons: [
        ...(!configured ? ["ORGANIZATION_BRANDING_REQUIRED"] : []),
        ...(configured && !approval ? ["PARTICIPANT_PREVIEW_APPROVAL_REQUIRED"] : []),
      ],
    };
  }

  async approveVisual(id: string, approvedBy: string) {
    const state = await this.visualApprovalState(id);
    if (!state.configured) {
      throw new BadRequestException("Organization branding must include an explicitly configured logo and accessible colors before preview approval");
    }
    if (state.approval) return { ok: true, ...state, alreadyApproved: true };
    const a = await this.db.assessment.findUniqueOrThrow({ where: { id }, select: { organizationId: true } });
    const row = await this.db.assessmentVisualApproval.create({
      data: { assessmentId: id, contentHash: state.contentHash, approvedBy, metadata: { source: "participant-preview", brandingRequired: true } },
    });
    await this.audit.record({
      organizationId: a.organizationId,
      actorType: "USER",
      actorId: approvedBy,
      action: "ASSESSMENT_VISUAL_PREVIEW_APPROVED",
      targetType: "AssessmentVisualApproval",
      targetId: row.id,
      metadata: { assessmentId: id, contentHash: state.contentHash },
    });
    return {
      ok: true,
      configured: true,
      approved: true,
      contentHash: state.contentHash,
      approval: { id: row.id, approvedBy: row.approvedBy, approvedAt: row.approvedAt, contentHash: row.contentHash },
      reasons: [],
    };
  }

  async freezeVersion(id: string, createdBy: string, populationSnapshot?: Record<string, unknown> | null) {
    const a = await this.db.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" }, include: { translations: true } },
        translations: true,
        legalProfile: true,
        participantNotices: { where: { active: true } },
        frameworkVersion: true,
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!a) throw new NotFoundException("Assessment not found");
    const branding = await this.branding.get(a.organizationId, false);
    const visualApproval = await this.visualApprovalState(id, branding);
    const snapshot = {
      schemaVersion: 2,
      title: a.title,
      objective: a.objective,
      level: a.level,
      scoringConfig: a.scoringConfig ?? { version: 1, scale: "0-100", dimensionWeights: {} },
      locale: a.locale,
      privacyMode: a.privacyMode,
      minCohortSize: a.minCohortSize,
      population: populationSnapshot ?? null,
      frameworkVersionId: a.frameworkVersionId,
      translations: a.translations.map((x) => ({ locale: x.locale, title: x.title, objective: x.objective })),
      questions: a.questions.map((q) => ({
        id: q.id,
        code: q.code ?? questionCode(q.order),
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        dimension: q.dimension,
        subdimension: q.subdimension,
        required: q.required,
        scored: !["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(q.type) && q.scored,
        weight: q.weight,
        polarity: effectivePolarity({ polarity: q.polarity as any, reverseScore: q.reverseScore }),
        reverseScore: q.polarity === "REVERSE" || q.reverseScore,
        config: q.config,
        translations: q.translations.map((t) => ({ locale: t.locale, prompt: t.prompt })),
      })),
      legalProfile: a.legalProfile ? {
        controllerName: a.legalProfile.controllerName,
        purpose: a.legalProfile.purpose,
        legalBasis: a.legalProfile.legalBasis,
        participationMode: a.legalProfile.participationMode,
        confidentiality: a.legalProfile.confidentiality,
        retentionDays: a.legalProfile.retentionDays,
      } : null,
      participantNotice: a.participantNotices.map((n) => ({ id: n.id, version: n.version, locale: n.locale, contentHash: n.contentHash })),
      branding: {
        enabled: branding.enabled,
        configured: branding.configured,
        primaryColor: branding.primaryColor,
        backgroundColor: branding.backgroundColor,
        surfaceColor: branding.surfaceColor,
        textColor: branding.textColor,
        logoDocumentId: branding.logoDocumentId,
        logoAltText: branding.logoAltText,
        updatedBy: branding.updatedBy,
        updatedAt: branding.updatedAt,
      },
      visualApproval: visualApproval.approval,
    };
    const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const latest = a.versions[0];
    if (latest?.contentHash === contentHash) return latest;
    return this.db.assessmentVersion.create({
      data: { assessmentId: id, version: (latest?.version ?? 0) + 1, contentHash, snapshot: snapshot as any, createdBy },
    });
  }

  async resolvePopulation(id: string, organizationId: string) {
    const targets = await this.db.assessmentAudienceTarget.findMany({ where: { assessmentId: id } });
    const all = targets.some((x) => x.type === "ALL");
    const unitIds = targets.filter((x) => x.type === "UNIT" && x.unitId).map((x) => x.unitId!);
    const personIds = targets.filter((x) => x.type === "PERSON" && x.personId).map((x) => x.personId!);
    const excluded = new Set(targets.filter((x) => x.type === "EXCLUDE_PERSON" && x.personId).map((x) => x.personId!));
    const OR: any[] = [];
    if (unitIds.length) OR.push({ unitId: { in: unitIds } });
    if (personIds.length) OR.push({ id: { in: personIds } });
    if (!all && !OR.length) return [];

    const rows = await this.db.directoryPerson.findMany({
      where: { organizationId, status: "ACTIVE", ...(all ? {} : { OR }) },
      include: { unit: true },
      orderBy: { id: "asc" },
    });
    return rows.filter((person) => !excluded.has(person.id));
  }

  async launchChecklist(id: string) {
    const a = await this.get(id);
    const visual = a.visualApproval;
    const [sub, entitlements, otherActive, resolvedPopulation] = await Promise.all([
      this.db.subscription.findFirst({ where: { organizationId: a.organizationId, status: { in: ["TRIAL", "ACTIVE"] } }, orderBy: { createdAt: "desc" } }),
      this.db.entitlement.findMany({ where: { organizationId: a.organizationId } }),
      this.db.assessment.count({ where: { organizationId: a.organizationId, status: "ACTIVE", id: { not: id } } }),
      this.resolvePopulation(id, a.organizationId),
    ]);
    const trialValid = sub?.status !== "TRIAL" || !sub.renewsAt || sub.renewsAt > new Date();
    const entitlementMap = Object.fromEntries(entitlements.map((e) => [e.key, e.value]));
    const rawLimit = entitlementMap["assessments.active.max"] ?? entitlementMap["plan.activeAssessments"] ?? null;
    const activeLimit = rawLimit == null ? null : Number(rawLimit);
    const entitlementsReady = activeLimit == null || !Number.isFinite(activeLimit) || otherActive < activeLimit;
    const checks = {
      questions: a.questions.some((q) => q.type !== "INFO"),
      prooflineCheck: (a.readinessScore ?? 0) >= 80,
      population: resolvedPopulation.length > 0,
      privacy: Boolean(a.legalProfile?.approvedAt),
      participantNotice: a.participantNotices.some((notice) => notice.locale === a.locale),
      resultRecipients: a.resultRecipients.length > 0,
      locale: Boolean(a.locale),
      assessmentLevel: ["L1", "L2", "L3", "L4"].includes(a.level),
      brandingConfigured: Boolean(visual?.configured),
      visualPreviewApproved: Boolean(visual?.approved),
      subscriptionReady: Boolean(sub && trialValid),
      entitlementsReady,
      readyStatus: a.status === "READY",
    };
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
    return {
      ...checks,
      canLaunch: missing.length === 0,
      missing,
      details: {
        questions: a.questions.length,
        level: a.level,
        readiness: a.readinessScore,
        targets: a.audienceTargets.length,
        resolvedPopulation: resolvedPopulation.length,
        resultRecipients: a.resultRecipients.length,
        visualApproval: visual?.approval ?? null,
        subscription: sub ? { status: sub.status, renewsAt: sub.renewsAt } : null,
        entitlements: { activeAssessments: otherActive, activeAssessmentLimit: activeLimit },
      },
    };
  }
}

function words(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((x) => x.length > 4);
}
function durationFor(t: string) {
  if (t === "LONG_TEXT") return 1.2;
  if (t === "SHORT_TEXT") return 0.6;
  if (t === "MATRIX") return 1.4;
  if (t === "RANKING" || t === "ALLOCATION") return 1;
  if (t === "DUAL") return 0.7;
  if (t === "INFO") return 0.15;
  return 0.35;
}
