"use server";
import { revalidatePath } from "next/cache";
import { controlPost } from "../lib/api";

export async function updateTicketStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id || !status) return;
  await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/status`, { status });
  revalidatePath(`/${locale}/support`);
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
}

export async function releaseLegalHold(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id) return;
  await controlPost(`/v1/control/legal-holds/${encodeURIComponent(id)}/release`);
  revalidatePath(`/${locale}/privacy`);
  revalidatePath(`/${locale}/legal`);
}

export async function assignSupportTicket(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es");if(!id)return;await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/assign-me`);revalidatePath(`/${locale}/support`);revalidatePath(`/${locale}/support/${id}`)}
export async function addSupportMessage(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),body=String(formData.get("body")??""),visibility=String(formData.get("visibility")??"CUSTOMER");if(!id||!body.trim())return;await controlPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/messages`,{body,visibility});revalidatePath(`/${locale}/support/${id}`);revalidatePath(`/${locale}/support`)}
export async function updateAccountChangeStatus(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),status=String(formData.get("status")??""),resolutionNote=String(formData.get("resolutionNote")??"");if(!id||!status)return;await controlPost(`/v1/control/account-change-requests/${encodeURIComponent(id)}/status`,{status,resolutionNote});revalidatePath(`/${locale}/support`)}
export async function updateCommercialStage(formData: FormData) {const id=String(formData.get("id")??""),locale=String(formData.get("locale")??"es"),stage=String(formData.get("stage")??"");if(!id||!stage)return;await controlPost(`/v1/control/sales/${encodeURIComponent(id)}/stage`,{stage});revalidatePath(`/${locale}/sales`)}
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
