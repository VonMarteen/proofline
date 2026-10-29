/** P4 operational input normalization; pure helpers used by the API and test suite. */
export type SupportFilterInput={q?:string;priority?:string;status?:string};
export type OperationsFilterInput={jobStatus?:string;jobType?:string;analysisStatus?:string};
export const supportPriorities=["URGENT","HIGH","NORMAL","LOW"] as const;
export const supportStatuses=["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED","RESOLVED","CLOSED"] as const;
export const jobStatuses=["PENDING","PROCESSING","FAILED","COMPLETED"] as const;
export const analysisStatuses=["PENDING","RUNNING","FAILED","COMPLETED"] as const;
function allow(value:string|undefined,options:readonly string[]){return value&&options.includes(value)?value:undefined}
export function supportFilters(input:SupportFilterInput){
  return {q:(input.q??"").trim().slice(0,120),priority:allow(input.priority,supportPriorities),status:allow(input.status,supportStatuses)};
}
export function operationsFilters(input:OperationsFilterInput){
  return {jobStatus:allow(input.jobStatus,jobStatuses),analysisStatus:allow(input.analysisStatus,analysisStatuses),jobType:(input.jobType??"").trim().slice(0,80)};
}
/** Exact accessible totals; preview truncation never affects the summary. */
export function operationalAlertTotals(counts:readonly number[]){
  if(counts.length!==6||counts.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error("Invalid alert counts");
  const[support,criticalSupport,failedJobs,pastDue,failedPayments,legalHolds]=counts as [number,number,number,number,number,number];
  if(criticalSupport>support)throw new Error("Critical support cannot exceed support total");
  return {count:support+failedJobs+pastDue+failedPayments+legalHolds,critical:criticalSupport+failedJobs+failedPayments};
}
