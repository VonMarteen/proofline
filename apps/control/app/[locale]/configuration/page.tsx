import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../lib/api";
import { PageIntro, Panel, eur } from "../../../components/control-ui";
import { updateOrganizationDefaultLocale } from "../../actions";

export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string}>}){
  const {locale:raw}=await params;
  const locale=normalizeLocale(raw),es=locale==="es";
  const sp=await searchParams,q=(sp.q??"").trim().slice(0,80);
  const d=await controlGet(`/v1/control/configuration?view=ui&q=${encodeURIComponent(q)}`);
  const policy=d.brandingPolicy??{textContrastMinimum:4.5,maxLogoBytes:1024*1024};
  return <div className="control-stack">
    <PageIntro title={es?"Configuración operativa":"Operational configuration"} text={es?"Ajustes persistentes por organización y estándares de plataforma verificados. Los límites técnicos no son interruptores editables.":"Persistent per-organization settings and verified platform standards. Technical limits are not editable switches."}/>
    <Panel title={es?"Idioma predeterminado por organización":"Organization default language"}>
      <p className="control-note">{es?"El idioma guardado se utiliza en la emisión de documentos de facturación de la organización. No cambia las preferencias individuales de los usuarios ni los idiomas del assessment.":"The saved locale is used for the organization's invoice documents. It does not override individual preferences or assessment languages."}</p>
      <form className="bo-filter-form" data-proofline-no-confirm="true" method="get">
        <label htmlFor="configuration-search" className="control-sr-only">{es?"Buscar organización":"Search organization"}</label>
        <input id="configuration-search" name="q" maxLength={80} placeholder={es?"Buscar organización o slug…":"Search organization or slug…"} defaultValue={q}/>
        <button className="control-button secondary" type="submit">{es?"Buscar":"Search"}</button>
      </form>
      <p className="control-note">{es?`Mostrando ${d.organizations.length} de ${d.organizationTotal} organizaciones coincidentes (máximo 50).`:`Showing ${d.organizations.length} of ${d.organizationTotal} matching organizations (max 50).`}</p>
      <div className="control-config-organizations">
        {d.organizations.length?d.organizations.map((o:any)=><form className="control-config-org" key={o.id} action={updateOrganizationDefaultLocale} data-confirm-title={es?"Cambiar idioma contractual":"Change billing locale"} data-confirm-message={es?`Los documentos de facturación posteriores de ${o.name} utilizarán el nuevo idioma predeterminado.`:`Future invoice documents for ${o.name} will use the new default locale.`}>
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={o.id}/>
          <div><strong>{o.name}</strong><span>{o.slug}</span></div>
          <label><span>{es?"Idioma predeterminado":"Default locale"}</span><select className="control-select" name="defaultLocale" defaultValue={o.defaultLocale}><option value="es">Español</option><option value="en">English</option></select></label>
          <button className="control-button secondary" type="submit">{es?"Guardar":"Save"}</button>
        </form>):<p className="control-empty">{es?"No hay organizaciones coincidentes.":"No matching organizations."}</p>}
      </div>
    </Panel>
    <div className="control-grid-2">
      <Panel title={es?"Estándares de plataforma (solo lectura)":"Platform standards (read-only)"}>
        <div className="control-list compact">{Object.entries(d.defaults).map(([k,v])=><div key={k}><strong>{k}</strong><span>{String(v)}</span></div>)}</div>
        <p className="control-note">{es?"Constantes técnicas y políticas de seguridad. Se modifican únicamente mediante código, revisión y despliegue controlado.":"Technical and security constants. Changes require code review and controlled deployment."}</p>
      </Panel>
      <Panel title={es?"Idiomas admitidos":"Supported locales"}><div className="control-list compact">{d.locales.map((l:string)=><div key={l}><strong>{l.toUpperCase()}</strong><span>{l==="es"?"Español":"English"}</span></div>)}</div></Panel>
    </div>
    <Panel title={es?"Política de identidad visual":"Visual identity policy"}>
      <div className="control-policy-grid"><div><strong>{es?"Contraste mínimo":"Minimum contrast"}</strong><span>{policy.textContrastMinimum}:1</span><small>{es?"Validación de colores de respuesta.":"Assessment answer colour validation."}</small></div><div><strong>{es?"Alcance del color":"Colour scope"}</strong><span>{es?"Controles del assessment":"Assessment controls"}</span><small>{es?"La identidad del cliente no modifica el backoffice.":"Tenant identity does not recolour Backoffice."}</small></div><div><strong>Logo</strong><span>{Math.round(policy.maxLogoBytes/1024/1024)} MB</span><small>PNG · JPG · WebP</small></div></div>
    </Panel>
    <Panel title={es?"Catálogo comercial vigente (solo lectura)":"Current commercial catalogue (read-only)"}>
      <div className="control-list">{d.plans.map((p:any)=><div key={p.id}><div><strong>{p.name}</strong><span>{p.code}</span></div><strong>{eur(p.monthlyAmountCents,locale)}</strong></div>)}</div>
      <p className="control-note">{es?"La administración de planes y capacidades se realiza desde Planes, no aquí.":"Plans and entitlements are managed in Plans, not here."}</p>
    </Panel>
  </div>;
}
