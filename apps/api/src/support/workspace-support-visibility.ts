/** Tenant-scoped access policy for Workspace support tickets.
 * Account/contract changes are visible only to roles with account.change.request.
 * Apply this WHERE clause to *all* customer-facing reads and mutations, including
 * nested attachment and document requests, to prevent direct-ID bypasses.
 */
export type WorkspaceSupportAccess = {
  organization: { id: string };
  capabilities: readonly string[];
};

export function canReadAccountChanges(ctx: WorkspaceSupportAccess): boolean {
  return ctx.capabilities.includes("account.change.request");
}

export function workspaceSupportTicketScope(ctx: WorkspaceSupportAccess) {
  const tenantScope = { organizationId: ctx.organization.id };
  if (canReadAccountChanges(ctx)) return tenantScope;
  // Guard both category and relation: protects historical or misclassified
  // tickets that are nevertheless linked to a contractual change.
  return {
    ...tenantScope,
    AND: [
      { category: { not: "ACCOUNT_CHANGE" as const } },
      { accountChangeRequest: { is: null } },
    ],
  };
}
