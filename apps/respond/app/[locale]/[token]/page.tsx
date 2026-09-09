import type { Metadata } from "next";
import { normalizeLocale } from "@proofline/i18n";
import { getAssessment } from "../../../lib/api";
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
  const data = await getAssessment(token, locale);

  if (!data) {
    return <div className="container" style={{ padding: 60 }}><h1>Invitation not found</h1><p className="muted">Use demo-token-2026 or reset the local environment.</p></div>;
  }
  return <RespondForm data={data} token={token} locale={locale} />;
}
