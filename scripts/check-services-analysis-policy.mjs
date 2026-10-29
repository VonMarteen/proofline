/** Health smoke policy: never enqueue scoring for open assessments. */
const ELIGIBLE_STATES = new Set(["CLOSED", "ARCHIVED"]);
const PENDING_RUN_STATES = new Set(["PENDING", "PROCESSING", "RUNNING"]);
export function chooseAnalysisCandidate(assessments) {
  if (!Array.isArray(assessments)) return null;
  return assessments.find(item => item?.id && ELIGIBLE_STATES.has(item.status)) ?? null;
}
export function isAnalysisPending(latest) {
  return Boolean(latest && PENDING_RUN_STATES.has(latest.status));
}
