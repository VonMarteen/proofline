import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { requireCapability } from "../auth/access-control.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "../control/internal-access.js";

const DEFAULT_SLA_MS = 4 * 60 * 60_000;
const SLA_MS: Readonly<Record<string, number>> = { URGENT: 15 * 60_000, HIGH: 60 * 60_000, NORMAL: DEFAULT_SLA_MS, LOW: 24 * 60 * 60_000 };
const openStatuses = new Set(["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]);
const dueAtFor = (priority: string) => new Date(Date.now() + (SLA_MS[priority] ?? DEFAULT_SLA_MS));

@Injectable()
export class SupportService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async workspaceQueue(req: HeaderRequest) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const [tickets, changes] = await Promise.all([
      this.db.supportTicket.findMany({ where: { organizationId: ctx.organization.id }, include: { assignee: { select: { displayName: true } }, _count: { select: { messages: true } } }, orderBy: { updatedAt: "desc" } }),
      this.db.accountChangeRequest.findMany({ where: { organizationId: ctx.organization.id }, include: { supportTicket: { select: { subject: true, status: true } } }, orderBy: { createdAt: "desc" } }),
    ]);
    return { tickets, changes, canRequestAccountChange: ctx.capabilities.includes("account.change.request") };
  }
  async workspaceTicket(req: HeaderRequest, id: string) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const ticket = await this.db.supportTicket.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { assignee: { select: { displayName: true } }, messages: { where: { visibility: "CUSTOMER" }, include: { user: { select: { displayName: true } }, internalUser: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } }, accountChangeRequest: true } });
    if (!ticket) throw new NotFoundException("Support ticket not found"); return ticket;
  }
  async createWorkspaceTicket(req: HeaderRequest, input: { subject: string; description: string; category: string; priority: string }) {
    const ctx = await requireCapability(this.db, req, "support.use");
    if (!["TECHNICAL","BILLING","ACCESS","PRIVACY","SECURITY","FUNCTIONAL","OTHER"].includes(input.category)) throw new BadRequestException("Invalid support category");
    if (!["LOW","NORMAL","HIGH","URGENT"].includes(input.priority)) throw new BadRequestException("Invalid support priority");
    const ticket = await this.db.supportTicket.create({ data: { organizationId: ctx.organization.id, requesterUserId: ctx.user.id, subject: input.subject, description: input.description, category: input.category as any, priority: input.priority as any, slaDueAt: dueAtFor(input.priority), lastCustomerReplyAt: new Date(), messages: { create: { userId: ctx.user.id, visibility: "CUSTOMER", body: input.description } } } });
    await this.audit.record({ organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email, action: "SUPPORT_TICKET_CREATED", targetType: "SupportTicket", targetId: ticket.id, metadata: { category: input.category, priority: input.priority, slaDueAt: ticket.slaDueAt.toISOString() } });
    return ticket;
  }
  async addWorkspaceMessage(req: HeaderRequest, ticketId: string, body: string) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const ticket = await this.db.supportTicket.findFirst({ where: { id: ticketId, organizationId: ctx.organization.id } });
    if (!ticket) throw new NotFoundException("Support ticket not found"); if (ticket.status === "CLOSED") throw new BadRequestException("Closed tickets cannot receive new messages");
    const reopened = ticket.status === "RESOLVED" ? "OPEN" : ticket.status === "WAITING" ? "IN_PROGRESS" : ticket.status;
    await this.db.$transaction([this.db.supportMessage.create({ data: { ticketId, userId: ctx.user.id, visibility: "CUSTOMER", body } }), this.db.supportTicket.update({ where: { id: ticketId }, data: { lastCustomerReplyAt: new Date(), status: reopened as any } })]);
    await this.audit.record({ organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email, action: "SUPPORT_CUSTOMER_REPLIED", targetType: "SupportTicket", targetId: ticketId, metadata: {} }); return { ok: true };
  }
  async requestAccountChange(req: HeaderRequest, input: { type: string; summary: string; requestedData: Record<string, unknown> }) {
    const ctx = await requireCapability(this.db, req, "account.change.request");
    if (!["LEGAL_NAME","TAX_ID","BILLING_EMAIL","CONTRACT_OWNER","PRIMARY_OWNER","OTHER"].includes(input.type)) throw new BadRequestException("Invalid account change type");
    const ticket = await this.db.supportTicket.create({ data: { organizationId: ctx.organization.id, requesterUserId: ctx.user.id, subject: `Account change · ${input.type}`, description: input.summary, category: "ACCOUNT_CHANGE", priority: "NORMAL", slaDueAt: dueAtFor("NORMAL"), lastCustomerReplyAt: new Date(), messages: { create: { userId: ctx.user.id, visibility: "CUSTOMER", body: input.summary } } } });
    const change = await this.db.accountChangeRequest.create({ data: { organizationId: ctx.organization.id, requestedByUserId: ctx.user.id, supportTicketId: ticket.id, type: input.type as any, summary: input.summary, requestedData: input.requestedData as any } });
    await this.audit.record({ organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email, action: "ACCOUNT_CHANGE_REQUESTED", targetType: "AccountChangeRequest", targetId: change.id, metadata: { type: input.type, supportTicketId: ticket.id } }); return { ok: true, id: change.id, ticketId: ticket.id };
  }

  async internalQueue(req: HeaderRequest) {
    requireInternalCapability(req, "support.read"); const now = Date.now();
    const tickets = await this.db.supportTicket.findMany({ include: { organization: true, requester: { select: { displayName: true, email: true } }, assignee: { select: { id: true, displayName: true, email: true } }, accountChangeRequest: true, _count: { select: { messages: true } } }, orderBy: [{ status: "asc" }, { priority: "desc" }, { slaDueAt: "asc" }] });
    const rows = tickets.map(t => ({ ...t, sla: { overdue: openStatuses.has(t.status) && t.slaDueAt.getTime() < now, minutesRemaining: Math.round((t.slaDueAt.getTime() - now) / 60_000) } }));
    return {
      tickets: rows,
      metrics: {
        open: rows.filter(t => openStatuses.has(t.status)).length,
        unassigned: rows.filter(t => openStatuses.has(t.status) && !t.assignee).length,
        overdue: rows.filter(t => t.sla.overdue).length,
        resolved: rows.filter(t => ["RESOLVED","CLOSED"].includes(t.status)).length,
      },
    };
  }
  async internalTicket(req: HeaderRequest, id: string) {
    requireInternalCapability(req, "support.read");
    const [ticket, history] = await Promise.all([
      this.db.supportTicket.findUnique({ where: { id }, include: { organization: true, requester: { select: { displayName: true, email: true } }, assignee: { select: { id: true, displayName: true, email: true } }, messages: { include: { user: { select: { displayName: true } }, internalUser: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } }, accountChangeRequest: true } }),
      this.db.auditEvent.findMany({ where: { targetType: "SupportTicket", targetId: id }, orderBy: { createdAt: "asc" }, take: 200 }),
    ]);
    if (!ticket) throw new NotFoundException("Support ticket not found");
    return { ...ticket, history };
  }
  async assignToMe(req: HeaderRequest, ticketId: string) {
    const ctx = requireInternalCapability(req, "support.manage");
    const [ticket, agent] = await Promise.all([this.db.supportTicket.findUnique({ where: { id: ticketId } }), this.db.internalUser.findUnique({ where: { email: ctx.identity.email } })]);
    if (!ticket) throw new NotFoundException("Support ticket not found"); if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");
    const updated = await this.db.supportTicket.update({ where: { id: ticketId }, data: { assigneeInternalUserId: agent.id, assignedAt: new Date(), status: (["OPEN","ESCALATED"] as string[]).includes(ticket.status) ? "ASSIGNED" : ticket.status } });
    await this.audit.record({ organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "SUPPORT_TICKET_ASSIGNED", targetType: "SupportTicket", targetId: ticketId, metadata: { assignee: agent.email } }); return updated;
  }
  async updateStatus(req: HeaderRequest, ticketId: string, status: string) {
    const ctx = requireInternalCapability(req, "support.manage"); if (!["OPEN","ASSIGNED","IN_PROGRESS","WAITING","RESOLVED","ESCALATED","CLOSED"].includes(status)) throw new BadRequestException("Invalid ticket status");
    const ticket = await this.db.supportTicket.findUnique({ where: { id: ticketId } }); if (!ticket) throw new NotFoundException("Support ticket not found"); const now = new Date();
    const updated = await this.db.supportTicket.update({ where: { id: ticketId }, data: { status: status as any, resolvedAt: status === "RESOLVED" ? now : ticket.resolvedAt, closedAt: status === "CLOSED" ? now : ticket.closedAt } });
    await this.audit.record({ organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "CONTROL_SUPPORT_STATUS_CHANGED", targetType: "SupportTicket", targetId: ticketId, metadata: { from: ticket.status, to: status } }); return updated;
  }
  async addInternalMessage(req: HeaderRequest, ticketId: string, body: string, visibility: string) {
    const ctx = requireInternalCapability(req, "support.manage"); const [ticket, agent] = await Promise.all([this.db.supportTicket.findUnique({ where: { id: ticketId } }), this.db.internalUser.findUnique({ where: { email: ctx.identity.email } })]);
    if (!ticket) throw new NotFoundException("Support ticket not found"); if (!agent) throw new ForbiddenException("Internal support identity is not provisioned"); if (!body.trim()) throw new BadRequestException("Message is required");
    const safeVisibility = visibility === "INTERNAL" ? "INTERNAL" : "CUSTOMER";
    await this.db.$transaction([this.db.supportMessage.create({ data: { ticketId, internalUserId: agent.id, visibility: safeVisibility as any, body } }), this.db.supportTicket.update({ where: { id: ticketId }, data: { lastInternalReplyAt: new Date(), status: safeVisibility === "CUSTOMER" && ticket.status !== "CLOSED" ? "WAITING" : ticket.status } })]);
    await this.audit.record({ organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: safeVisibility === "CUSTOMER" ? "SUPPORT_AGENT_REPLIED" : "SUPPORT_INTERNAL_NOTE_ADDED", targetType: "SupportTicket", targetId: ticketId, metadata: {} }); return { ok: true };
  }
  async updateAccountChange(req: HeaderRequest, id: string, status: string, resolutionNote?: string) {
    const ctx = requireInternalCapability(req, "support.manage"); if (!["REQUESTED","IN_REVIEW","NEEDS_INFO","APPROVED","REJECTED","APPLIED"].includes(status)) throw new BadRequestException("Invalid account change status");
    if (status === "APPLIED") requireInternalCapability(req, "account.change.apply");
    const change = await this.db.accountChangeRequest.findUnique({ where: { id } }); if (!change) throw new NotFoundException("Account change request not found"); const now = new Date();
    if (status === "APPLIED") {
      const requested = change.requestedData && typeof change.requestedData === "object" && !Array.isArray(change.requestedData) ? change.requestedData as Record<string, unknown> : {};
      const value = String(requested.requestedValue ?? "").trim();
      if (["LEGAL_NAME","TAX_ID","BILLING_EMAIL","CONTRACT_OWNER","PRIMARY_OWNER"].includes(change.type) && !value) throw new BadRequestException("Requested value is required before applying this change");
      if (change.type === "LEGAL_NAME") await this.db.organization.update({ where: { id: change.organizationId }, data: { legalName: value } });
      if (change.type === "TAX_ID") await this.db.organization.update({ where: { id: change.organizationId }, data: { taxId: value } });
      if (change.type === "BILLING_EMAIL") await this.db.organization.update({ where: { id: change.organizationId }, data: { billingEmail: value.toLowerCase() } });
      if (change.type === "CONTRACT_OWNER") await this.db.organization.update({ where: { id: change.organizationId }, data: { contractOwnerEmail: value.toLowerCase() } });
      if (change.type === "PRIMARY_OWNER") {
        const target = await this.db.user.findUnique({ where: { email: value.toLowerCase() }, include: { memberships: true } });
        const membership = target?.memberships.find(m => m.organizationId === change.organizationId);
        if (!membership) throw new BadRequestException("The requested Owner must already be a member of the organization");
        await this.db.$transaction([
          this.db.membership.updateMany({ where: { organizationId: change.organizationId, role: "OWNER", id: { not: membership.id } }, data: { role: "ADMIN" } }),
          this.db.membership.update({ where: { id: membership.id }, data: { role: "OWNER" } }),
        ]);
      }
    }
    const updated = await this.db.accountChangeRequest.update({ where: { id }, data: { status: status as any, resolutionNote: resolutionNote?.trim() || null, reviewedBy: ctx.identity.email, reviewedAt: now, appliedAt: status === "APPLIED" ? now : change.appliedAt } });
    await this.audit.record({ organizationId: change.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "ACCOUNT_CHANGE_STATUS_CHANGED", targetType: "AccountChangeRequest", targetId: id, metadata: { from: change.status, to: status, applied: status === "APPLIED" } }); return updated;
  }
  async processSlaEscalations() {
    const due = await this.db.supportTicket.findMany({ where: { assigneeInternalUserId: null, status: "OPEN", slaDueAt: { lte: new Date() }, escalatedAt: null }, include: { organization: true } });
    if (!due.length) return { escalated: 0 };
    const recipients = await this.db.internalUser.findMany({ where: { status: "ACTIVE", role: { in: ["INTERNAL_SUPPORT","INTERNAL_OPERATIONS","INTERNAL_PLATFORM_OWNER"] } }, select: { email: true, role: true } });
    for (const ticket of due) {
      await this.db.$transaction(async tx => {
        await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "ESCALATED", escalatedAt: new Date() } });
        for (const recipient of recipients) await tx.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: { to: recipient.email, subject: `Proofline Support SLA · ${ticket.organization.name}`, text: `El ticket ${ticket.id} (${ticket.priority}) sigue sin adjudicar: ${ticket.subject}. Requiere atención.`, category: recipient.role === "INTERNAL_PLATFORM_OWNER" ? "support_sla_owner" : "support_sla_escalation" } } });
      });
      await this.audit.record({ organizationId: ticket.organizationId, actorType: "SYSTEM", actorId: "support-sla", action: "SUPPORT_TICKET_SLA_ESCALATED", targetType: "SupportTicket", targetId: ticket.id, metadata: { slaDueAt: ticket.slaDueAt.toISOString(), priority: ticket.priority } });
    }
    return { escalated: due.length };
  }
}
