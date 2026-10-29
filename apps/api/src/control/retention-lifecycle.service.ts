import { BadRequestException, Injectable, Inject, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { requireInternalCapability } from "./internal-access.js";
import type { HeaderRequest } from "../auth/dev-auth.js";

type RetentionAction = "DELETE" | "ANONYMIZE" | "BLOCK" | "RETAIN";
type CandidateState = "ELIGIBLE" | "HELD" | "NO_ACTION" | "UNSUPPORTED";

type Candidate = {
  key: string;
  targetType: "DocumentRecord" | "ParticipantIdentity" | "Response" | "AnalysisRun" | "Report";
  targetId: string;
  organizationId: string;
  organizationName: string;
  assessmentId: string | null;
  assessmentTitle: string | null;
  recordClass: string;
  action: RetentionAction;
  dueAt: string;
  state: CandidateState;
  policyId: string;
  policySource: "ASSESSMENT" | "ORGANIZATION";
  legalBasis: string;
  hold?: { id: string; scope: string; reason: string };
};

type PreviewInput = { organizationId?: string; assessmentId?: string; limit?: number };

type PolicyRow = {
  id: string;
  organizationId: string;
  assessmentId: string | null;
  recordClass: string;
  durationDays: number;
  action: RetentionAction;
  legalBasis: string;
  locked: boolean;
};

type HoldRow = { id: string; organizationId: string; assessmentId: string | null; scope: string; reason: string; status: string };

const BROAD_HOLD_SCOPES = new Set(["ALL", "*", "ORGANIZATION", "ALL_DATA", "ALL_RECORDS"]);
const dayMs = 86400000;

function clampLimit(value: unknown) {
  const n = Number(value ?? 100);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(500, Math.trunc(n)));
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * dayMs);
}

function normalizeScope(value: string) {
  return value.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function safeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function anonymizeAnalysisResult(value: unknown, nowIso: string) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
  const themes = Array.isArray(source.qualitativeThemes)
    ? source.qualitativeThemes.map((theme: any) => ({ theme: String(theme?.theme ?? "theme"), mentions: Number(theme?.mentions ?? 0), example: null }))
    : [];
  return {
    ...source,
    qualitativeThemes: themes,
    cohorts: {},
    retentionLifecycle: {
      ...(source.retentionLifecycle && typeof source.retentionLifecycle === "object" ? source.retentionLifecycle : {}),
      anonymizedAt: nowIso,
      mode: "PSEUDONYMIZED_DATASET",
      cohortDetailRemoved: true,
      qualitativeExamplesRemoved: true,
    },
  };
}

function anonymizeReportSnapshot(value: unknown, nowIso: string) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
  const canonical = source.canonical && typeof source.canonical === "object" ? { ...source.canonical } : null;
  if (canonical) {
    canonical.qualitativeThemes = [];
    canonical.cohorts = { visible: [], suppressedCount: Number(canonical?.cohorts?.suppressedCount ?? 0) };
    canonical.evidence = [];
    canonical.retentionLifecycle = { anonymizedAt: nowIso, mode: "APPROVED_REPORT" };
    return { ...source, canonical };
  }
  return { ...source, qualitativeThemes: [], cohorts: { visible: [], suppressedCount: 0 }, evidence: [], retentionLifecycle: { anonymizedAt: nowIso, mode: "APPROVED_REPORT" } };
}

