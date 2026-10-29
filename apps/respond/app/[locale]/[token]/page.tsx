import type { Metadata } from "next";
import { normalizeLocale } from "@proofline/i18n";
import { getAssessment, getAssessmentResult } from "../../../lib/api";
import { RespondForm } from "../../../components/respond-form";

type RespondRouteProps = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: RespondRouteProps): Promise<Metadata> {
  const { locale: raw, token } = await params;
  const locale = normalizeLocale(raw);
  const data = await getAssessment(token, locale);
  if (!data) return { title: "PROOFLINE" };

  const organizationName = typeof data.organization?.name === "string" ? data.organization.name.trim() : "";
  const assessmentTitle = typeof data.title === "string" ? data.title.trim() : "";
  const context = [organizationName, assessmentTitle].filter(Boolean).join(" · ");

  return { title: context ? `${context} — PROOFLINE` : "PROOFLINE" };
}

export default async function Page({ params }: RespondRouteProps) {
  const { locale: raw, token } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const result = await getAssessmentResult(token, locale);

  if (!result.ok) {
    const expired = result.status === 410;
    const unavailable = result.status >= 500;
    const title = expired
      ? (es ? "Esta invitación ha caducado" : "This invitation has expired")
      : unavailable
        ? (es ? "No podemos cargar el assessment ahora" : "We cannot load the assessment right now")
        : (es ? "Invitación no disponible" : "Invitation unavailable");
    const description = expired
      ? (es ? "El plazo para responder ha finalizado. Contacta con la organización que te envió la invitación si necesitas una nueva." : "The response period has ended. Contact the organization that sent the invitation if you need a new one.")
      : unavailable
        ? (es ? "El servicio de respuesta no está disponible temporalmente. Vuelve a intentarlo sin cerrar esta invitación." : "The response service is temporarily unavailable. Please try again without discarding this invitation.")
        : (es ? "El enlace no existe, fue revocado o ya no está disponible." : "The link does not exist, was revoked, or is no longer available.");
    return <main className="respond-complete"><section><h1>{title}</h1><p>{description}</p></section></main>;
  }

  return <RespondForm data={result.data} token={token} locale={locale} />;
}
