import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../lib/api";
import { DirectoryManager } from "../../../components/directory-manager";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; unit?: string; page?: string; pageSize?: string }>;
}) {
  const { locale: raw } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const qs = new URLSearchParams({
    page: query.page ?? "1",
    pageSize: query.pageSize ?? "25",
    ...(query.q ? { q: query.q } : {}),
    ...(query.unit && query.unit !== "ALL" ? { unitId: query.unit } : {}),
  });
  const data = await apiGet(`/v1/workspace/directory/table?${qs}`);

  return <div className="workspace-page">
    <section className="workspace-page-head">
      <div>
        <h1>{es ? "Personas y organización" : "People and organization"}</h1>
        <p>{es ? "Mantén una estructura reutilizable de áreas y personas para preparar poblaciones sin volver a cargar destinatarios en cada assessment." : "Maintain reusable people and units so populations can be prepared without reloading recipients for each assessment."}</p>
      </div>
      <div className="workspace-head-context">
        <span>{es ? "Personas activas" : "Active people"}</span>
        <strong>{data.totalActive}</strong>
      </div>
    </section>
    <DirectoryManager locale={locale} data={data} filters={{ q: query.q ?? "", unit: query.unit ?? "ALL" }} />
  </div>;
}