@Injectable()
export class RetentionLifecycleService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private pickPolicy(policies: PolicyRow[], organizationId: string, assessmentId: string | null, recordClass: string) {
    return policies.find((policy) => policy.organizationId === organizationId && policy.assessmentId === assessmentId && policy.recordClass === recordClass)
      ?? policies.find((policy) => policy.organizationId === organizationId && policy.assessmentId === null && policy.recordClass === recordClass)
      ?? null;
  }

  private matchingHold(holds: HoldRow[], organizationId: string, assessmentId: string | null, recordClass: string, targetType: string) {
    return holds.find((hold) => {
      if (hold.status !== "ACTIVE" || hold.organizationId !== organizationId) return false;
      if (hold.assessmentId && hold.assessmentId !== assessmentId) return false;
      const scope = normalizeScope(hold.scope);
      if (BROAD_HOLD_SCOPES.has(scope)) return true;
      if (scope === normalizeScope(recordClass) || scope === normalizeScope(targetType)) return true;
      if (scope === "ASSESSMENT" && Boolean(hold.assessmentId) && hold.assessmentId === assessmentId) return true;
      return false;
    }) ?? null;
  }

  async preview(req: HeaderRequest, input: PreviewInput = {}) {
    requireInternalCapability(req, "legal.read");
    const now = new Date();
    const limit = clampLimit(input.limit);
    const policyWhere: any = {};
    if (input.organizationId) policyWhere.organizationId = input.organizationId;
    if (input.assessmentId) policyWhere.OR = [{ assessmentId: input.assessmentId }, { assessmentId: null }];

    const [policiesRaw, holdsRaw] = await Promise.all([
      this.db.retentionPolicy.findMany({ where: policyWhere, include: { organization: { select: { name: true } }, assessment: { select: { title: true } } }, orderBy: [{ organizationId: "asc" }, { assessmentId: "desc" }, { recordClass: "asc" }] }),
      this.db.legalHold.findMany({ where: { status: "ACTIVE", ...(input.organizationId ? { organizationId: input.organizationId } : {}), ...(input.assessmentId ? { OR: [{ assessmentId: input.assessmentId }, { assessmentId: null }] } : {}) }, orderBy: { createdAt: "desc" } }),
    ]);
    const policies = policiesRaw.map((p) => ({ id: p.id, organizationId: p.organizationId, assessmentId: p.assessmentId, recordClass: p.recordClass, durationDays: p.durationDays, action: p.action as RetentionAction, legalBasis: p.legalBasis, locked: p.locked }));
    const holds = holdsRaw.map((h) => ({ id: h.id, organizationId: h.organizationId, assessmentId: h.assessmentId, scope: h.scope, reason: h.reason, status: h.status }));
    const organizationIds = [...new Set(policies.map((p) => p.organizationId))];
    if (!organizationIds.length) return { generatedAt: now.toISOString(), summary: { policies: 0, activeHolds: holds.length, due: 0, eligible: 0, held: 0, noAction: 0, unsupported: 0 }, candidates: [], coverage: { complete: true, candidateLimit: limit, candidatesTruncated: false, sourceScanMayBeTruncated: false, sourcesScanned: { documents: 0, participants: 0, analysisRuns: 0, reports: 0 } } };

    const assessmentWhere = input.assessmentId ? { id: input.assessmentId } : undefined;
    const [documents, participants, analysisRuns, reports] = await Promise.all([
      this.db.documentRecord.findMany({ where: { organizationId: { in: organizationIds }, ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}), status: { in: ["ACTIVE", "RETENTION_PENDING", "DELETION_SCHEDULED", "BLOCKED"] } }, include: { organization: { select: { name: true } }, assessment: { select: { title: true } } }, orderBy: { createdAt: "asc" }, take: limit * 4 }),
      this.db.participant.findMany({ where: { ...(assessmentWhere ? { assessmentId: assessmentWhere.id } : {}), assessment: { organizationId: { in: organizationIds } } }, include: { identity: true, response: true, assessment: { select: { organizationId: true, title: true } } }, orderBy: { createdAt: "asc" }, take: limit * 4 }),
      this.db.analysisRun.findMany({ where: { ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}), assessment: { organizationId: { in: organizationIds } }, status: "COMPLETED" }, include: { assessment: { include: { organization: { select: { name: true } } } } }, orderBy: { createdAt: "asc" }, take: limit * 4 }),
      this.db.report.findMany({ where: { ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}), assessment: { organizationId: { in: organizationIds } }, status: { in: ["APPROVED", "DISTRIBUTED"] } }, include: { assessment: { include: { organization: { select: { name: true } } } } }, orderBy: { createdAt: "asc" }, take: limit * 4 }),
    ]);

    const candidates: Candidate[] = [];
    const addCandidate = (inputRow: Omit<Candidate, "state" | "hold">) => {
      const dueAt = new Date(inputRow.dueAt);
      if (Number.isNaN(dueAt.getTime()) || dueAt > now) return;
      const hold = this.matchingHold(holds, inputRow.organizationId, inputRow.assessmentId, inputRow.recordClass, inputRow.targetType);
      let state: CandidateState = "ELIGIBLE";
      if (inputRow.action === "RETAIN") state = "NO_ACTION";
      else if (hold) state = "HELD";
      else if (inputRow.targetType !== "DocumentRecord" && inputRow.action === "BLOCK") state = "UNSUPPORTED";
      candidates.push({ ...inputRow, state, ...(hold ? { hold: { id: hold.id, scope: hold.scope, reason: hold.reason } } : {}) });
    };

    for (const record of documents) {
      const policy = this.pickPolicy(policies, record.organizationId, record.assessmentId, record.recordClass);
      if (!policy) continue;
      if (record.status === "BLOCKED" && policy.action === "BLOCK") continue;
      const due = record.retentionUntil ?? addDays(record.createdAt, policy.durationDays);
      addCandidate({ key: `document:${record.id}`, targetType: "DocumentRecord", targetId: record.id, organizationId: record.organizationId, organizationName: record.organization.name, assessmentId: record.assessmentId, assessmentTitle: record.assessment?.title ?? null, recordClass: record.recordClass, action: policy.action, dueAt: due.toISOString(), policyId: policy.id, policySource: policy.assessmentId ? "ASSESSMENT" : "ORGANIZATION", legalBasis: policy.legalBasis });
    }

    for (const participant of participants) {
      const orgId = participant.assessment.organizationId;
      const title = participant.assessment.title;
      if (participant.identity) {
        const policy = this.pickPolicy(policies, orgId, participant.assessmentId, "PARTICIPANT_IDENTITY");
        if (policy) {
          const due = addDays(participant.completedAt ?? participant.createdAt, policy.durationDays);
          addCandidate({ key: `identity:${participant.identity.id}`, targetType: "ParticipantIdentity", targetId: participant.identity.id, organizationId: orgId, organizationName: policiesRaw.find((p) => p.organizationId === orgId)?.organization.name ?? orgId, assessmentId: participant.assessmentId, assessmentTitle: title, recordClass: "PARTICIPANT_IDENTITY", action: policy.action, dueAt: due.toISOString(), policyId: policy.id, policySource: policy.assessmentId ? "ASSESSMENT" : "ORGANIZATION", legalBasis: policy.legalBasis });
        }
      }
      if (participant.response) {
        const policy = this.pickPolicy(policies, orgId, participant.assessmentId, "RAW_RESPONSE");
        const segmentState = participant.segmentSnapshot && typeof participant.segmentSnapshot === "object" && !Array.isArray(participant.segmentSnapshot) ? participant.segmentSnapshot as Record<string, any> : {};
        const alreadyAnonymized = Boolean(segmentState?.retentionLifecycle?.anonymizedAt);
        if (policy && !(policy.action === "ANONYMIZE" && alreadyAnonymized)) {
          const due = addDays(participant.response.completedAt ?? participant.response.startedAt, policy.durationDays);
          addCandidate({ key: `response:${participant.response.id}`, targetType: "Response", targetId: participant.response.id, organizationId: orgId, organizationName: policiesRaw.find((p) => p.organizationId === orgId)?.organization.name ?? orgId, assessmentId: participant.assessmentId, assessmentTitle: title, recordClass: "RAW_RESPONSE", action: policy.action, dueAt: due.toISOString(), policyId: policy.id, policySource: policy.assessmentId ? "ASSESSMENT" : "ORGANIZATION", legalBasis: policy.legalBasis });
        }
      }
    }

    for (const run of analysisRuns) {
      const policy = this.pickPolicy(policies, run.assessment.organizationId, run.assessmentId, "PSEUDONYMIZED_DATASET");
      if (!policy) continue;
      const runResult = run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result as Record<string, any> : {};
      if (policy.action === "ANONYMIZE" && runResult?.retentionLifecycle?.anonymizedAt) continue;
      const due = addDays(run.completedAt ?? run.createdAt, policy.durationDays);
      addCandidate({ key: `analysis:${run.id}`, targetType: "AnalysisRun", targetId: run.id, organizationId: run.assessment.organizationId, organizationName: run.assessment.organization.name, assessmentId: run.assessmentId, assessmentTitle: run.assessment.title, recordClass: "PSEUDONYMIZED_DATASET", action: policy.action, dueAt: due.toISOString(), policyId: policy.id, policySource: policy.assessmentId ? "ASSESSMENT" : "ORGANIZATION", legalBasis: policy.legalBasis });
    }

    for (const report of reports) {
      const policy = this.pickPolicy(policies, report.assessment.organizationId, report.assessmentId, "APPROVED_REPORT");
      if (!policy) continue;
      const reportSnapshot = report.snapshot && typeof report.snapshot === "object" && !Array.isArray(report.snapshot) ? report.snapshot as Record<string, any> : {};
      const reportLifecycle = reportSnapshot?.canonical?.retentionLifecycle ?? reportSnapshot?.retentionLifecycle;
      if (policy.action === "ANONYMIZE" && reportLifecycle?.anonymizedAt) continue;
      const due = report.retentionUntil ?? addDays(report.approvedAt ?? report.createdAt, policy.durationDays);
      addCandidate({ key: `report:${report.id}`, targetType: "Report", targetId: report.id, organizationId: report.assessment.organizationId, organizationName: report.assessment.organization.name, assessmentId: report.assessmentId, assessmentTitle: report.assessment.title, recordClass: "APPROVED_REPORT", action: policy.action, dueAt: due.toISOString(), policyId: policy.id, policySource: policy.assessmentId ? "ASSESSMENT" : "ORGANIZATION", legalBasis: policy.legalBasis });
    }

    candidates.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.key.localeCompare(b.key));
    const limited = candidates.slice(0, limit);
    // Queries are deliberately bounded. Never describe this as a complete census when
    // a source hits its scan cap or eligible candidates exceed the display cap.
    const sourcesScanned = { documents: documents.length, participants: participants.length, analysisRuns: analysisRuns.length, reports: reports.length };
    const sourceScanMayBeTruncated = Object.values(sourcesScanned).some((count) => count >= limit * 4);
    const candidatesTruncated = candidates.length > limit;
    const coverage = { complete: !sourceScanMayBeTruncated && !candidatesTruncated, candidateLimit: limit, candidatesTruncated, sourceScanMayBeTruncated, sourcesScanned };
    return {
      generatedAt: now.toISOString(),
      summary: {
        policies: policies.length,
        activeHolds: holds.length,
        due: candidates.length,
        eligible: candidates.filter((c) => c.state === "ELIGIBLE").length,
        held: candidates.filter((c) => c.state === "HELD").length,
        noAction: candidates.filter((c) => c.state === "NO_ACTION").length,
        unsupported: candidates.filter((c) => c.state === "UNSUPPORTED").length,
      },
      candidates: limited,
      coverage,
    };
  }

  async execute(req: HeaderRequest, input: PreviewInput & { confirm?: string } = {}) {
    const ctx = requireInternalCapability(req, "legal.manage");
    if (input.confirm !== "EXECUTE_RETENTION") throw new BadRequestException("Retention execution requires explicit confirmation");
    if (!input.organizationId) throw new BadRequestException("Retention execution requires an explicitly selected organization; global execution is disabled");
    const preview = await this.preview(req, { organizationId: input.organizationId, assessmentId: input.assessmentId, limit: input.limit ?? 200 });
    // Destructive execution must not rely on a truncated or unprovably complete preview.
    // This guard intentionally fails closed instead of silently executing a partial batch.
    if (!preview.coverage?.complete) throw new BadRequestException("Retention preview is incomplete; execution blocked. Narrow the organization/assessment scope and retry. No records were changed.");
    const eligible = preview.candidates.filter((candidate) => candidate.state === "ELIGIBLE");
    const applied: Array<{ key: string; action: RetentionAction }> = [];
    const failed: Array<{ key: string; error: string }> = [];
    let skippedHeld = 0;
    const now = new Date();
    const nowIso = now.toISOString();

    for (const candidate of eligible) {
      try {
        const liveHolds = await this.db.legalHold.findMany({ where: { organizationId: candidate.organizationId, status: "ACTIVE", OR: [{ assessmentId: candidate.assessmentId }, { assessmentId: null }] } });
        const liveHold = this.matchingHold(liveHolds.map((h) => ({ id: h.id, organizationId: h.organizationId, assessmentId: h.assessmentId, scope: h.scope, reason: h.reason, status: h.status })), candidate.organizationId, candidate.assessmentId, candidate.recordClass, candidate.targetType);
        if (liveHold) { skippedHeld += 1; continue; }
        await this.applyCandidate(candidate, nowIso);
        applied.push({ key: candidate.key, action: candidate.action });
        await this.audit.record({ organizationId: candidate.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "RETENTION_LIFECYCLE_APPLIED", targetType: candidate.targetType, targetId: candidate.targetId, metadata: { recordClass: candidate.recordClass, retentionAction: candidate.action, dueAt: candidate.dueAt, policyId: candidate.policyId, assessmentId: candidate.assessmentId, legalBasis: candidate.legalBasis } });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ key: candidate.key, error: message });
        await this.audit.record({ organizationId: candidate.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "RETENTION_LIFECYCLE_FAILED", targetType: candidate.targetType, targetId: candidate.targetId, metadata: { recordClass: candidate.recordClass, retentionAction: candidate.action, dueAt: candidate.dueAt, policyId: candidate.policyId, error: message } });
      }
    }

    await this.audit.record({ actorType: "INTERNAL", actorId: ctx.identity.email, action: "RETENTION_RUN_EXECUTED", targetType: "RetentionLifecycle", metadata: { organizationId: input.organizationId ?? null, assessmentId: input.assessmentId ?? null, considered: preview.summary.due, eligible: eligible.length, applied: applied.length, failed: failed.length, held: preview.summary.held + skippedHeld, executedAt: nowIso } });
    return { ok: failed.length === 0, generatedAt: nowIso, considered: preview.summary.due, eligible: eligible.length, applied, failed, held: preview.summary.held + skippedHeld };
  }

  private async applyCandidate(candidate: Candidate, nowIso: string) {
    if (candidate.action === "RETAIN") return;
    if (candidate.targetType === "DocumentRecord") {
      const record = await this.db.documentRecord.findUnique({ where: { id: candidate.targetId }, include: { blob: true } });
      if (!record) throw new NotFoundException("Document record not found");
      if (candidate.action === "BLOCK") {
        await this.db.documentRecord.update({ where: { id: record.id }, data: { status: "BLOCKED", metadata: { ...safeMetadata(record.metadata), retentionLifecycle: { action: "BLOCK", appliedAt: nowIso, policyId: candidate.policyId } } as any } });
        return;
      }
      if (candidate.action === "DELETE" || candidate.action === "ANONYMIZE") {
        await this.db.$transaction(async (tx) => {
          await tx.documentBlob.deleteMany({ where: { documentRecordId: record.id } });
          await tx.documentRecord.update({ where: { id: record.id }, data: { status: candidate.action === "DELETE" ? "DESTROYED" : "ANONYMIZED", storageRef: null, title: candidate.action === "DELETE" ? "Destroyed record" : "Anonymized record", fileName: candidate.action === "DELETE" ? "destroyed" : "anonymized", mimeType: "application/octet-stream", metadata: { retentionLifecycle: { action: candidate.action, appliedAt: nowIso, policyId: candidate.policyId, originalContentHash: record.contentHash } } as any } });
        });
        return;
      }
    }

    if (candidate.targetType === "ParticipantIdentity") {
      if (candidate.action === "DELETE" || candidate.action === "ANONYMIZE") {
        await this.db.participantIdentity.delete({ where: { id: candidate.targetId } });
        return;
      }
      throw new BadRequestException(`Retention action ${candidate.action} is not supported for participant identity`);
    }

    if (candidate.targetType === "Response") {
      const response = await this.db.response.findUnique({ where: { id: candidate.targetId }, select: { id: true, participantId: true } });
      if (!response) throw new NotFoundException("Response not found");
      if (candidate.action === "DELETE") {
        await this.db.$transaction([
          this.db.response.delete({ where: { id: response.id } }),
          this.db.participant.update({ where: { id: response.participantId }, data: { status: "REVOKED", segmentSnapshot: null as any } }),
        ]);
        return;
      }
      if (candidate.action === "ANONYMIZE") {
        await this.db.$transaction([
          this.db.participantIdentity.deleteMany({ where: { participantId: response.participantId } }),
          this.db.participant.update({ where: { id: response.participantId }, data: { segmentSnapshot: { retentionLifecycle: { anonymizedAt: nowIso, policyId: candidate.policyId } } as any } }),
        ]);
        return;
      }
      throw new BadRequestException(`Retention action ${candidate.action} is not supported for raw response`);
    }

    if (candidate.targetType === "AnalysisRun") {
      const run = await this.db.analysisRun.findUnique({ where: { id: candidate.targetId } });
      if (!run) throw new NotFoundException("Analysis run not found");
      if (candidate.action === "DELETE") {
        await this.db.analysisRun.delete({ where: { id: run.id } });
        return;
      }
      if (candidate.action === "ANONYMIZE") {
        await this.db.analysisRun.update({ where: { id: run.id }, data: { result: anonymizeAnalysisResult(run.result, nowIso) as any } });
        return;
      }
      throw new BadRequestException(`Retention action ${candidate.action} is not supported for analysis dataset`);
    }

    if (candidate.targetType === "Report") {
      const report = await this.db.report.findUnique({ where: { id: candidate.targetId } });
      if (!report) throw new NotFoundException("Report not found");
      if (candidate.action === "DELETE") {
        await this.db.report.delete({ where: { id: report.id } });
        return;
      }
      if (candidate.action === "ANONYMIZE") {
        await this.db.report.update({ where: { id: report.id }, data: { snapshot: anonymizeReportSnapshot(report.snapshot, nowIso) as any } });
        return;
      }
      throw new BadRequestException(`Retention action ${candidate.action} is not supported for approved report`);
    }

    throw new BadRequestException("Unsupported retention candidate");
  }

  async upsertPolicy(req: HeaderRequest, input: { id?: string; organizationId?: string; assessmentId?: string | null; recordClass?: string; durationDays?: number; action?: RetentionAction; legalBasis?: string }) {
    const ctx = requireInternalCapability(req, "legal.manage");
    const durationDays = Math.trunc(Number(input.durationDays ?? 0));
    const recordClass = String(input.recordClass ?? "").trim().toUpperCase();
    const action = String(input.action ?? "").toUpperCase() as RetentionAction;
    const legalBasis = String(input.legalBasis ?? "").trim();
    if (!recordClass || !["DELETE", "ANONYMIZE", "BLOCK", "RETAIN"].includes(action)) throw new BadRequestException("Invalid retention policy");
    if (durationDays < 1 || durationDays > 3650) throw new BadRequestException("Retention duration must be 1-3650 days");
    if (legalBasis.length < 3) throw new BadRequestException("Legal basis is required");

    if (input.id) {
      const current = await this.db.retentionPolicy.findUnique({ where: { id: input.id } });
      if (!current) throw new NotFoundException("Retention policy not found");
      if (current.locked) throw new BadRequestException("Locked retention policies cannot be changed from Control");
      const updated = await this.db.retentionPolicy.update({ where: { id: current.id }, data: { durationDays, action, legalBasis } });
      await this.audit.record({ organizationId: current.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "RETENTION_POLICY_UPDATED", targetType: "RetentionPolicy", targetId: current.id, metadata: { recordClass: current.recordClass, durationDays, retentionAction: action } });
      return updated;
    }

    const organizationId = String(input.organizationId ?? "").trim();
    if (!organizationId) throw new BadRequestException("Organization is required");
    const organization = await this.db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new NotFoundException("Organization not found");
    const assessmentId = input.assessmentId ? String(input.assessmentId) : null;
    if (assessmentId) {
      const assessment = await this.db.assessment.findFirst({ where: { id: assessmentId, organizationId }, select: { id: true } });
      if (!assessment) throw new BadRequestException("Assessment does not belong to organization");
    }
    const existing = await this.db.retentionPolicy.findFirst({ where: { organizationId, assessmentId, recordClass } });
    if (existing) throw new BadRequestException("A retention policy already exists for this scope and record class");
    const created = await this.db.retentionPolicy.create({ data: { organizationId, assessmentId, recordClass, durationDays, action, legalBasis } });
    await this.audit.record({ organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "RETENTION_POLICY_CREATED", targetType: "RetentionPolicy", targetId: created.id, metadata: { assessmentId, recordClass, durationDays, retentionAction: action } });
    return created;
  }

  async createLegalHold(req: HeaderRequest, input: { organizationId?: string; assessmentId?: string | null; scope?: string; reason?: string }) {
    const ctx = requireInternalCapability(req, "legal.manage");
    const organizationId = String(input.organizationId ?? "").trim();
    const scope = String(input.scope ?? "").trim().toUpperCase();
    const reason = String(input.reason ?? "").trim();
    if (!organizationId || scope.length < 2 || reason.length < 5) throw new BadRequestException("Organization, scope and reason are required");
    const organization = await this.db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new NotFoundException("Organization not found");
    const assessmentId = input.assessmentId ? String(input.assessmentId) : null;
    if (assessmentId) {
      const assessment = await this.db.assessment.findFirst({ where: { id: assessmentId, organizationId }, select: { id: true } });
      if (!assessment) throw new BadRequestException("Assessment does not belong to organization");
    }
    const existing = await this.db.legalHold.findFirst({ where: { organizationId, assessmentId, scope, status: "ACTIVE" } });
    if (existing) throw new BadRequestException("An active legal hold already exists for this scope");
    const hold = await this.db.legalHold.create({ data: { organizationId, assessmentId, scope, reason, status: "ACTIVE" } });
    await this.audit.record({ organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_LEGAL_HOLD_CREATED", targetType: "LegalHold", targetId: hold.id, metadata: { assessmentId, scope, reason } });
    return hold;
  }
}
