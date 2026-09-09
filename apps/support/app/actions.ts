"use server";
import { revalidatePath } from "next/cache";
import { supportPost } from "../lib/api";

export async function assignSupportTicket(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  if (!id) return;
  await supportPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/assign-me`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/tickets/${id}`);
}

export async function updateTicketStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;
  await supportPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/status`, { status });
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/tickets/${id}`);
  revalidatePath(`/${locale}/history`);
}

export async function addSupportMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  const body = String(formData.get("body") ?? "");
  const visibility = String(formData.get("visibility") ?? "CUSTOMER");
  if (!id || !body.trim()) return;
  await supportPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/messages`, { body, visibility });
  revalidatePath(`/${locale}/tickets/${id}`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/history`);
}

export async function requestSupportInformation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  const body = String(formData.get("body") ?? "");
  const requestDocument = String(formData.get("requestDocument") ?? "") === "on";
  if (!id || !body.trim()) return;
  await supportPost(`/v1/control/support/tickets/${encodeURIComponent(id)}/request-information`, { body, requestDocument });
  revalidatePath(`/${locale}/tickets/${id}`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/history`);
}

export async function updateAccountChangeStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const locale = String(formData.get("locale") ?? "es");
  const status = String(formData.get("status") ?? "");
  const resolutionNote = String(formData.get("resolutionNote") ?? "");
  const requestDocument = String(formData.get("requestDocument") ?? "") === "on";
  if (!id || !status) return;
  await supportPost(`/v1/control/account-change-requests/${encodeURIComponent(id)}/status`, { status, resolutionNote, requestDocument });
  if (ticketId) revalidatePath(`/${locale}/tickets/${ticketId}`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/history`);
}
