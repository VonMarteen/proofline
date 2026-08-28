import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../lib/api";
import { BrandingEditor } from "../../../components/branding-editor";
import { workspaceIdentity } from "../../../lib/session";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const [identity, data] = await Promise.all([workspaceIdentity(), apiGet("/v1/workspace/branding")]);
  const allowed = identity.role === "OWNER";

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <div>
          <h1>{es ? "Identidad de la organización" : "Organization identity"}</h1>
          <p>{es
            ? "Define el logo visible de la organización y la paleta que se usa únicamente en los controles de respuesta de sus assessments. La interfaz de PROOFLINE conserva siempre su propio diseño."
            : "Define the organization logo and the palette used only in assessment response controls. The PROOFLINE interface always keeps its own design."}</p>
        </div>
        <div className="workspace-head-context"><span>{es ? "Organización" : "Organization"}</span><strong>{data.organization.name}</strong></div>
      </section>
      {allowed ? (
        <BrandingEditor locale={locale} initial={data} organizationName={data.organization.name} />
      ) : (
        <section className="workspace-section read-only-context">
          <h2>{es ? "Configuración protegida" : "Protected configuration"}</h2>
          <p>{es
            ? "Sólo el Owner de la organización (Super Admin) puede cambiar el logo y los colores corporativos. El resto de usuarios ve la identidad aplicada, pero no puede modificarla."
            : "Only the organization Owner (Super Admin) can change the logo and corporate colors. Other users can see the applied identity but cannot modify it."}</p>
        </section>
      )}
    </div>
  );
}
