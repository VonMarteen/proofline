/** Pure transition guards shared by Support and Control API actions. */
const accountChangeTransitions: Readonly<Record<string, readonly string[]>> = {
  REQUESTED: ["IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED"],
  IN_REVIEW: ["NEEDS_INFO", "APPROVED", "REJECTED"],
  NEEDS_INFO: ["IN_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: ["APPLIED", "NEEDS_INFO", "REJECTED"],
  REJECTED: [],
  APPLIED: [],
};
export function canTransitionAccountChange(from: string, to: string): boolean {
  return accountChangeTransitions[from]?.includes(to) ?? false;
}

const activeTicketStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"] as const;
export function canTransitionSupportTicket(from: string, to: string): boolean {
  if (from === "CLOSED") return to === "OPEN"; // reopening requires deliberate OPEN selection
  if (from === "RESOLVED") return to === "CLOSED" || to === "OPEN" || to === "IN_PROGRESS";
  if (!activeTicketStatuses.includes(from as (typeof activeTicketStatuses)[number])) return false;
  return [...activeTicketStatuses, "RESOLVED", "CLOSED"].includes(to);
}
