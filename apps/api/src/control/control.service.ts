import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { BRANDING_POLICY, BrandingService } from "../branding/branding.service.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "./internal-access.js";

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

@Injectable()
export class ControlService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BrandingService) private readonly branding: BrandingService,
  ) {}

  async overview(req: HeaderRequest) {
    requireInternalCapability(req, "control.overview");
    const period = currentPeriod();
    const [organizations, users, subscriptions, invoices, assessments, participantTotal, participantCompleted, tickets, reports, analysisRuns, outbox, usage, activeHolds, retentionDue, audits] = await Promise.all([
      this.db.organization.count(),
      this.db.user.count(),
      this.db.subscription.findMany({ include: { plan: true, organization: true } }),
      this.db.billingInvoice.findMany(),
      this.db.assessment.findMany({ select: { id: true, status: true } }),
      this.db.participant.count(),
      this.db.participant.count({ where: { status: "COMPLETED" } }),
      this.db.supportTicket.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      this.db.report.findMany({ select: { status: true } }),
      this.db.analysisRun.findMany({ select: { status: true } }),
      this.db.outboxEvent.findMany({ select: { status: true, type: true } }),
      this.db.usageEvent.findMany({ where: { periodKey: period }, select: { quantity: true, billable: true, eventType: true } }),
      this.db.legalHold.count({ where: { status: "ACTIVE" } }),
      this.db.documentRecord.count({ where: { retentionUntil: { lte: daysFromNow(30) }, status: { in: ["ACTIVE", "RETENTION_PENDING"] } } }),
      this.db.auditEvent.findMany({ take: 10, include: { organization: true }, orderBy: { createdAt: "desc" } }),
    ]);

    const recurring = subscriptions.filter(s => s.status === "ACTIVE" || s.status === "TRIAL");
    const mrrCents = sum(recurring.map(s => s.plan.monthlyAmountCents));
    const openInvoiceCents = sum(invoices.filter(i => i.status === "OPEN").map(i => i.amountCents + i.taxCents));
    const billableUnits = sum(usage.filter(u => u.billable).map(u => u.quantity));
    const activeAssessments = assessments.filter(a => a.status === "ACTIVE").length;
    const completedAssessments = assessments.filter(a => a.status === "CLOSED" || a.status === "ARCHIVED").length;
    const failedAnalysis = analysisRuns.filter(r => r.status === "FAILED").length;
    const pendingAnalysis = analysisRuns.filter(r => r.status === "PENDING" || r.status === "RUNNING").length;
    const pendingJobs = outbox.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length;
    const failedJobs = outbox.filter(j => j.status === "FAILED").length;

    return {
      period,
      counts: {
        organizations,
        users,
        assessments: assessments.length,
        activeAssessments,
        completedAssessments,
        participants: participantTotal,
        completedParticipants: participantCompleted,
        openTickets: tickets.length,
        unassignedTickets: tickets.filter(t => !t.assigneeInternalUserId).length,
        overdueTickets: tickets.filter(t => !t.assigneeInternalUserId && t.slaDueAt < new Date()).length,
        activeLegalHolds: activeHolds,
        retentionDue30d: retentionDue,
      },
      finance: {
        mrrCents,
        arrCents: mrrCents * 12,
        openInvoiceCents,
        paidInvoices: invoices.filter(i => i.status === "PAID").length,
        openInvoices: invoices.filter(i => i.status === "OPEN").length,
        pastDueSubscriptions: subscriptions.filter(s => s.status === "PAST_DUE").length,
        billableUnits,
      },
      operations: {
        pendingAnalysis,
        failedAnalysis,
        pendingJobs,
        failedJobs,
        draftReports: reports.filter(r => r.status === "DRAFT").length,
        approvedReports: reports.filter(r => r.status === "APPROVED").length,
        urgentTickets: tickets.filter(t => t.priority === "URGENT" || t.priority === "HIGH").length,
      },
      system: {
        api: "healthy",
        database: "healthy",
        analytics: failedAnalysis > 0 ? "attention" : "healthy",
        queue: failedJobs > 0 ? "attention" : "healthy",
        environment: process.env.NODE_ENV ?? "development",
      },
      recentAudit: audits.map(a => ({ id: a.id, action: a.action, actorType: a.actorType, actorId: a.actorId, targetType: a.targetType, targetId: a.targetId, organization: a.organization?.name ?? null, createdAt: a.createdAt })),
    };
  }

  async organizations(req: HeaderRequest) {
    requireInternalCapability(req, "organizations.read");
    const period = currentPeriod();
    const rows = await this.db.organization.findMany({
      include: {
        memberships: { include: { user: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
        invoices: true,
        tickets: true,
        legalHolds: { where: { status: "ACTIVE" } },
        usageEvents: { where: { periodKey: period } },
        assessments: { select: { id: true, status: true, legalProfile: { select: { approvedAt: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(o => {
      const subscription = o.subscriptions[0] ?? null;
      const owners = o.memberships.filter(m => m.role === "OWNER").map(m => ({ name: m.user.displayName, email: m.user.email }));
      const openBalanceCents = sum(o.invoices.filter(i => i.status === "OPEN").map(i => i.amountCents + i.taxCents));
      const billableUnits = sum(o.usageEvents.filter(u => u.billable).map(u => u.quantity));
      const legalReady = o.assessments.filter(a => a.legalProfile?.approvedAt).length;
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        billingEmail: o.billingEmail,
        defaultLocale: o.defaultLocale,
        createdAt: o.createdAt,
        owners,
        subscription: subscription ? { status: subscription.status, plan: subscription.plan.name, renewsAt: subscription.renewsAt } : null,
        assessments: { total: o.assessments.length, active: o.assessments.filter(a => a.status === "ACTIVE").length, legalReady },
        support: { open: o.tickets.filter(t => !["RESOLVED","CLOSED"].includes(t.status)).length },
        billing: { openBalanceCents },
        usage: { period, billableUnits },
        activeLegalHolds: o.legalHolds.length,
      };
    });
  }

  async organization(req: HeaderRequest, id: string) {
    requireInternalCapability(req, "organizations.read");
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: true, assessmentAccesses: true }, orderBy: { createdAt: "asc" } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
        entitlements: { orderBy: { key: "asc" } },
        invoices: { orderBy: { issuedAt: "desc" }, take: 20 },
        usageEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
        tickets: { orderBy: { updatedAt: "desc" }, take: 20 },
        retentionPolicies: { orderBy: { recordClass: "asc" } },
        legalHolds: { orderBy: { createdAt: "desc" } },
        records: { orderBy: { createdAt: "desc" }, take: 30 },
        auditEvents: { orderBy: { createdAt: "desc" }, take: 30 },
        assessments: {
          orderBy: { createdAt: "desc" },
          include: {
            legalProfile: true,
            _count: { select: { participants: true, reports: true, analysisRuns: true } },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException("Organization not found");
    return { ...organization, branding: await this.branding.get(organization.id, true) };
  }

  async users(req: HeaderRequest) {
    requireInternalCapability(req, "users.read");
    const users = await this.db.user.findMany({
      include: {
        memberships: { include: { organization: true, assessmentAccesses: true } },
        sessions: { where: { revokedAt: null }, select: { id: true, expiresAt: true } },
        trustedDevices: { where: { revokedAt: null }, select: { id: true, trustedUntil: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map(user => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      activeSessions: user.sessions.filter(s => s.expiresAt > new Date()).length,
      trustedDevices: user.trustedDevices.filter(d => d.trustedUntil > new Date()).length,
      createdAt: user.createdAt,
      memberships: user.memberships.map(m => ({ id: m.id, role: m.role, organizationId: m.organizationId, organization: m.organization.name, assessmentScopes: m.assessmentAccesses.length })),
    }));
  }

  async billing(req: HeaderRequest) {
    requireInternalCapability(req, "billing.read");
    const [plans, subscriptions, invoices, entitlements] = await Promise.all([
      this.db.plan.findMany({ orderBy: { monthlyAmountCents: "asc" } }),
      this.db.subscription.findMany({ include: { organization: true, plan: true }, orderBy: { createdAt: "desc" } }),
      this.db.billingInvoice.findMany({ include: { organization: true, documentRecord: true }, orderBy: { issuedAt: "desc" } }),
      this.db.entitlement.findMany({ include: { organization: true }, orderBy: [{ organizationId: "asc" }, { key: "asc" }] }),
    ]);
    return {
      plans,
      subscriptions,
      invoices,
      entitlements,
      totals: {
        openCents: sum(invoices.filter(i => i.status === "OPEN").map(i => i.amountCents + i.taxCents)),
        paidCents: sum(invoices.filter(i => i.status === "PAID").map(i => i.amountCents + i.taxCents)),
        activeSubscriptions: subscriptions.filter(s => s.status === "ACTIVE" || s.status === "TRIAL").length,
        pastDueSubscriptions: subscriptions.filter(s => s.status === "PAST_DUE").length,
      },
    };
  }

  async usage(req: HeaderRequest) {
    requireInternalCapability(req, "usage.read");
    const period = currentPeriod();
    const events = await this.db.usageEvent.findMany({ where: { periodKey: period }, include: { organization: true, assessment: { select: { title: true } } }, orderBy: { occurredAt: "desc" } });
    const byOrganization = new Map<string, { organizationId: string; organization: string; billable: number; nonBillable: number; events: number }>();
    const byType = new Map<string, { eventType: string; quantity: number; billableQuantity: number }>();
    for (const event of events) {
      const org = byOrganization.get(event.organizationId) ?? { organizationId: event.organizationId, organization: event.organization.name, billable: 0, nonBillable: 0, events: 0 };
      org.events += 1;
      if (event.billable) org.billable += event.quantity; else org.nonBillable += event.quantity;
      byOrganization.set(event.organizationId, org);
      const type = byType.get(event.eventType) ?? { eventType: event.eventType, quantity: 0, billableQuantity: 0 };
      type.quantity += event.quantity;
      if (event.billable) type.billableQuantity += event.quantity;
      byType.set(event.eventType, type);
    }
    return { period, byOrganization: [...byOrganization.values()].sort((a,b)=>b.billable-a.billable), byType: [...byType.values()].sort((a,b)=>b.quantity-a.quantity), events: events.slice(0, 100) };
  }

  async assessments(req: HeaderRequest) {
    requireInternalCapability(req, "assessments.read");
    return this.db.assessment.findMany({
      include: {
        organization: true,
        legalProfile: true,
        analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 },
        legalHolds: { where: { status: "ACTIVE" } },
        _count: { select: { participants: true, reports: true, analysisRuns: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async reports(req: HeaderRequest) {
    requireInternalCapability(req, "reports.read");
    return this.db.report.findMany({
      include: {
        assessment: { include: { organization: true } },
        deliveries: { include: { recipient: { select: { displayName: true, roleLabel: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async support(req: HeaderRequest) {
    requireInternalCapability(req, "support.read");
    const tickets = await this.db.supportTicket.findMany({ include: { organization: true }, orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }] });
    return { tickets };
  }

  async communications(req: HeaderRequest) {
    requireInternalCapability(req, "communications.read");
    const [deliveries, outbox] = await Promise.all([
      this.db.reportDelivery.findMany({ include: { report: { include: { assessment: { include: { organization: true } } } }, recipient: { select: { displayName: true, roleLabel: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.outboxEvent.findMany({ where: { OR: [{ type: { contains: "EMAIL" } }, { type: { contains: "REPORT" } }] }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { deliveries, outbox };
  }

  async legal(req: HeaderRequest) {
    requireInternalCapability(req, "legal.read");
    const [legalDocuments, legalInteractions, profiles, retentionPolicies, legalHolds, records] = await Promise.all([
      this.db.legalDocument.findMany({ include: { versions: { orderBy: { effectiveAt: "desc" } } }, orderBy: { key: "asc" } }),
      this.db.legalInteraction.findMany({ include: { documentVersion: { include: { document: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.assessmentLegalProfile.findMany({ include: { assessment: { include: { organization: true } } } }),
      this.db.retentionPolicy.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: [{ organizationId: "asc" }, { recordClass: "asc" }] }),
      this.db.legalHold.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
      this.db.documentRecord.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { legalDocuments, legalInteractions, profiles, retentionPolicies, legalHolds, records };
  }

  async operations(req: HeaderRequest) {
    requireInternalCapability(req, "operations.read");
    const [outbox, analysisRuns] = await Promise.all([
      this.db.outboxEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.analysisRun.findMany({ include: { assessment: { include: { organization: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return {
      outbox,
      analysisRuns,
      queue: {
        pending: outbox.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length,
        failed: outbox.filter(j => j.status === "FAILED").length,
        completed: outbox.filter(j => j.status === "COMPLETED").length,
      },
      analytics: {
        pending: analysisRuns.filter(r => r.status === "PENDING" || r.status === "RUNNING").length,
        failed: analysisRuns.filter(r => r.status === "FAILED").length,
        completed: analysisRuns.filter(r => r.status === "COMPLETED").length,
      },
    };
  }

  async auditLog(req: HeaderRequest) {
    requireInternalCapability(req, "audit.read");
    return this.db.auditEvent.findMany({ include: { organization: true }, orderBy: { createdAt: "desc" }, take: 150 });
  }

  async marketplace(req: HeaderRequest) {
    requireInternalCapability(req, "marketplace.read");
    return this.db.framework.findMany({
      include: { versions: { include: { _count: { select: { assessments: true } } }, orderBy: { publishedAt: "desc" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async security(req: HeaderRequest) {
    requireInternalCapability(req, "security.read");
    const events = await this.db.auditEvent.findMany({
      where: { OR: [{ actorType: "INTERNAL" }, { action: { contains: "ROLE" } }, { action: { contains: "ACCESS" } }, { action: { contains: "SUSPEND" } }, { action: { contains: "SESSION" } }] },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const [internalUsers, clientSessions, internalSessions] = await Promise.all([
      this.db.internalUser.findMany({ include: { sessions: { where: { revokedAt: null } }, trustedDevices: { where: { revokedAt: null } } }, orderBy: { email: "asc" } }),
      this.db.clientAuthSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.db.internalAuthSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return { authMode: process.env.AUTH_MODE ?? "unknown", environment: process.env.NODE_ENV ?? "development", trustZones: { client: "separate-session", participant: "token-scoped", internal: "separate-identity-and-session" }, activeSessions: { client: clientSessions, internal: internalSessions }, internalUsers: internalUsers.map(u => ({ id:u.id,email:u.email,displayName:u.displayName,role:u.role,status:u.status,emailVerifiedAt:u.emailVerifiedAt,lastLoginAt:u.lastLoginAt,activeSessions:u.sessions.filter(s=>s.expiresAt>new Date()).length,trustedDevices:u.trustedDevices.filter(d=>d.trustedUntil>new Date()).length })), events };
  }

  async configuration(req: HeaderRequest) {
    requireInternalCapability(req, "configuration.read");
    const [plans, entitlements] = await Promise.all([this.db.plan.findMany({ orderBy: { monthlyAmountCents: "asc" } }), this.db.entitlement.findMany({ include: { organization: true }, orderBy: [{ organizationId: "asc" }, { key: "asc" }] })]);
    return { locales: ["es", "en"], plans, entitlements, brandingPolicy: BRANDING_POLICY, defaults: { cohortMinimum: 7, controlRegion: "EU-first", participantTokenDisplay: "never-full" } };
  }

  async updateTicketStatus(req: HeaderRequest, ticketId: string, status: string) {
    const ctx = requireInternalCapability(req, "support.manage");
    if (!["OPEN", "IN_PROGRESS", "WAITING", "CLOSED"].includes(status)) throw new BadRequestException("Invalid ticket status");
    const ticket = await this.db.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const updated = await this.db.supportTicket.update({ where: { id: ticketId }, data: { status: status as "OPEN"|"IN_PROGRESS"|"WAITING"|"CLOSED" } });
    await this.audit.record({ organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_SUPPORT_STATUS_CHANGED", targetType: "SupportTicket", targetId: ticketId, metadata: { from: ticket.status, to: status } });
    return updated;
  }

  async reprocessAssessment(req: HeaderRequest, assessmentId: string) {
    const ctx = requireInternalCapability(req, "operations.manage");
    const assessment = await this.db.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException("Assessment not found");
    const run = await this.db.analysisRun.create({ data: { assessmentId, status: "PENDING", engineVersion: "analytics-local-0.1" } });
    await this.db.outboxEvent.create({ data: { type: "RUN_ANALYSIS", payload: { assessmentId, analysisRunId: run.id, locale: assessment.locale, minCohortSize: assessment.minCohortSize } } });
    await this.audit.record({ organizationId: assessment.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_ANALYSIS_REPROCESS_REQUESTED", targetType: "Assessment", targetId: assessmentId, metadata: { analysisRunId: run.id } });
    return { ok: true, analysisRunId: run.id };
  }

  async retryJob(req: HeaderRequest, jobId: string) {
    const ctx = requireInternalCapability(req, "operations.manage");
    const job = await this.db.outboxEvent.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Job not found");
    if (job.status !== "FAILED") throw new BadRequestException("Only failed jobs can be retried");
    const updated = await this.db.outboxEvent.update({ where: { id: jobId }, data: { status: "PENDING", attempts: 0, error: null, lockedAt: null, availableAt: new Date() } });
    await this.audit.record({ actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_JOB_RETRY_REQUESTED", targetType: "OutboxEvent", targetId: jobId, metadata: { type: job.type } });
    return updated;
  }

  async releaseLegalHold(req: HeaderRequest, holdId: string) {
    const ctx = requireInternalCapability(req, "legal.manage");
    const hold = await this.db.legalHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException("Legal hold not found");
    if (hold.status === "RELEASED") return hold;
    const updated = await this.db.legalHold.update({ where: { id: holdId }, data: { status: "RELEASED", releasedAt: new Date() } });
    await this.audit.record({ organizationId: hold.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_LEGAL_HOLD_RELEASED", targetType: "LegalHold", targetId: holdId, metadata: { scope: hold.scope, reason: hold.reason } });
    return updated;
  }
}
