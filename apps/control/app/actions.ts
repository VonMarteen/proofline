"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { controlPost } from "../lib/api";

export async function updateTicketStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id || !status) return;
  await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/status`, { status });
  revalidatePath(`/${locale}/support`);
  revalidatePath(`/${locale}/support/${id}`);
  revalidatePath(`/${locale}/support/history`);
  revalidatePath(`/${locale}/notifications`);
}

export async function reprocessAssessment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id) return;
  await controlPost(`/v1/control/assessments/${encodeURIComponent(id)}/reprocess`);
  revalidatePath(`/${locale}/assessments`);
  revalidatePath(`/${locale}/operations`);
}

export async function retryJob(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id) return;
  await controlPost(`/v1/control/operations/jobs/${encodeURIComponent(id)}/retry`);
  revalidatePath(`/${locale}/operations`);
  revalidatePath(`/${locale}/system`);
  revalidatePath(`/${locale}/notifications`);
}

export async function releaseLegalHold(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id) return;
  await controlPost(`/v1/control/legal-holds/${encodeURIComponent(id)}/release`);
  revalidatePath(`/${locale}/privacy`);
  revalidatePath(`/${locale}/legal`);
}

export async function executeRetentionLifecycle(formData: FormData) {
  const locale=String(formData.get("locale")??"es"),organizationId=String(formData.get("organizationId")??"")||undefined,assessmentId=String(formData.get("assessmentId")??"")||undefined;
  await controlPost(`/v1/control/retention/execute`,{organizationId,assessmentId,limit:200,confirm:"EXECUTE_RETENTION"});
  revalidatePath(`/${locale}/legal`);
  revalidatePath(`/${locale}/privacy`);
}

export async function updateRetentionPolicy(formData: FormData) {
  const locale=String(formData.get("locale")??"es"),id=String(formData.get("id")??""),durationDays=Number(formData.get("durationDays")??0),action=String(formData.get("action")??""),legalBasis=String(formData.get("legalBasis")??"");
  if(!id||!durationDays||!action||!legalBasis.trim())return;
  await controlPost(`/v1/control/retention/policies`,{id,durationDays,action,legalBasis});
  revalidatePath(`/${locale}/legal`);
}

export async function createLegalHold(formData: FormData) {
  const locale=String(formData.get("locale")??"es"),organizationId=String(formData.get("organizationId")??""),assessmentId=String(formData.get("assessmentId")??"")||undefined,scope=String(formData.get("scope")??"ALL"),reason=String(formData.get("reason")??"");
  if(!organizationId||!reason.trim())return;
  await controlPost(`/v1/control/legal-holds`,{organizationId,assessmentId,scope,reason});
  revalidatePath(`/${locale}/legal`);
  revalidatePath(`/${locale}/privacy`);
}

export async function assignSupportTicket(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es");if(!id)return;await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/assign-me`);revalidatePath(`/${locale}/support`);revalidatePath(`/${locale}/support/${id}`)}
export async function addSupportMessage(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),body=String(formData.get("body")??""),visibility=String(formData.get("visibility")??"CUSTOMER");if(!id||!body.trim())return;await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/messages`,{body,visibility});revalidatePath(`/${locale}/support/${id}`);revalidatePath(`/${locale}/support`)}
export async function requestSupportInformation(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),body=String(formData.get("body")??""),requestDocument=String(formData.get("requestDocument")??"")==="on";if(!id||!body.trim())return;await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/request-information`,{body,requestDocument});revalidatePath(`/${locale}/support/${id}`);revalidatePath(`/${locale}/support`)}
export async function updateAccountChangeStatus(formData: FormData) {const id=String(formData.get("id")??""),ticketId=String(formData.get("ticketId")??""),locale=String(formData.get("locale")??"es"),status=String(formData.get("status")??""),resolutionNote=String(formData.get("resolutionNote")??""),requestDocument=String(formData.get("requestDocument")??"")==="on";if(!id||!status)return;await controlPost(`/v1/control/account-change-requests/${encodeURIComponent(id)}/status`,{status,resolutionNote,requestDocument});revalidatePath(`/${locale}/support`);if(ticketId)revalidatePath(`/${locale}/support/${ticketId}`)}
export async function updateCommercialStage(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),stage=String(formData.get("stage")??"");if(!id||!stage)return;await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/stage`,{stage,lostReason:String(formData.get("lostReason")??"")||undefined});revalidatePath(`/${locale}/sales`)}
export async function createEvaluationWorkspace(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es");if(!id)return;await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/evaluation`);revalidatePath(`/${locale}/sales`);revalidatePath(`/${locale}/organizations`)}
export async function provisionCustomer(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es");if(!id)return;await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/provision`);revalidatePath(`/${locale}/sales`);revalidatePath(`/${locale}/organizations`)}
export async function createInternalUser(formData: FormData) {const locale=String(formData.get("locale")??"es"),email=String(formData.get("email")??""),displayName=String(formData.get("displayName")??""),role=String(formData.get("role")??"");if(!email||!displayName||!role)return;await controlPost(`/v1/control/internal-users`,{email,displayName,role});revalidatePath(`/${locale}/security`)}

export async function configureCommercialPayment(formData: FormData) {
  const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),provider=String(formData.get("provider")??""),status=String(formData.get("paymentStatus")??"READY"),maskedLabel=String(formData.get("maskedLabel")??""),brand=String(formData.get("brand")??""),last4=String(formData.get("last4")??""),paymentTermsDays=Number(formData.get("paymentTermsDays")??0)||0;
  if(!id||!provider)return;
  await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/payment-setup`,{provider,status,maskedLabel:maskedLabel||undefined,brand:brand||undefined,last4:last4||undefined,paymentTermsDays});
  revalidatePath(`/${locale}/sales`);
}
export async function activatePaymentMethod(formData: FormData) {
  const organizationId=String(formData.get("organizationId")??""),methodId=String(formData.get("methodId")??""),locale=String(formData.get("locale")??"es");
  if(!organizationId||!methodId)return;
  await controlPost(`/v1/control/organizations/${encodeURIComponent(organizationId)}/payment-methods/${encodeURIComponent(methodId)}/activate`);
  revalidatePath(`/${locale}/organizations/${organizationId}`);revalidatePath(`/${locale}/billing`);
}
export async function recordPaymentTransaction(formData: FormData) {
  const organizationId=String(formData.get("organizationId")??""),locale=String(formData.get("locale")??"es"),provider=String(formData.get("provider")??"BANK_TRANSFER"),kind=String(formData.get("kind")??"TRANSFER"),status=String(formData.get("status")??"RECONCILED"),paymentMethodId=String(formData.get("paymentMethodId")??"")||undefined,amountCents=Math.round(Number(formData.get("amount")??0)*100),bankReference=String(formData.get("bankReference")??"")||undefined,externalReference=String(formData.get("externalReference")??"")||undefined;
  if(!organizationId||!Number.isInteger(amountCents)||amountCents<0)return;
  await controlPost(`/v1/control/organizations/${encodeURIComponent(organizationId)}/payment-transactions`,{provider,kind,status,paymentMethodId,amountCents,currency:"EUR",bankReference,externalReference});
  revalidatePath(`/${locale}/organizations/${organizationId}`);revalidatePath(`/${locale}/billing`);
}

// P6: auditable plan selection prior to commercial provisioning.
export async function selectCommercialPlan(formData: FormData) {
  const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),planCode=String(formData.get("planCode")??"");
  if(!id||!planCode)return;
  await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/plan`,{planCode});
  revalidatePath(`/${locale}/sales`);
}
// P6: create new plan from a known entitlement template; existing subscription prices remain unchanged.
export async function cloneCommercialPlan(formData:FormData) {
  const locale=String(formData.get("locale")??"es"),sourceCode=String(formData.get("sourceCode")??""),code=String(formData.get("code")??""),name=String(formData.get("name")??"");
  const amount=Number(formData.get("monthlyAmount")??NaN);
  if(!sourceCode||!code||!name||!Number.isFinite(amount))return;
  await controlPost("/v1/control/plans/clone",{sourceCode,code,name,monthlyAmountCents:Math.round(amount*100)});
  revalidatePath(`/${locale}/plans`);
  revalidatePath(`/${locale}/sales`);
}

