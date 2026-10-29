/** Tenant-scoped usage ledger filters. Pure helper so validation can be exercised without DB. */
export function workspaceUsageWhere(organizationId: string, filters: {period?: string; eventType?: string; billable?: string}) {
  const period = filters.period || "";
  const eventType = filters.eventType || "";
  const billable = filters.billable || "";
  if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Invalid usage period");
  if (eventType && !/^[A-Z][A-Z0-9_]{0,63}$/.test(eventType)) throw new Error("Invalid usage event type");
  if (billable && billable !== "true" && billable !== "false") throw new Error("Invalid billable filter");
  return { organizationId, ...(period ? {periodKey:period} : {}), ...(eventType ? {eventType} : {}), ...(billable ? {billable:billable === "true"} : {}) };
}
