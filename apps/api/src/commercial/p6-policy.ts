/** Commercial P6 contract: auditable stages, safe public search and bounded filters. */
export const COMMERCIAL_STAGES = ["NEW","QUALIFIED","DEMO_SCHEDULED","EVALUATION","PROPOSAL","CONTRACT_PENDING","WON","LOST","PROVISIONED"] as const;
export const COMMERCIAL_MODES = ["DEMO","START"] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

export function salesFilters(input:{q?:string;stage?:string;mode?:string;planCode?:string}) {
  const q=(input.q??"").trim().slice(0,120);
  return {
    q,
    stage:COMMERCIAL_STAGES.includes(input.stage as CommercialStage)?input.stage:undefined,
    mode:COMMERCIAL_MODES.includes(input.mode as (typeof COMMERCIAL_MODES)[number])?input.mode:undefined,
    planCode:(input.planCode??"").trim().slice(0,80)||undefined,
  };
}
/** EVALUATION and PROVISIONED can only be entered by provisioning, never by selecting a status. */
export function canChangeCommercialStage(from:string,to:string,hasWorkspace:boolean) {
  if (!COMMERCIAL_STAGES.includes(to as CommercialStage)) return false;
  if (from==="PROVISIONED" || from==="LOST") return false;
  if (to===from) return true;
  if (to==="PROVISIONED" || to==="EVALUATION") return false;
  if (from==="EVALUATION" && !hasWorkspace) return false;
  if (from==="EVALUATION" && !["PROPOSAL","CONTRACT_PENDING","WON","LOST"].includes(to)) return false;
  return true;
}
export function requiresLossReason(stage:string,reason?:string) {
  return stage==="LOST" && (!reason?.trim() || reason.trim().length<5);
}
/** Provider setup is not a successful charge. Offline providers have no verified payment channel. */
export function commercialPaymentEvidence(provider:string,status:string,bankReference?:string) {
  if (status==="READY") return true;
  if (status!=="VERIFIED") return false;
  return provider==="BANK_TRANSFER" && Boolean(bankReference?.trim());
}
export function canProvisionPaid(stage:string,provider:string|null,status:string,terms:number|null|undefined) {
  // A bank-transfer contract with explicit net terms can start without pretending a charge has settled.
  // Redsys and PayPal remain disconnected until verified provider adapters exist.
  return stage==="WON" && provider==="BANK_TRANSFER" && ["READY","VERIFIED"].includes(status) && [15,30,60].includes(Number(terms));
}
export function validatePlanClone(input:{code:string;name:string;monthlyAmountCents:number}) {
  const code=input.code.trim().toUpperCase(),name=input.name.trim();
  if(!/^[A-Z][A-Z0-9_-]{2,39}$/.test(code)) throw new Error("Plan code must be 3-40 uppercase letters, digits, dash or underscore");
  if(name.length<3||name.length>100)throw new Error("Plan name must have 3-100 characters");
  if(!Number.isSafeInteger(input.monthlyAmountCents)||input.monthlyAmountCents<0||input.monthlyAmountCents>10_000_000)throw new Error("Invalid monthly plan amount in cents");
  return {code,name,monthlyAmountCents:input.monthlyAmountCents};
}
