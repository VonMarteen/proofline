/** P5/7: Operational-only filters and aggregate summaries. No restricted response content. */
const assessmentStatuses = ["DRAFT", "PREPARATION", "REVIEW", "READY", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
const reportStatuses = ["DRAFT", "APPROVED", "DISTRIBUTED"] as const;
const reportKinds = ["EXECUTIVE", "FULL"] as const;
const deliveryStates = ["PENDING", "SENT", "FAILED", "NONE"] as const;
const origins = ["PROOFLINE", "VALIDATED", "PARTNER", "PRIVATE"] as const;
const visibilities = ["PUBLIC", "PRIVATE", "LICENSED"] as const;
const trim = (value?: string) => (value ?? "").trim().slice(0, 120);
const allowed = <T extends string>(value: string | undefined, set: readonly T[]): T | undefined =>
  set.find((item) => item === value);

export const assessmentFilters = (input: {q?:string;status?:string}) => ({
  q:trim(input.q),status:allowed(input.status,assessmentStatuses)
});
export const reportFilters = (input: {q?:string;status?:string;kind?:string;delivery?:string}) => ({
  q:trim(input.q), status:allowed(input.status,reportStatuses),kind:allowed(input.kind,reportKinds),delivery:allowed(input.delivery,deliveryStates)
});
export const frameworkFilters = (input: {q?:string;category?:string;origin?:string;visibility?:string;sort?:string}) => ({
  q:trim(input.q),category:trim(input.category),origin:allowed(input.origin,origins),visibility:allowed(input.visibility,visibilities),
  sort:allowed(input.sort,["category","nameDesc","recent"] as const)??"category"
});
export type ParticipantAggregate = {status:string; _count:{_all:number}};
export function participantProgress(rows: readonly ParticipantAggregate[]) {
  const counts = {invited:0,started:0,completed:0,revoked:0};
  for (const row of rows) {
    const count=row._count._all;
    if (!Number.isInteger(count)||count<0) throw new Error("Invalid participant aggregate");
    if (row.status==="INVITED") counts.invited+=count;
    else if(row.status==="STARTED") counts.started+=count;
    else if(row.status==="COMPLETED") counts.completed+=count;
    else if(row.status==="REVOKED") counts.revoked+=count;
  }
  const eligible=counts.invited+counts.started+counts.completed;
  return {...counts,eligible,completionPct:eligible?Math.round(counts.completed/eligible*100):null};
}
export type DeliveryAggregate = {status:string;_count:{_all:number}};
export function reportDeliveryTotals(rows:readonly DeliveryAggregate[]) {
  const counts={pending:0,sent:0,failed:0};
  for(const row of rows){
    const n=row._count._all;
    if(!Number.isInteger(n)||n<0)throw new Error("Invalid delivery aggregate");
    if(row.status==="PENDING")counts.pending+=n;
    else if(row.status==="SENT")counts.sent+=n;
    else if(row.status==="FAILED")counts.failed+=n;
  }
  return {...counts,total:counts.pending+counts.sent+counts.failed};
}
export function canReprocessAssessment(status:string,hasInFlightRun:boolean) {
  return (status==="CLOSED"||status==="ARCHIVED")&&!hasInFlightRun;
}
