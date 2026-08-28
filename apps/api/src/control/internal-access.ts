import { ForbiddenException } from "@nestjs/common";
import { identityFrom, type HeaderRequest } from "../auth/dev-auth.js";

export const internalRoleCapabilities: Record<string, string[]> = {
  INTERNAL_PLATFORM_OWNER: ["*"],
  INTERNAL_OPERATIONS: ["control.overview","organizations.read","users.read","assessments.read","reports.read","support.read","support.manage","sales.read","sales.manage","communications.read","operations.read","operations.manage","audit.read","marketplace.read","security.read"],
  INTERNAL_FINANCE: ["control.overview","organizations.read","billing.read","usage.read","sales.read","audit.read"],
  INTERNAL_TRUST: ["control.overview","organizations.read","users.read","support.read","legal.read","privacy.read","security.read","audit.read","legal.manage"],
  INTERNAL_SUPPORT: ["support.read","support.manage"],
  INTERNAL_ANALYST: ["control.overview","organizations.read","assessments.read","reports.read","usage.read","marketplace.read"],
};

export function internalContext(req: HeaderRequest) {
  const identity = identityFrom(req);
  const capabilities = internalRoleCapabilities[identity.role] ?? [];
  return { identity, capabilities };
}

export function requireInternalCapability(req: HeaderRequest, capability: string) {
  const ctx = internalContext(req);
  if (!ctx.capabilities.includes("*") && !ctx.capabilities.includes(capability)) {
    throw new ForbiddenException(`Internal capability required: ${capability}`);
  }
  return ctx;
}
