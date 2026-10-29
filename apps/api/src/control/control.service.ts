import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { internalRoleCapabilities } from "./internal-access.js";
import { organizationSearch, requestedOrganizationLocale, legalVersionInput, legalPublishReason } from "./p7-policy.js";
import { operationsFilters } from "./p4-filters.js";
import { assessmentFilters, reportFilters, frameworkFilters, participantProgress, reportDeliveryTotals, canReprocessAssessment } from "./p5-policy.js";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { BRANDING_POLICY, BrandingService } from "../branding/branding.service.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { internalContext, requireInternalCapability } from "./internal-access.js";
import { parsePagination, clampedPagination, paged } from "../common/pagination.js";
import { SystemHealthService } from "./system-health.service.js";

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

@Injectable()
export class ControlService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BrandingService) private readonly branding: BrandingService,
    @Inject(SystemHealthService) private readonly health: SystemHealthService,
  ) {}

  async overview(req: HeaderRequest) {
    requireInternalCapability(req, "control.overview");
    const period = currentPeriod();
    const systemHealthPromise = this.health.snapshot();
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
    const systemHealth = await systemHealthPromise;

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
        api: systemHealth.api.status,
        database: systemHealth.database.status,
        analytics: systemHealth.analytics.status,
        queue: systemHealth.queue.status,
        mail: systemHealth.mail.status,
        environment: systemHealth.environment,
        checkedAt: systemHealth.checkedAt,
        details: systemHealth,
      },
      recentAudit: audits.map(a => ({ id: a.id, action: a.action, actorType: a.actorType, actorId: a.actorId, targetType: a.targetType, targetId: a.targetId, organization: a.organization?.name ?? null, createdAt: a.createdAt })),
    };
  }

  async systemHealth(req: HeaderRequest) {
    requireInternalCapability(req, "operations.read");
    return this.health.snapshot();
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


  async organizationsPage(req: HeaderRequest, input: { page?: string; pageSize?: string; q?: string; status?: string; plan?: string; risk?: string }) {
    requireInternalCapability(req, "organizations.read");
    const { page, pageSize, skip, take } = parsePagination(input);
    const period = currentPeriod();
    const q = (input.q ?? "").trim();
    const where: any = {};
    const and: any[] = [];
    if (q) and.push({ OR: [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { billingEmail: { contains: q, mode: "insensitive" } },
      { contractOwnerEmail: { contains: q, mode: "insensitive" } },
    ] });
    if (input.status) where.subscriptions = { some: { status: input.status } };
    if (input.plan) where.subscriptions = { ...(where.subscriptions ?? {}), some: { ...((where.subscriptions ?? {}).some ?? {}), plan: { name: input.plan } } };
    if (input.risk === "risk") and.push({ OR: [
      { legalHolds: { some: { status: "ACTIVE" } } },
      { tickets: { some: { status: { notIn: ["RESOLVED", "CLOSED"] } } } },
      { invoices: { some: { status: "OPEN" } } },
    ] });
    if (and.length) where.AND = and;
    if (input.risk === "ok") {
      where.legalHolds = { none: { status: "ACTIVE" } };
      where.tickets = { none: { status: { notIn: ["RESOLVED", "CLOSED"] } } };
      where.invoices = { none: { status: "OPEN" } };
    }
    const [total, rows, plans] = await Promise.all([
      this.db.organization.count({ where }),
      this.db.organization.findMany({
        where, skip, take,
        include: {
          memberships: { include: { user: true } },
          subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
          invoices: true, tickets: true,
          legalHolds: { where: { status: "ACTIVE" } },
          usageEvents: { where: { periodKey: period } },
          assessments: { select: { id: true, status: true, legalProfile: { select: { approvedAt: true } } } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      this.db.plan.findMany({ select: { name: true }, orderBy: { monthlyAmountCents: "asc" } }),
    ]);
    const items = rows.map(o => {
      const subscription = o.subscriptions[0] ?? null;
      const owners = o.memberships.filter(m => m.role === "OWNER").map(m => ({ name: m.user.displayName, email: m.user.email }));
      const openBalanceCents = sum(o.invoices.filter(i => i.status === "OPEN").map(i => i.amountCents + i.taxCents));
      const billableUnits = sum(o.usageEvents.filter(u => u.billable).map(u => u.quantity));
      const legalReady = o.assessments.filter(a => a.legalProfile?.approvedAt).length;
      return { id:o.id,name:o.name,slug:o.slug,billingEmail:o.billingEmail,defaultLocale:o.defaultLocale,createdAt:o.createdAt,owners,subscription:subscription?{status:subscription.status,plan:subscription.plan.name,renewsAt:subscription.renewsAt}:null,assessments:{total:o.assessments.length,active:o.assessments.filter(a=>a.status==="ACTIVE").length,legalReady},support:{open:o.tickets.filter(t=>!["RESOLVED","CLOSED"].includes(t.status)).length},billing:{openBalanceCents},usage:{period,billableUnits},activeLegalHolds:o.legalHolds.length };
    });
    return { ...paged(items,total,page,pageSize), filters: { plans: plans.map(p=>p.name) } };
  }

  async usersPage(req: HeaderRequest, input: { page?: string; pageSize?: string; q?: string }) {
    requireInternalCapability(req, "users.read");
    const { page,pageSize,skip,take }=parsePagination(input),q=(input.q??"").trim();
    const where:any=q?{OR:[{email:{contains:q,mode:"insensitive"}},{displayName:{contains:q,mode:"insensitive"}}]}:{};
    const [total,users]=await Promise.all([this.db.user.count({where}),this.db.user.findMany({where,skip,take,include:{memberships:{include:{organization:true,assessmentAccesses:true}},sessions:{where:{revokedAt:null},select:{id:true,expiresAt:true}},trustedDevices:{where:{revokedAt:null},select:{id:true,trustedUntil:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}]})]);
    const items=users.map(user=>({id:user.id,email:user.email,displayName:user.displayName,locale:user.locale,accountStatus:user.accountStatus,emailVerifiedAt:user.emailVerifiedAt,lastLoginAt:user.lastLoginAt,activeSessions:user.sessions.filter(x=>x.expiresAt>new Date()).length,trustedDevices:user.trustedDevices.filter(x=>x.trustedUntil>new Date()).length,createdAt:user.createdAt,memberships:user.memberships.map(m=>({id:m.id,role:m.role,organizationId:m.organizationId,organization:m.organization.name,assessmentScopes:m.assessmentAccesses.length}))}));
    return paged(items,total,page,pageSize);
  }

  // P5: only aggregate participant status counts leave the server, never identities or answers.
  async assessmentsPage(req: HeaderRequest, input: {page?:string;pageSize?:string;q?:string;status?:string}) {
    requireInternalCapability(req,"assessments.read");
    const filter=assessmentFilters(input),where:any={};
    if(filter.q)where.OR=[{title:{contains:filter.q,mode:"insensitive"}},{organization:{name:{contains:filter.q,mode:"insensitive"}}}];
    if(filter.status)where.status=filter.status;
    const [total,byStatus]=await Promise.all([
      this.db.assessment.count({where}),
      this.db.assessment.groupBy({by:["status"],where,_count:{_all:true}}),
    ]);
    const pg=clampedPagination(total,input);
    const items=await this.db.assessment.findMany({where,skip:pg.skip,take:pg.take,
      select:{id:true,title:true,status:true,updatedAt:true,privacyMode:true,level:true,
        organization:{select:{id:true,name:true}},legalProfile:{select:{approvedAt:true}},
        analysisRuns:{select:{id:true,status:true,createdAt:true},orderBy:[{createdAt:"desc"},{id:"desc"}],take:1},
        legalHolds:{where:{status:"ACTIVE"},select:{id:true},take:1},
        _count:{select:{participants:true,reports:true,analysisRuns:true}}},
      orderBy:[{updatedAt:"desc"},{id:"asc"}]});
    const breakdown=items.length?await this.db.participant.groupBy({by:["assessmentId","status"],where:{assessmentId:{in:items.map(a=>a.id)}},_count:{_all:true}}):[];
    const counts=new Map<string,typeof breakdown>();
    for(const b of breakdown){const existing=counts.get(b.assessmentId)??[];existing.push(b);counts.set(b.assessmentId,existing);}
    const inFlight=items.length?await this.db.analysisRun.findMany({where:{assessmentId:{in:items.map(a=>a.id)},status:{in:["PENDING","RUNNING"]}},select:{assessmentId:true},distinct:["assessmentId"]}):[];
    const processing=new Set(inFlight.map(run=>run.assessmentId));
    const result=items.map(a=>({ ...a,progress:participantProgress(counts.get(a.id)??[]),
      canReprocess:canReprocessAssessment(a.status,processing.has(a.id))}));
    const summary=Object.fromEntries(byStatus.map(s=>[s.status,s._count._all]));
    return {...paged(result,total,pg.page,pg.pageSize),summary};
  }

  // P5: report metadata and delivery aggregates only. Do not fetch snapshots or recipient PII.
  async reportsPage(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string;status?:string;kind?:string;delivery?:string}) {
    requireInternalCapability(req,"reports.read");
    const f=reportFilters(input),where:any={};
    if(f.q)where.assessment={OR:[{title:{contains:f.q,mode:"insensitive"}},{organization:{name:{contains:f.q,mode:"insensitive"}}}]};
    if(f.status)where.status=f.status;
    if(f.kind)where.kind=f.kind;
    if(f.delivery)where.deliveries=f.delivery==="NONE"?{none:{}}:{some:{status:f.delivery}};
    const total=await this.db.report.count({where}),pg=clampedPagination(total,input);
    const items=await this.db.report.findMany({where,skip:pg.skip,take:pg.take,
      select:{id:true,kind:true,status:true,version:true,snapshotHash:true,approvedAt:true,distributedAt:true,createdAt:true,
        assessment:{select:{id:true,title:true,organization:{select:{id:true,name:true}}}}},
      orderBy:[{createdAt:"desc"},{id:"asc"}]});
    const breakdown=items.length?await this.db.reportDelivery.groupBy({by:["reportId","status"],where:{reportId:{in:items.map(r=>r.id)}},_count:{_all:true}}):[];
    const counts=new Map<string,typeof breakdown>();
    for(const b of breakdown){const existing=counts.get(b.reportId)??[];existing.push(b);counts.set(b.reportId,existing);}
    return paged(items.map(r=>({...r,deliverySummary:reportDeliveryTotals(counts.get(r.id)??[])})),total,pg.page,pg.pageSize);
  }

  /** CQF-F4: traceability only. No answers, participant identities, scoring result or report snapshots. */
  async assessmentOperationalDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"assessments.read");
    const assessment=await this.db.assessment.findUnique({where:{id},select:{
      id:true,title:true,objective:true,status:true,level:true,privacyMode:true,locale:true,
      minCohortSize:true,updatedAt:true,createdAt:true,closedAt:true,
      organization:{select:{id:true,name:true}},legalProfile:{select:{approvedAt:true}},
      legalHolds:{where:{status:"ACTIVE"},select:{id:true},take:1},
      analysisRuns:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:20,
        select:{id:true,status:true,engineVersion:true,createdAt:true,startedAt:true,completedAt:true,sourceHash:true,error:true}},
      reports:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:20,
        select:{id:true,kind:true,status:true,version:true,createdAt:true,approvedAt:true,distributedAt:true}},
      _count:{select:{participants:true,analysisRuns:true,reports:true}},
    }});
    if(!assessment)throw new NotFoundException("Assessment not found");
    const [groups,inFlight]=await Promise.all([
      this.db.participant.groupBy({by:["status"],where:{assessmentId:id},_count:{_all:true}}),
      this.db.analysisRun.count({where:{assessmentId:id,status:{in:["PENDING","RUNNING"]}}}),
    ]);
    const {analysisRuns,...safe}=assessment;
    return {...safe,
      analysisRuns:analysisRuns.map(({error,...run})=>({...run,errorRecorded:Boolean(error)})),
      progress:participantProgress(groups),
      canReprocess:canReprocessAssessment(assessment.status,inFlight>0),
      truncated:{analysisRuns:assessment._count.analysisRuns>analysisRuns.length,reports:assessment._count.reports>assessment.reports.length},
    };
  }

  /** CQF-F4: bounded deliveries with DB counts; never return recipient PII or the report snapshot. */
  async reportOperationalDetail(req:HeaderRequest,id:string,input:{page?:string;pageSize?:string}){
    requireInternalCapability(req,"reports.read");
    const report=await this.db.report.findUnique({where:{id},select:{
      id:true,kind:true,status:true,version:true,snapshotHash:true,
      createdAt:true,approvedAt:true,distributedAt:true,
      assessment:{select:{id:true,title:true,organization:{select:{id:true,name:true}}}},
    }});
    if(!report)throw new NotFoundException("Report not found");
    const pg=parsePagination(input);
    const [total,breakdown]=await Promise.all([
      this.db.reportDelivery.count({where:{reportId:id}}),
      this.db.reportDelivery.groupBy({by:["status"],where:{reportId:id},_count:{_all:true}}),
    ]);
    const window=clampedPagination(total,pg);
    const deliveries=await this.db.reportDelivery.findMany({where:{reportId:id},skip:window.skip,take:window.take,
      select:{id:true,status:true,channel:true,createdAt:true,sentAt:true,error:true},
      orderBy:[{createdAt:"desc"},{id:"asc"}]});
    return {...report,deliverySummary:reportDeliveryTotals(breakdown),
      deliveries:paged(deliveries.map(({error,...delivery})=>({...delivery,errorRecorded:Boolean(error)})),total,window.page,window.pageSize)};
  }

  async auditPage(req: HeaderRequest, input: { page?: string; pageSize?: string; q?: string }) {
    requireInternalCapability(req,"audit.read");
    const {page,pageSize,skip,take}=parsePagination(input),q=(input.q??"").trim();
    const where:any=q?{OR:[{action:{contains:q,mode:"insensitive"}},{actorId:{contains:q,mode:"insensitive"}},{targetType:{contains:q,mode:"insensitive"}},{targetId:{contains:q,mode:"insensitive"}},{organization:{name:{contains:q,mode:"insensitive"}}}]}:{};
    const [total,items]=await Promise.all([this.db.auditEvent.count({where}),this.db.auditEvent.findMany({where,skip,take,include:{organization:true},orderBy:[{createdAt:"desc"},{id:"asc"}]})]);
    return paged(items,total,page,pageSize);
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
    const [open,paid,activeSubscriptions,pastDueSubscriptions,activePaymentMethods,pendingPaymentMethods] = await Promise.all([
      this.db.billingInvoice.aggregate({where:{status:"OPEN"},_sum:{amountCents:true,taxCents:true}}),
      this.db.billingInvoice.aggregate({where:{status:"PAID"},_sum:{amountCents:true,taxCents:true}}),
      this.db.subscription.count({where:{status:{in:["ACTIVE","TRIAL"]}}}),
      this.db.subscription.count({where:{status:"PAST_DUE"}}),
      this.db.paymentMethod.count({where:{status:"ACTIVE"}}),
      this.db.paymentMethod.count({where:{status:"PENDING"}}),
    ]);
    return { totals: {
      openCents:(open._sum.amountCents??0)+(open._sum.taxCents??0),
      paidCents:(paid._sum.amountCents??0)+(paid._sum.taxCents??0),
      activeSubscriptions,pastDueSubscriptions,activePaymentMethods,pendingPaymentMethods,
    }};
  }

  async billingSubscriptionsPage(req: HeaderRequest,input:{page?:string;pageSize?:string;q?:string;status?:string;planCode?:string}) {
    requireInternalCapability(req,"billing.read");
    const q=input.q?.trim().slice(0,120),where:any={};
    if(input.status && ["ACTIVE","TRIAL","PAST_DUE","CANCELED","SUSPENDED"].includes(input.status))where.status=input.status;
    if(input.planCode)where.plan={code:input.planCode.slice(0,80)};
    if(q)where.OR=[
      {id:{contains:q,mode:"insensitive"}},
      {externalRef:{contains:q,mode:"insensitive"}},
      {organization:{name:{contains:q,mode:"insensitive"}}},
      {organization:{billingEmail:{contains:q,mode:"insensitive"}}},
      {plan:{name:{contains:q,mode:"insensitive"}}},
    ];
    const total=await this.db.subscription.count({where});
    const pg=clampedPagination(total,input);
    const items=await this.db.subscription.findMany({
        where,skip:pg.skip,take:pg.take,
        include:{organization:{include:{paymentMethods:{where:{status:{in:["ACTIVE","PENDING"]}},orderBy:{createdAt:"desc"},take:5}}},plan:true},
        orderBy:[{createdAt:"desc"},{id:"asc"}],
      });
    return paged(items,total,pg.page,pg.pageSize);
  }

  async billingMethodsPage(req: HeaderRequest,input:{page?:string;pageSize?:string}) {
    requireInternalCapability(req,"billing.read"); const pg=parsePagination(input);
    const select={id:true,organizationId:true,provider:true,type:true,status:true,isDefault:true,maskedLabel:true,brand:true,last4:true,paymentTermsDays:true,createdAt:true,activatedAt:true,organization:{select:{name:true}}} as const;
    const [total,items]=await Promise.all([this.db.paymentMethod.count(),this.db.paymentMethod.findMany({skip:pg.skip,take:pg.take,select,orderBy:[{createdAt:"desc"},{id:"asc"}]})]);
    return paged(items,total,pg.page,pg.pageSize);
  }

  async billingInvoicesPage(req: HeaderRequest,input:{page?:string;pageSize?:string}) {
    requireInternalCapability(req,"billing.read"); const pg=parsePagination(input),where:any={status:{not:"DRAFT"}};
    const [total,items]=await Promise.all([this.db.billingInvoice.count({where}),this.db.billingInvoice.findMany({where,skip:pg.skip,take:pg.take,include:{organization:true,documentRecord:true},orderBy:[{issuedAt:"desc"},{id:"asc"}]})]);
    return paged(items,total,pg.page,pg.pageSize);
  }

  async billingTransactionsPage(req: HeaderRequest,input:{page?:string;pageSize?:string}) {
    requireInternalCapability(req,"billing.read"); const pg=parsePagination(input);
    const [total,items]=await Promise.all([this.db.paymentTransaction.count(),this.db.paymentTransaction.findMany({skip:pg.skip,take:pg.take,include:{organization:true},orderBy:[{occurredAt:"desc"},{id:"asc"}]})]);
    return paged(items,total,pg.page,pg.pageSize);
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


  async usagePage(req: HeaderRequest, input:{page?:string;pageSize?:string}) {
    requireInternalCapability(req,"usage.read");
    const period=currentPeriod(),pg=parsePagination(input);
    const [total,events,groupOrg,groupType]=await Promise.all([
      this.db.usageEvent.count({where:{periodKey:period}}),
      this.db.usageEvent.findMany({where:{periodKey:period},skip:pg.skip,take:pg.take,include:{organization:true,assessment:{select:{title:true}}},orderBy:[{occurredAt:"desc"},{id:"asc"}]}),
      this.db.usageEvent.groupBy({by:["organizationId","billable"],where:{periodKey:period},_sum:{quantity:true},_count:{_all:true}}),
      this.db.usageEvent.groupBy({by:["eventType","billable"],where:{periodKey:period},_sum:{quantity:true}}),
    ]);
    const orgIds=[...new Set(groupOrg.map(g=>g.organizationId))],orgs=await this.db.organization.findMany({where:{id:{in:orgIds}},select:{id:true,name:true}}),names=new Map(orgs.map(o=>[o.id,o.name]));
    const byOrganization=new Map<string,{organizationId:string;organization:string;billable:number;nonBillable:number;events:number}>();for(const g of groupOrg){const row=byOrganization.get(g.organizationId)??{organizationId:g.organizationId,organization:names.get(g.organizationId)??g.organizationId,billable:0,nonBillable:0,events:0};row.events+=g._count._all;const qty=g._sum.quantity??0;if(g.billable)row.billable+=qty;else row.nonBillable+=qty;byOrganization.set(g.organizationId,row)}
    const byType=new Map<string,{eventType:string;quantity:number;billableQuantity:number}>();for(const g of groupType){const row=byType.get(g.eventType)??{eventType:g.eventType,quantity:0,billableQuantity:0},qty=g._sum.quantity??0;row.quantity+=qty;if(g.billable)row.billableQuantity+=qty;byType.set(g.eventType,row)}
    return{period,byOrganization:[...byOrganization.values()].sort((a,b)=>b.billable-a.billable),byType:[...byType.values()].sort((a,b)=>b.quantity-a.quantity),...paged(events,total,pg.page,pg.pageSize),events};
  }

  async operationsPage(req:HeaderRequest,input:{jobsPage?:string;jobsPageSize?:string;analysisPage?:string;analysisPageSize?:string;jobStatus?:string;jobType?:string;analysisStatus?:string}){
    requireInternalCapability(req,"operations.read");const jobsPg=parsePagination({page:input.jobsPage,pageSize:input.jobsPageSize}),analysisPg=parsePagination({page:input.analysisPage,pageSize:input.analysisPageSize});
    const {jobStatus,analysisStatus,jobType}=operationsFilters(input);
    const jobsWhere:any={...(jobStatus?{status:jobStatus}:{}),...(jobType?{type:{contains:jobType,mode:"insensitive"}}:{})};
    const analysisWhere:any=analysisStatus?{status:analysisStatus}:{};
    const [jobsTotal,analysisTotal]=await Promise.all([this.db.outboxEvent.count({where:jobsWhere}),this.db.analysisRun.count({where:analysisWhere})]);
    const jobsWindow=clampedPagination(jobsTotal,{page:jobsPg.page,pageSize:jobsPg.pageSize});
    const analysisWindow=clampedPagination(analysisTotal,{page:analysisPg.page,pageSize:analysisPg.pageSize});
    const [outbox,analysisRuns,queueCounts,analysisCounts]=await Promise.all([
      this.db.outboxEvent.findMany({where:jobsWhere,skip:jobsWindow.skip,take:jobsWindow.take,orderBy:[{createdAt:"desc"},{id:"asc"}]}),
      this.db.analysisRun.findMany({where:analysisWhere,skip:analysisWindow.skip,take:analysisWindow.take,include:{assessment:{include:{organization:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}]}),
      this.db.outboxEvent.groupBy({by:["status"],_count:{_all:true}}),this.db.analysisRun.groupBy({by:["status"],_count:{_all:true}}),
    ]);
    const qc=new Map(queueCounts.map(x=>[x.status,x._count._all])),ac=new Map(analysisCounts.map(x=>[x.status,x._count._all]));
    return{outbox,analysisRuns,jobsPagination:paged([],jobsTotal,jobsWindow.page,jobsWindow.pageSize).pagination,analysisPagination:paged([],analysisTotal,analysisWindow.page,analysisWindow.pageSize).pagination,queue:{pending:(qc.get("PENDING")??0)+(qc.get("PROCESSING")??0),failed:qc.get("FAILED")??0,completed:qc.get("COMPLETED")??0},analytics:{pending:(ac.get("PENDING")??0)+(ac.get("RUNNING")??0),failed:ac.get("FAILED")??0,completed:ac.get("COMPLETED")??0}};
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

  /** CQF-F2: limited, authorized delivery details; never expose participant tokens. */
  async communicationDeliveryDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"communications.read");
    const row=await this.db.reportDelivery.findUnique({where:{id},select:{
      id:true,status:true,channel:true,sentAt:true,createdAt:true,error:true,
      report:{select:{id:true,kind:true,version:true,assessment:{select:{title:true,organization:{select:{name:true}}}}}},
      recipient:{select:{displayName:true,roleLabel:true}}
    }});
    if(!row)throw new NotFoundException("Report delivery not found");
    const {error,...safe}=row;
    return {...safe,errorRecorded:Boolean(error)};
  }

  /** CQF-F2: operational metadata only. Outbox payload/result may contain OTPs or recipient data. */
  async communicationOutboxDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"communications.read");
    const row=await this.db.outboxEvent.findFirst({where:{id,OR:[
      {type:{contains:"EMAIL"}},{type:{contains:"REPORT"}}
    ]},select:{id:true,type:true,status:true,attempts:true,availableAt:true,
      lockedAt:true,createdAt:true,updatedAt:true,error:true,payload:true,result:true}});
    if(!row)throw new NotFoundException("Outbound event not found");
    const payload=(row.payload&&typeof row.payload==="object"&&!Array.isArray(row.payload)?row.payload:{}) as Record<string,unknown>;
    const result=(row.result&&typeof row.result==="object"&&!Array.isArray(row.result)?row.result:{}) as Record<string,unknown>;
    const safeString=(v:unknown)=>typeof v==="string"&&/^[a-zA-Z0-9_.-]{1,90}$/.test(v)?v:null;
    const safeVersion=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?String(v):safeString(v);
    return {id:row.id,type:row.type,status:row.status,attempts:row.attempts,
      availableAt:row.availableAt,lockedAt:row.lockedAt,
      createdAt:row.createdAt,updatedAt:row.updatedAt,
      category:safeString(payload.category)??safeString(result.category),
      templateId:safeString(payload.templateId)??safeString(result.templateId),
      templateVersion:safeVersion(payload.templateVersion)??safeVersion(result.templateVersion),
      errorRecorded:Boolean(row.error),resultRecorded:Boolean(row.result)};
  }

  /** UX-A3: bounded server-side lists. Older summary endpoints retain their contracts. */
  async legalRecordsPage(req: HeaderRequest,input:{page?:string;pageSize?:string;q?:string;status?:string;recordClass?:string}){
    requireInternalCapability(req,"legal.read");
    const q=(input.q??"").trim().slice(0,100);
    const status=["ACTIVE","RETENTION_PENDING","BLOCKED","ANONYMIZED","DELETION_SCHEDULED","DESTROYED"].includes(input.status??"")?input.status:undefined;
    const recordClass=(input.recordClass??"").trim().slice(0,70);
    const where:any={...status?{status}:{},...recordClass?{recordClass}:{},...q?{OR:[
      {title:{contains:q,mode:"insensitive"}},{fileName:{contains:q,mode:"insensitive"}},
      {recordClass:{contains:q,mode:"insensitive"}},{organization:{name:{contains:q,mode:"insensitive"}}},
    ]}:{}};
    const pg=parsePagination(input);
    const total=await this.db.documentRecord.count({where});
    const window=clampedPagination(total,pg);
    const items=await this.db.documentRecord.findMany({where,skip:window.skip,take:window.take,
      select:{id:true,title:true,fileName:true,recordClass:true,status:true,retentionUntil:true,createdAt:true,organization:{select:{name:true}}},
      orderBy:[{createdAt:"desc"},{id:"asc"}]});
    return paged(items,total,window.page,window.pageSize);
  }

  async legalInteractionsPage(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string;action?:string}){
    requireInternalCapability(req,"legal.read");
    const q=(input.q??"").trim().slice(0,100);
    const action=["ACCEPT","ACKNOWLEDGE","CONSENT","EXPLICIT_CONSENT","REJECT","WITHDRAW"].includes(input.action??"")?input.action:undefined;
    const where:any={...action?{action}:{},...q?{OR:[
      {actorRef:{contains:q,mode:"insensitive"}},{locale:{contains:q,mode:"insensitive"}},
      {documentVersion:{document:{description:{contains:q,mode:"insensitive"}}}},
    ]}:{}};
    const pg=parsePagination(input);
    const total=await this.db.legalInteraction.count({where});
    const window=clampedPagination(total,pg);
    const items=await this.db.legalInteraction.findMany({where,skip:window.skip,take:window.take,
      select:{id:true,action:true,actorType:true,locale:true,createdAt:true,documentVersion:{select:{document:{select:{description:true}}}}},
      orderBy:[{createdAt:"desc"},{id:"asc"}]});
    return paged(items,total,window.page,window.pageSize);
  }

  async securityEventsPage(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string}){
    requireInternalCapability(req,"security.read");
    const q=(input.q??"").trim().slice(0,100);
    const securityScope:any={OR:[{actorType:"INTERNAL"},{action:{contains:"ROLE"}},{action:{contains:"ACCESS"}},{action:{contains:"SUSPEND"}},{action:{contains:"SESSION"}}]};
    const where:any=q?{AND:[securityScope,{OR:[
      {action:{contains:q,mode:"insensitive"}},{actorId:{contains:q,mode:"insensitive"}},
      {targetType:{contains:q,mode:"insensitive"}},{organization:{name:{contains:q,mode:"insensitive"}}},
    ]}]}:securityScope;
    const pg=parsePagination(input);
    const total=await this.db.auditEvent.count({where});
    const window=clampedPagination(total,pg);
    const items=await this.db.auditEvent.findMany({where,skip:window.skip,take:window.take,
      select:{id:true,action:true,actorId:true,targetType:true,createdAt:true,organization:{select:{name:true}}},
      orderBy:[{createdAt:"desc"},{id:"asc"}]});
    return paged(items,total,window.page,window.pageSize);
  }

  async legal(req: HeaderRequest, view?:string) {
    requireInternalCapability(req, "legal.read");
    const uiView=view==="ui";
    const [legalDocuments, legalInteractions, profiles, retentionPolicies, legalHolds, records, dueSoon] = await Promise.all([
      this.db.legalDocument.findMany({ include: { versions: { orderBy: { effectiveAt: "desc" } } }, orderBy: { key: "asc" } }),
      uiView?Promise.resolve([]):this.db.legalInteraction.findMany({ include: { documentVersion: { include: { document: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.assessmentLegalProfile.findMany({ include: { assessment: { include: { organization: true } } } }),
      this.db.retentionPolicy.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: [{ organizationId: "asc" }, { recordClass: "asc" }] }),
      this.db.legalHold.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
      uiView?Promise.resolve([]):this.db.documentRecord.findMany({ include: { organization: true, assessment: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      uiView?this.db.documentRecord.count({where:{retentionUntil:{lte:daysFromNow(30)},status:{in:["ACTIVE","RETENTION_PENDING"]}}}):Promise.resolve(undefined),
    ]);
    return { legalDocuments, legalInteractions, profiles, retentionPolicies, legalHolds, records, ...(uiView?{dueSoon}:{}) };
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

  // P2/7: authorized, bounded operational tables. Summary counts cover the whole dataset.
  async marketplacePage(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string;category?:string;sort?:string;origin?:string;visibility?:string}) {
    requireInternalCapability(req,"marketplace.read");
    const filters=frameworkFilters(input),where:any={};
    if(filters.q)where.OR=[{name:{contains:filters.q,mode:"insensitive"}},{publisher:{contains:filters.q,mode:"insensitive"}},{slug:{contains:filters.q,mode:"insensitive"}}];
    if(filters.category)where.category=filters.category;
    if(filters.origin)where.origin=filters.origin;
    if(filters.visibility)where.visibility=filters.visibility;
    const [total,frameworks,uses,categories]=await Promise.all([
      this.db.framework.count({where}),this.db.framework.count(),
      this.db.assessment.count({where:{frameworkVersionId:{not:null}}}),
      this.db.framework.findMany({distinct:["category"],select:{category:true},orderBy:{category:"asc"}}),
    ]);
    const pg=clampedPagination(total,input);
    const orderBy=filters.sort==="nameDesc"?[{name:"desc" as const},{id:"asc" as const}]:filters.sort==="recent"?[{createdAt:"desc" as const},{id:"asc" as const}]:[{category:"asc" as const},{name:"asc" as const},{id:"asc" as const}];
    const items=await this.db.framework.findMany({where,skip:pg.skip,take:pg.take,
      select:{id:true,name:true,slug:true,publisher:true,category:true,origin:true,visibility:true,createdAt:true,
        versions:{select:{id:true,version:true,publishedAt:true,license:true,_count:{select:{assessments:true}}},orderBy:[{publishedAt:"desc"},{id:"desc"}]}},orderBy});
    return {...paged(items,total,pg.page,pg.pageSize),summary:{frameworks,uses,categories:categories.length},filters:{categories:categories.map(c=>c.category)}};
  }

  async entitlementsPage(req: HeaderRequest,input:{page?:string;pageSize?:string;q?:string;sort?:string}) {
    const abilities=internalContext(req).capabilities;
    if(!["*","configuration.read","billing.read","billing.manage"].some(x=>abilities.includes(x)))requireInternalCapability(req,"configuration.read");
    const q=(input.q??"").trim().slice(0,120);
    const where:any=q?{OR:[{key:{contains:q,mode:"insensitive"}},{organization:{name:{contains:q,mode:"insensitive"}}}]}:{};
    const total=await this.db.entitlement.count({where});
    const pg=clampedPagination(total,input);
    const orderBy=input.sort==="newest"?[{updatedAt:"desc" as const},{id:"asc" as const}]:[{organizationId:"asc" as const},{key:"asc" as const},{id:"asc" as const}];
    const items=await this.db.entitlement.findMany({where,skip:pg.skip,take:pg.take,include:{organization:{select:{id:true,name:true}}},orderBy});
    return paged(items,total,pg.page,pg.pageSize);
  }

  async plansCatalog(req: HeaderRequest) {
    const abilities=internalContext(req).capabilities;
    if(!["*","configuration.read","billing.read","billing.manage"].some(x=>abilities.includes(x)))requireInternalCapability(req,"configuration.read");
    return this.db.plan.findMany({orderBy:[{monthlyAmountCents:"asc"},{id:"asc"}]});
  }

  async internalUsersPage(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string;role?:string;status?:string;sort?:string}) {
    requireInternalCapability(req,"security.read");
    const q=(input.q??"").trim().slice(0,120);
    const where:any={};
    if(q)where.OR=[{displayName:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}}];
    const roles=["INTERNAL_PLATFORM_OWNER","INTERNAL_OPERATIONS","INTERNAL_FINANCE","INTERNAL_TRUST","INTERNAL_SUPPORT","INTERNAL_ANALYST"];
    if(input.role&&roles.includes(input.role))where.role=input.role;
    if(input.status&&["ACTIVE","DISABLED","PENDING_ACTIVATION"].includes(input.status))where.status=input.status;
    const total=await this.db.internalUser.count({where});
    const pg=clampedPagination(total,input);
    const orderBy=input.sort==="recent"?[{createdAt:"desc" as const},{id:"asc" as const}]:[{email:"asc" as const},{id:"asc" as const}];
    const users=await this.db.internalUser.findMany({where,skip:pg.skip,take:pg.take,
      select:{id:true,email:true,displayName:true,role:true,status:true,lastLoginAt:true,
        sessions:{where:{revokedAt:null},select:{expiresAt:true}},
        trustedDevices:{where:{revokedAt:null},select:{trustedUntil:true}}},orderBy});
    const now=new Date();
    const items=users.map(u=>({id:u.id,email:u.email,displayName:u.displayName,role:u.role,status:u.status,lastLoginAt:u.lastLoginAt,
      activeSessions:u.sessions.filter(x=>x.expiresAt>now).length,trustedDevices:u.trustedDevices.filter(x=>x.trustedUntil>now).length}));
    return paged(items,total,pg.page,pg.pageSize);
  }

  // CQF-F1: detailed catalogue view; no raw response or participant data is exposed.
  async legalVersionDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"legal.read");
    const [version,events]=await Promise.all([
      this.db.legalDocumentVersion.findUnique({where:{id},include:{document:{select:{key:true,description:true,scope:true}}}}),
      this.db.auditEvent.findMany({where:{targetType:"LegalDocumentVersion",targetId:id},select:{id:true,action:true,actorId:true,createdAt:true},orderBy:{createdAt:"desc"},take:30})
    ]);
    if(!version)throw new NotFoundException("Legal document version not found");
    const {document,...fields}=version;
    return {version:fields,document,events,hashVerified:createHash("sha256").update(version.content,"utf8").digest("hex")===version.contentHash};
  }

  async securityUserDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"security.read");
    const now=new Date();
    const u=await this.db.internalUser.findUnique({where:{id},select:{id:true,displayName:true,email:true,role:true,status:true,lastLoginAt:true,
       sessions:{where:{revokedAt:null,expiresAt:{gt:now}},select:{id:true}}}});
    if(!u)throw new NotFoundException("Internal user not found");
    return {id:u.id,displayName:u.displayName,email:u.email,role:u.role,status:u.status,lastLoginAt:u.lastLoginAt,activeSessions:u.sessions.length};
  }

  async marketplaceDetail(req:HeaderRequest,id:string){
    requireInternalCapability(req,"marketplace.read");
    const framework=await this.db.framework.findUnique({where:{id},include:{versions:{
      orderBy:[{publishedAt:"desc"},{id:"desc"}],
      include:{_count:{select:{assessments:true}},assessments:{select:{id:true,title:true,status:true,organization:{select:{id:true,name:true}}},orderBy:{createdAt:"desc"},take:20}}
    }}});
    if(!framework)throw new NotFoundException("Framework not found");
    return framework;
  }

  // Owner may amend catalogue presentation for Proofline-owned frameworks only.
  // Published versions, scoring, licenses and linked assessments remain unchanged.
  async updateMarketplaceMetadata(req:HeaderRequest,id:string,body:unknown){
    const ctx=requireInternalCapability(req,"marketplace.manage");
    if(!body||typeof body!=="object")throw new BadRequestException("Invalid framework metadata");
    const b=body as Record<string,unknown>;
    const description=typeof b.description==="string"?b.description.trim():"";
    const category=typeof b.category==="string"?b.category.trim():"";
    if(description.length<10||description.length>3000||category.length<2||category.length>100)
      throw new BadRequestException("Description (10-3000) and category (2-100) required");
    return this.db.$transaction(async tx=>{
      const current=await tx.framework.findUnique({where:{id},select:{id:true,origin:true,description:true,category:true}});
      if(!current)throw new NotFoundException("Framework not found");
      if(current.origin!=="PROOFLINE")throw new ForbiddenException("Only Proofline-owned framework metadata can be edited");
      if(current.description===description&&current.category===category)return {...current,changed:false};
      const updated=await tx.framework.update({where:{id},data:{description,category},select:{id:true,description:true,category:true}});
      await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_FRAMEWORK_METADATA_UPDATED",targetType:"Framework",targetId:id,metadata:{before:{description:current.description,category:current.category},after:{description,category}}}});
      return {...updated,changed:true};
    });
  }

  // Roles are centrally defined in source code; only assignment to a user is editable.
  async updateInternalRole(req:HeaderRequest,id:string,rawRole:unknown){
    const ctx=requireInternalCapability(req,"security.manage");
    const permitted=["INTERNAL_OPERATIONS","INTERNAL_FINANCE","INTERNAL_TRUST","INTERNAL_SUPPORT","INTERNAL_ANALYST"];
    if(typeof rawRole!=="string"||!permitted.includes(rawRole))throw new BadRequestException("Invalid assignable internal role");
    return this.db.$transaction(async tx=>{
      const user=await tx.internalUser.findUnique({where:{id},select:{id:true,email:true,role:true,status:true}});
      if(!user)throw new NotFoundException("Internal user not found");
      if(user.role==="INTERNAL_PLATFORM_OWNER"||user.email===ctx.identity.email)throw new ForbiddenException("Owner and self role changes are prohibited");
      if(user.role===rawRole)return {id,role:rawRole,changed:false};
      const updated=await tx.internalUser.update({where:{id},data:{role:rawRole},select:{id:true,role:true}});
      await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_INTERNAL_ROLE_CHANGED",targetType:"InternalUser",targetId:id,metadata:{email:user.email,previous:user.role,current:rawRole}}});
      return {...updated,changed:true};
    });
  }

  async marketplace(req: HeaderRequest) {
    requireInternalCapability(req, "marketplace.read");
    return this.db.framework.findMany({
      include: { versions: { include: { _count: { select: { assessments: true } } }, orderBy: { publishedAt: "desc" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async security(req: HeaderRequest, view?:string) {
    requireInternalCapability(req, "security.read");
    // All independent queries start together. Never load complete internal sessions,
    // trusted devices, or organization records when only counts / names are displayed.
    const now = new Date();
    const [events, internalUsers, clientSessions, internalSessions] = await Promise.all([
      view==="ui"?Promise.resolve([]):this.db.auditEvent.findMany({
        where: { OR: [{ actorType: "INTERNAL" }, { action: { contains: "ROLE" } }, { action: { contains: "ACCESS" } }, { action: { contains: "SUSPEND" } }, { action: { contains: "SESSION" } }] },
        include: { organization:true },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
      this.db.internalUser.findMany({
        select: { id:true,email:true,displayName:true,role:true,status:true,emailVerifiedAt:true,lastLoginAt:true,
          sessions:{where:{revokedAt:null,expiresAt:{gt:now}},select:{id:true}},
          trustedDevices:{where:{revokedAt:null,trustedUntil:{gt:now}},select:{id:true}} },
        orderBy: { email: "asc" },
      }),
      this.db.clientAuthSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      this.db.internalAuthSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    return { authMode: process.env.AUTH_MODE ?? "unknown", environment: process.env.NODE_ENV ?? "development", trustZones: { client: "separate-session", participant: "token-scoped", internal: "separate-identity-and-session" }, activeSessions: { client: clientSessions, internal: internalSessions }, internalUsers: internalUsers.map(u => ({ id:u.id,email:u.email,displayName:u.displayName,role:u.role,status:u.status,emailVerifiedAt:u.emailVerifiedAt,lastLoginAt:u.lastLoginAt,activeSessions:u.sessions.length,trustedDevices:u.trustedDevices.length })), events };
  }

  async configuration(req: HeaderRequest, search?:string, view?:string) {
    requireInternalCapability(req, "configuration.read");
    const q=organizationSearch(search);
    // Legacy full contract, including entitlements, remains the default for runtime:check.
    // The Control UI never renders entitlements; avoid retrieving them on every visit.
    const uiView=view==="ui";
    const [plans,entitlements,organizations,organizationTotal] = await Promise.all([
      uiView?this.db.plan.findMany({orderBy:{monthlyAmountCents:"asc"},select:{id:true,name:true,code:true,monthlyAmountCents:true}}):this.db.plan.findMany({orderBy:{monthlyAmountCents:"asc"}}),
      uiView?Promise.resolve([]):this.db.entitlement.findMany({ include: { organization: true }, orderBy: [{ organizationId: "asc" }, { key: "asc" }] }),
      this.db.organization.findMany({where:q?{OR:[{name:{contains:q,mode:"insensitive"}},{slug:{contains:q,mode:"insensitive"}}]}:{},select:{id:true,name:true,slug:true,defaultLocale:true},orderBy:{name:"asc"},take:50}),
      this.db.organization.count({where:q?{OR:[{name:{contains:q,mode:"insensitive"}},{slug:{contains:q,mode:"insensitive"}}]}:{}}),
    ]);
    return { locales: ["es", "en"], plans, entitlements, organizations, organizationTotal, organizationQuery:q, brandingPolicy: BRANDING_POLICY, defaults: { cohortMinimum: 7, controlRegion: "EU-first", participantTokenDisplay: "never-full" } };
  }

  async updateOrganizationLocale(req:HeaderRequest,organizationId:string,rawLocale:unknown){
    const ctx=requireInternalCapability(req,"configuration.manage");
    let locale:"es"|"en";
    try{locale=requestedOrganizationLocale(rawLocale);}catch{throw new BadRequestException("Locale must be es or en");}
    return this.db.$transaction(async tx=>{
      const previous=await tx.organization.findUnique({where:{id:organizationId},select:{id:true,defaultLocale:true}});
      if(!previous)throw new NotFoundException("Organization not found");
      if(previous.defaultLocale===locale)return {id:previous.id,defaultLocale:locale,changed:false};
      const updated=await tx.organization.update({where:{id:organizationId},data:{defaultLocale:locale},select:{id:true,defaultLocale:true}});
      await tx.auditEvent.create({data:{organizationId,actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_ORGANIZATION_DEFAULT_LOCALE_CHANGED",targetType:"Organization",targetId:organizationId,metadata:{previous:previous.defaultLocale,current:locale}}});
      return {...updated,changed:true};
    },{isolationLevel:"Serializable"});
  }

  governance(req:HeaderRequest){
    requireInternalCapability(req,"security.read");
    return {roles:Object.entries(internalRoleCapabilities).map(([role,capabilities])=>({role,capabilities})),source:"server-role-capabilities"};
  }

  async createLegalVersion(req:HeaderRequest,documentId:string,body:unknown){
    const ctx=requireInternalCapability(req,"legal.manage");
    let input:ReturnType<typeof legalVersionInput>;
    try{input=legalVersionInput((body??{}) as any);}catch(e){throw new BadRequestException(e instanceof Error?e.message:"Invalid version");}
    const hash=createHash("sha256").update(input.content,"utf8").digest("hex");
    return this.db.$transaction(async tx=>{
      const document=await tx.legalDocument.findUnique({where:{id:documentId},select:{id:true,key:true}});
      if(!document)throw new NotFoundException("Legal document not found");
      const duplicate=await tx.legalDocumentVersion.findFirst({where:{documentId,version:input.version,locale:input.locale},select:{id:true}});
      if(duplicate)throw new ConflictException("Version and locale already exist");
      const created=await tx.legalDocumentVersion.create({data:{documentId,version:input.version,locale:input.locale,title:input.title,content:input.content,contentHash:hash,active:false},select:{id:true,documentId:true,locale:true,version:true,contentHash:true,active:true}});
      await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_LEGAL_VERSION_DRAFT_CREATED",targetType:"LegalDocumentVersion",targetId:created.id,metadata:{documentKey:document.key,version:created.version,locale:created.locale,contentHash:hash}}});
      return created;
    });
  }

  async publishLegalVersion(req:HeaderRequest,versionId:string,rawReason:unknown){
    const ctx=requireInternalCapability(req,"legal.publish"); // Platform Owner only: separation from Trust draft authors.
    let reason:string;
    try{reason=legalPublishReason(rawReason);}catch(e){throw new BadRequestException(e instanceof Error?e.message:"Invalid reason");}
    return this.db.$transaction(async tx=>{
      const target=await tx.legalDocumentVersion.findUnique({where:{id:versionId},include:{document:{select:{key:true}}}});
      if(!target)throw new NotFoundException("Legal version not found");
      if(target.active)return {id:target.id,active:true,changed:false};
      const previous=await tx.legalDocumentVersion.findMany({where:{documentId:target.documentId,locale:target.locale,active:true},select:{id:true,version:true,contentHash:true}});
      await tx.legalDocumentVersion.updateMany({where:{documentId:target.documentId,locale:target.locale,active:true},data:{active:false}});
      const result=await tx.legalDocumentVersion.update({where:{id:versionId},data:{active:true,effectiveAt:new Date()},select:{id:true,documentId:true,locale:true,version:true,contentHash:true,active:true,effectiveAt:true}});
      await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_LEGAL_VERSION_PUBLISHED",targetType:"LegalDocumentVersion",targetId:versionId,metadata:{documentKey:target.document.key,locale:result.locale,version:result.version,contentHash:result.contentHash,previous,reason}}});
      return {...result,changed:true};
    },{isolationLevel:"Serializable"});
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

  async reprocessAssessment(req:HeaderRequest,assessmentId:string) {
    const ctx=requireInternalCapability(req,"operations.manage");
    // Serialize concurrent requests for a single assessment, including different Control instances.
    const run=await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${assessmentId}))`;
      const assessment=await tx.assessment.findUnique({where:{id:assessmentId},select:{id:true,organizationId:true,status:true,launchedVersion:true,locale:true,minCohortSize:true}});
      if(!assessment)throw new NotFoundException("Assessment not found");
      if(!["CLOSED","ARCHIVED"].includes(assessment.status))throw new BadRequestException("Only closed assessments can be reprocessed");
      const inFlight=await tx.analysisRun.findFirst({where:{assessmentId,status:{in:["PENDING","RUNNING"]}},select:{id:true}});
      if(!canReprocessAssessment(assessment.status,Boolean(inFlight)))throw new ConflictException("Analysis already in progress");
      const version=assessment.launchedVersion?await tx.assessmentVersion.findUnique({where:{assessmentId_version:{assessmentId,version:assessment.launchedVersion}},select:{id:true}}):null;
      const created=await tx.analysisRun.create({data:{assessmentId,assessmentVersionId:version?.id??null,status:"PENDING",engineVersion:"analytics-local-0.1"}});
      await tx.outboxEvent.create({data:{type:"RUN_ANALYSIS",payload:{assessmentId,assessmentVersionId:version?.id??null,analysisRunId:created.id,locale:assessment.locale,minCohortSize:assessment.minCohortSize}}});
      await tx.auditEvent.create({data:{organizationId:assessment.organizationId,actorType:"INTERNAL",actorId:ctx.identity.email,action:"CONTROL_ANALYSIS_REPROCESS_REQUESTED",targetType:"Assessment",targetId:assessmentId,metadata:{analysisRunId:created.id,assessmentVersionId:version?.id??null}}});
      return {id:created.id};
    });
    return {ok:true,analysisRunId:run.id,status:"PENDING"};
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
