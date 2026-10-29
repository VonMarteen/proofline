export type ProoflineEmailPayload = Record<string, unknown> & {
  category?: string;
  subject?: string;
  text?: string;
  html?: string;
  locale?: string;
};

export type RenderedEmail = {
  category: string;
  templateId: string;
  templateVersion: string;
  family: string;
  subject: string;
  text: string;
  html: string;
};

type TemplateSpec = {
  id: string;
  version: string;
  family: "AUTH" | "ACCESS" | "ASSESSMENT" | "REPORTING" | "SUPPORT" | "COMMERCIAL" | "BILLING" | "SYSTEM";
  kickerEs: string;
  kickerEn: string;
  actionEs?: string;
  actionEn?: string;
};

const templates: Record<string, TemplateSpec> = {
  client_auth_otp: { id: "auth.client-otp", version: "2.0.0", family: "AUTH", kickerEs: "ACCESO · VERIFICACIÓN", kickerEn: "ACCESS · VERIFICATION" },
  internal_auth_otp: { id: "auth.internal-otp", version: "2.0.0", family: "AUTH", kickerEs: "CONTROL · VERIFICACIÓN", kickerEn: "CONTROL · VERIFICATION" },
  client_activation: { id: "access.client-activation", version: "1.0.0", family: "ACCESS", kickerEs: "ACCESO · ACTIVACIÓN", kickerEn: "ACCESS · ACTIVATION", actionEs: "Activar acceso", actionEn: "Activate access" },
  internal_activation: { id: "access.internal-activation", version: "1.0.0", family: "ACCESS", kickerEs: "CONTROL · ACTIVACIÓN", kickerEn: "CONTROL · ACTIVATION", actionEs: "Activar acceso", actionEn: "Activate access" },
  "participant-invite": { id: "assessment.participant-invite", version: "1.0.0", family: "ASSESSMENT", kickerEs: "ASSESSMENT · INVITACIÓN", kickerEn: "ASSESSMENT · INVITATION", actionEs: "Responder assessment", actionEn: "Open assessment" },
  "report-distribution": { id: "report.distribution", version: "1.0.0", family: "REPORTING", kickerEs: "RESULTADOS · INFORME", kickerEn: "RESULTS · REPORT" },
  support_customer_reply: { id: "support.customer-reply", version: "1.0.0", family: "SUPPORT", kickerEs: "SOPORTE · RESPUESTA", kickerEn: "SUPPORT · REPLY", actionEs: "Abrir ticket", actionEn: "Open ticket" },
  support_information_request: { id: "support.information-request", version: "1.0.0", family: "SUPPORT", kickerEs: "SOPORTE · ACCIÓN REQUERIDA", kickerEn: "SUPPORT · ACTION REQUIRED", actionEs: "Abrir ticket", actionEn: "Open ticket" },
  support_sla_owner: { id: "support.sla-owner", version: "1.0.0", family: "SUPPORT", kickerEs: "SOPORTE · SLA", kickerEn: "SUPPORT · SLA" },
  support_sla_escalation: { id: "support.sla-escalation", version: "1.0.0", family: "SUPPORT", kickerEs: "SOPORTE · SLA", kickerEn: "SUPPORT · SLA" },
  commercial_start: { id: "commercial.start-request", version: "1.0.0", family: "COMMERCIAL", kickerEs: "COMERCIAL · SOLICITUD", kickerEn: "COMMERCIAL · REQUEST" },
  commercial_demo: { id: "commercial.demo-request", version: "1.0.0", family: "COMMERCIAL", kickerEs: "COMERCIAL · DEMO", kickerEn: "COMMERCIAL · DEMO" },
  commercial_trial_converted: { id: "commercial.trial-converted", version: "1.0.0", family: "COMMERCIAL", kickerEs: "CUENTA · SERVICIO ACTIVO", kickerEn: "ACCOUNT · SERVICE ACTIVE" },
  billing_invoice: { id: "billing.invoice", version: "1.0.0", family: "BILLING", kickerEs: "FACTURACIÓN · FACTURA", kickerEn: "BILLING · INVOICE" },
  billing_payment_status: { id: "billing.payment-status", version: "1.0.0", family: "BILLING", kickerEs: "FACTURACIÓN · ESTADO", kickerEn: "BILLING · STATUS" },
  public_lead: { id: "commercial.public-lead", version: "1.0.0", family: "COMMERCIAL", kickerEs: "COMERCIAL · CONTACTO", kickerEn: "COMMERCIAL · CONTACT" },
};

