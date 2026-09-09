import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { AppShell } from "../../components/app-shell";
import { apiGet } from "../../lib/api";
import { workspaceIdentity } from "../../lib/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  normalizeLocale(raw);
  const cookieStore = await cookies();
  if (!cookieStore.get("proofline_workspace_session")?.value) return { title: "PROOFLINE" };

  const [branding, dashboard] = await Promise.all([
    apiGet("/v1/workspace/branding").catch(() => null),
    apiGet(`/v1/dashboard?locale=${normalizeLocale(raw)}`).catch(() => null),
  ]);
  const organization = branding?.organization ?? dashboard?.organization;
  const organizationName = typeof organization?.name === "string" ? organization.name.trim() : "";

  return { title: organizationName ? `${organizationName} — PROOFLINE` : "PROOFLINE" };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const cookieStore = await cookies();
  if (!cookieStore.get("proofline_workspace_session")?.value) redirect(`/login?locale=${locale}`);

  const identity = await workspaceIdentity();
  const [branding, dashboard] = await Promise.all([
    apiGet("/v1/workspace/branding").catch(() => null),
    apiGet(`/v1/dashboard?locale=${locale}`).catch(() => null),
  ]);
  const organization = branding?.organization ?? dashboard?.organization ?? { id: "unknown", name: "PROOFLINE" };

  return (
    <AppShell locale={locale} identity={identity} organization={{ id: organization.id, name: organization.name, logo: branding?.logo ?? null }}>
      {children}
    </AppShell>
  );
}
