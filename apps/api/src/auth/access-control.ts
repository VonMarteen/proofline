import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import { identityFrom, type HeaderRequest } from "./dev-auth.js";

export const roleCapabilities: Record<string, string[]> = {
  OWNER: ["workspace.read","organization.manage","branding.manage","team.manage","directory.manage","assessment.read","assessment.edit","assessment.delete","assessment.review","assessment.approve","population.prepare","results.read","reports.generate","reports.approve","reports.distribute","analysis.run","evidence.read","legal.manage","billing.view","billing.manage","billing.invoices","usage.view","support.use","account.change.request"],
  ADMIN: ["workspace.read","team.manage","directory.manage","assessment.read","assessment.edit","assessment.delete","population.prepare","results.read","reports.generate","analysis.run","evidence.read","legal.manage","support.use"],
  BILLING_ADMIN: ["workspace.read","billing.view","billing.manage","billing.invoices","usage.view","support.use","account.change.request"],
  ASSESSMENT_MANAGER: ["workspace.read","directory.manage","assessment.read","assessment.edit","assessment.delete","population.prepare","assessment.request_launch","usage.capacity_read","support.use"],
  REVIEWER: ["workspace.read","assessment.read","assessment.review","assessment.approve","results.read","reports.approve","support.use"],
  ANALYST: ["workspace.read","assessment.read","responses.aggregate_read","analysis.run","evidence.read","results.read","reports.generate","support.use"],
  VIEWER: ["workspace.read","assessment.read","results.authorized_read","support.use"],
  PARTNER_ADMIN: ["workspace.read","partner.clients_manage","partner.assessments_manage","support.use"],
};

const scopedRoles = new Set(["REVIEWER","ANALYST","VIEWER"]);

export async function accessContext(db: PrismaService, req: HeaderRequest) {
  const identity = identityFrom(req);
  const user = await db.user.findUnique({
    where: { email: identity.email },
    include: { memberships: { include: { organization: true } } },
  });
  const requestedOrganization = String(req.headers["x-proofline-organization"] ?? "");
  const membership = requestedOrganization ? user?.memberships.find(m => m.organizationId === requestedOrganization) : user?.memberships[0];
  if (!user || !membership) throw new NotFoundException("Workspace membership not found");
  return { identity, user, membership, organization: membership.organization, role: membership.role, capabilities: roleCapabilities[membership.role] ?? [] };
}

export async function requireCapability(db: PrismaService, req: HeaderRequest, capability: string, assessmentId?: string) {
  const ctx = await accessContext(db, req);
  if (!ctx.capabilities.includes(capability)) throw new ForbiddenException(`Capability required: ${capability}`);
  if (assessmentId) {
    const assessment = await db.assessment.findFirst({ where: { id: assessmentId, organizationId: ctx.organization.id } });
    if (!assessment) throw new NotFoundException("Assessment not found");
    if (scopedRoles.has(ctx.role)) {
      const grant = await db.assessmentAccess.findUnique({ where: { membershipId_assessmentId: { membershipId: ctx.membership.id, assessmentId } } });
      if (!grant) throw new ForbiddenException("Assessment access not granted");
    }
  }
  return ctx;
}

export async function permittedAssessmentIds(db: PrismaService, req: HeaderRequest) {
  const ctx = await accessContext(db, req);
  if (!ctx.capabilities.includes("assessment.read")) return { ctx, ids: [] as string[], unrestricted: false };
  if (!scopedRoles.has(ctx.role)) return { ctx, ids: [] as string[], unrestricted: true };
  const grants = await db.assessmentAccess.findMany({ where: { membershipId: ctx.membership.id, assessment: { organizationId: ctx.organization.id } }, select: { assessmentId: true } });
  return { ctx, ids: grants.map(g => g.assessmentId), unrestricted: false };
}

export async function requireAnyResultRead(db: PrismaService, req: HeaderRequest, assessmentId: string) {
  const ctx = await accessContext(db, req);
  const allowed = ctx.capabilities.includes("results.read") || ctx.capabilities.includes("results.authorized_read");
  if (!allowed) throw new ForbiddenException("Results access required");
  await requireCapability(db, req, "assessment.read", assessmentId);
  return ctx;
}