// P7: changes are handled by Control API under server-derived RBAC and transactional audit.
export async function updateOrganizationDefaultLocale(formData:FormData){
  const locale=String(formData.get("locale")??"es"),id=String(formData.get("organizationId")??""),value=String(formData.get("defaultLocale")??"");
  if(!id||!["es","en"].includes(value))return;
  await controlPost(`/v1/control/configuration/organizations/${encodeURIComponent(id)}/locale`,{locale:value});
  revalidatePath(`/${locale}/configuration`);
  revalidatePath(`/${locale}/organizations/${id}`);
}
export async function createLegalDocumentDraft(formData:FormData){
  const locale=String(formData.get("locale")??"es"),id=String(formData.get("documentId")??"");
  if(!id)return;
  await controlPost(`/v1/control/legal/documents/${encodeURIComponent(id)}/versions`,{
    version:String(formData.get("version")??""),locale:String(formData.get("documentLocale")??""),
    title:String(formData.get("title")??""),content:String(formData.get("content")??"")});
  revalidatePath(`/${locale}/legal`);
}
export async function publishLegalDocumentVersion(formData:FormData){
  const locale=String(formData.get("locale")??"es"),id=String(formData.get("versionId")??"");
  if(!id)return;
  await controlPost(`/v1/control/legal/versions/${encodeURIComponent(id)}/publish`,{reason:String(formData.get("reason")??"")});
  revalidatePath(`/${locale}/legal`);
}