const fallbackSpec: TemplateSpec = { id: "system.generic", version: "1.0.0", family: "SYSTEM", kickerEs: "PROOFLINE", kickerEn: "PROOFLINE" };
const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => htmlEscapes[ch] ?? ch);
const normalizeText = (value: unknown) => String(value ?? "").replace(/\r\n/g, "\n").trim();
const detectLocale = (payload: ProoflineEmailPayload, text: string) => {
  const explicit = String(payload.locale ?? "").toLowerCase();
  if (explicit === "en") return "en" as const;
  if (explicit === "es") return "es" as const;
  return /\b(hello|your|verification|open|report|request|sign-in|activate)\b/i.test(`${String(payload.subject ?? "")} ${text}`) ? "en" as const : "es" as const;
};
const firstUrl = (text: string) => text.match(/https?:\/\/[^\s<>]+/i)?.[0]?.replace(/[),.;]+$/, "") ?? null;
const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
const otpCode = (text: string) => text.match(/\b\d{6}\b/)?.[0] ?? "——";

function commonShell(input: { kicker: string; subject: string; text: string; actionUrl?: string | null; actionLabel?: string; otp?: string | null; locale: "es" | "en" }) {
  const safeKicker = escapeHtml(input.kicker), safeSubject = escapeHtml(input.subject);
  const body = paragraphs(input.text)
    .filter((part) => !input.actionUrl || !part.includes(input.actionUrl))
    .map((part) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#c8d0da">${escapeHtml(part).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const otp = input.otp ? `<div style="margin:22px 0 24px;padding:22px 18px;text-align:center;border-radius:16px;background:#0c151d;border:1px solid #24404a"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#61e9ce">${input.locale === "es" ? "Código de verificación" : "Verification code"}</div><div style="margin-top:10px;font-size:38px;font-weight:800;letter-spacing:.18em;color:#f4f8fb">${escapeHtml(input.otp)}</div></div>` : "";
  const action = input.actionUrl ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#f4f8fb;color:#0d141b;text-decoration:none;font-size:14px;font-weight:800;padding:12px 18px;border-radius:10px">${escapeHtml(input.actionLabel ?? (input.locale === "es" ? "Abrir PROOFLINE" : "Open PROOFLINE"))}</a></p>` : "";
  return `<!doctype html><html><head><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head><body style="margin:0;background:#0d141b;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f4f8fb"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d141b;padding:34px 14px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#141c24;border:1px solid #2a3944;border-radius:18px;overflow:hidden"><tr><td style="padding:26px 30px 17px;border-bottom:1px solid #2a3944"><div style="font-size:11px;letter-spacing:.16em;color:#27dec2;font-weight:800">${safeKicker}</div><div style="margin-top:7px;font-size:13px;color:#95a4b4">PROOFLINE · Signal · Structure · Impact</div></td></tr><tr><td style="padding:30px"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.25;color:#f4f8fb">${safeSubject}</h1>${otp}${body}${action}</td></tr><tr><td style="padding:17px 30px;border-top:1px solid #2a3944;font-size:11px;line-height:1.55;color:#748392">PROOFLINE · ARMAR TECHNOLOGIES<br/>${input.locale === "es" ? "Mensaje transaccional generado por el sistema." : "Transactional message generated by the system."}</td></tr></table></td></tr></table></body></html>`;
}

export function renderProoflineEmail(payload: ProoflineEmailPayload): RenderedEmail {
  const category = String(payload.category ?? "email");
  const spec = templates[category] ?? fallbackSpec;
  const subject = normalizeText(payload.subject) || "PROOFLINE";
  const originalText = normalizeText(payload.text);
  const locale = detectLocale(payload, originalText);
  const isOtp = category === "internal_auth_otp" || category === "client_auth_otp";
  const code = isOtp ? otpCode(originalText) : null;
  const url = isOtp ? null : firstUrl(originalText);
  const actionLabel = locale === "es" ? spec.actionEs : spec.actionEn;
  const text = isOtp
    ? (locale === "es"
      ? `PROOFLINE\n\nCódigo de verificación\n\n${code}\n\nCaduca en 10 minutos y sólo sirve para este intento.\nNo compartas este código con nadie.\n\nSi no has iniciado este acceso, ignora este mensaje.`
      : `PROOFLINE\n\nVerification code\n\n${code}\n\nIt expires in 10 minutes and is valid only for this attempt.\nDo not share this code with anyone.\n\nIf you did not initiate this sign-in, ignore this message.`)
    : originalText;
  const html = commonShell({
    kicker: locale === "es" ? spec.kickerEs : spec.kickerEn,
    subject,
    text,
    actionUrl: url,
    actionLabel,
    otp: code,
    locale,
  });
  return { category, templateId: spec.id, templateVersion: spec.version, family: spec.family, subject, text, html };
}

export function emailTemplateCatalog() {
  return Object.entries(templates).map(([category, spec]) => ({ category, ...spec }));
}
