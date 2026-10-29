import { emailTemplateCatalog, renderProoflineEmail } from "./email-templates.js";

const sample = renderProoflineEmail({ category: "participant-invite", subject: "PROOFLINE · Pilot", text: "Completa tu assessment:\nhttp://localhost:4203/es/token" });
if (!sample.html.includes("http://localhost:4203/es/token")) throw new Error("Invite CTA URL missing from HTML template");
if (!sample.text.includes("http://localhost:4203/es/token")) throw new Error("Plain-text invite URL missing");
if (!sample.templateVersion) throw new Error("Template version missing");
const otp = renderProoflineEmail({ category: "client_auth_otp", subject: "Proofline · código de acceso", text: "Tu código de verificación de Proofline es 123456. Caduca en 10 minutos." });
if (!otp.html.includes("123456") || !otp.text.includes("123456")) throw new Error("OTP template did not preserve code");
if (!otp.html.includes("PROOFLINE") || !otp.text.startsWith("PROOFLINE")) throw new Error("Branding missing");
const report = renderProoflineEmail({ category: "report-distribution", subject: "Proofline · ACME · Report", text: "Informe aprobado y trazable." });
if (!report.html || !report.text) throw new Error("Report template must provide HTML and plain text");
const catalog = emailTemplateCatalog();
if (catalog.length < 10) throw new Error("Email catalog is incomplete");
console.log(`[OK] PROOFLINE email templates · categories=${catalog.length} · html+text=ready · versioned=true`);