// CQF-F1: authorized writes; errors surface through the existing server-action boundary.
export async function updateFrameworkMetadata(formData:FormData){
 const locale=String(formData.get("locale")??"es"),id=String(formData.get("id")??"");
 if(!id)throw new Error("Framework ID is required");
 await controlPost(`/v1/control/marketplace/${encodeURIComponent(id)}/metadata`,{
   description:String(formData.get("description")??""),category:String(formData.get("category")??"")
 });
 revalidatePath(`/${locale}/marketplace`);revalidatePath(`/${locale}/marketplace/${id}`);
}
export async function updateInternalRole(formData:FormData){
 const locale=String(formData.get("locale")??"es"),id=String(formData.get("id")??"");
 if(!id)throw new Error("User ID is required");
 await controlPost(`/v1/control/internal-users/${encodeURIComponent(id)}/role`,{role:String(formData.get("role")??"")});
 revalidatePath(`/${locale}/security`);revalidatePath(`/${locale}/internal-users`);
}

/** CQF-F2: explicit admin intake, no public lead and no fabricated consent. */
export async function createInternalOpportunity(formData:FormData){
 const locale=String(formData.get("locale")??"es")==="en"?"en":"es";
 const estimatedText=String(formData.get("estimatedParticipants")??"").trim();
 const response=await controlPost("/v1/control/sales/internal",{
  mode:String(formData.get("mode")??"DEMO"),name:String(formData.get("name")??""),
  email:String(formData.get("email")??""),company:String(formData.get("company")??""),
  country:String(formData.get("country")??"")||undefined,
  estimatedParticipants:estimatedText?Number(estimatedText):undefined,
  planCode:String(formData.get("planCode")??"")||undefined,
  useCase:String(formData.get("useCase")??"")||undefined,locale
 });
 if(!response?.ok||!response.id)throw new Error("Opportunity could not be created");
 revalidatePath(`/${locale}/sales`);
 redirect(`/${locale}/sales?q=${encodeURIComponent(String(response.id))}`);
}
