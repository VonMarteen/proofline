import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { PageIntro, Panel } from "../../../components/control-ui";
import { controlIdentity } from "../../../lib/session";
import { cloneCommercialPlan } from "../../actions";

export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;sort?:string;page?:string;pageSize?:string}>}){
  const {locale:raw}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25",...(sp.q?{q:sp.q}:{}),...(sp.sort?{sort:sp.sort}:{})});
  const [plans,data,identity]=await Promise.all([controlGet("/v1/control/tables/plans-catalog"),controlGet(`/v1/control/tables/entitlements?${qs}`),controlIdentity()]);
  const canManage=["INTERNAL_PLATFORM_OWNER","INTERNAL_FINANCE","INTERNAL_OPERATIONS"].includes(identity.role);
  const rows=data.items??[];
  const currency=(cents:number,code:string)=>new Intl.NumberFormat(locale,{style:"currency",currency:code||"EUR"}).format((cents||0)/100);
  return <div className="control-stack">
    <PageIntro title={es?"Planes y capacidades":"Plans & entitlements"} text={es?"Catálogo comercial separado de las capacidades efectivas por organización.":"Commercial catalog separated from effective organization entitlements."}/>
    <div className="control-grid-3 control-plan-catalog">{plans.map((p:any)=><Panel key={p.id} className="control-plan"><h3>{p.name}</h3><div className="control-price">{currency(p.monthlyAmountCents,p.currency)}<span>/{es?"mes":"month"}</span></div><dl className="control-entitlements">{Object.entries(p.entitlementsJson??{}).map(([key,value])=><div key={key}><dt>{key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ")}</dt><dd>{typeof value==="boolean"?(value?(es?"Incluido":"Included"):(es?"No incluido":"Not included")):typeof value==="object"?JSON.stringify(value):String(value)}</dd></div>)}</dl><details className="control-tech-details"><summary>{es?"Ver detalle técnico":"View technical data"}</summary><pre className="control-json">{JSON.stringify(p.entitlementsJson,null,2)}</pre></details></Panel>)}{!plans.length?<p className="control-empty">{es?"No hay planes comerciales configurados.":"No commercial plans configured."}</p>:null}</div>

    <Panel title={es?"Crear nueva versión comercial de plan":"Create a new commercial plan variant"}>
      {canManage&&plans.length?<><p className="control-note">{es?"Se copian exactamente las capacidades de un plan existente y se crea un código comercial nuevo. No cambia precios, permisos ni facturas de las suscripciones actuales.":"Duplicates existing plan entitlements under a new commercial code. Existing subscription prices, permissions and invoices remain unchanged."}</p>
      <form action={cloneCommercialPlan} className="bo-filter-form bo-table-filters control-plan-create-form" data-confirm-title={es?"Crear nuevo plan":"Create new plan"} data-confirm-message={es?"Esta operación creará un plan nuevo auditable. Los planes actuales y sus contratos no se modificarán.":"Creates a new audited plan. Existing plans and contracts remain unchanged."}>
        <input type="hidden" name="locale" value={locale}/>
        <label>{es?"Plantilla de capacidades":"Entitlements template"}<select name="sourceCode" required>{plans.map((p:any)=><option key={p.code} value={p.code}>{p.name} ({p.code}) · {p.currency??"EUR"}</option>)}</select></label>
        <label>{es?"Código nuevo":"New code"}<input name="code" minLength={3} maxLength={40} pattern="[a-zA-Z][a-zA-Z0-9_-]{2,39}" placeholder="ENTERPRISE_2027" required/></label>
        <label>{es?"Nombre comercial":"Commercial name"}<input name="name" minLength={3} maxLength={100} placeholder="Enterprise 2027" required/></label>
        <label>{es?"Cuota mensual en moneda de la plantilla":"Monthly amount in template currency"}<input name="monthlyAmount" type="number" min="0" max="100000" step="0.01" required placeholder="149.00"/></label>
        <button type="submit">{es?"Crear plan":"Create plan"}</button>
      </form></>:<p className="control-note">{es?"Creación no disponible para este rol o sin catálogo base.":"Creation unavailable for this role or without a template plan."}</p>}
    </Panel>
    <Panel title={es?"Overrides y capacidades efectivas":"Overrides and effective entitlements"}>
      <form method="get" className="bo-filter-form bo-table-filters" data-proofline-no-confirm="true">
        <input name="q" defaultValue={sp.q??""} aria-label={es?"Buscar capacidades":"Search entitlements"} placeholder={es?"Organización o clave":"Organization or key"}/>
        <select name="sort" aria-label={es?"Orden":"Sort"} defaultValue={sp.sort??"organization"}><option value="organization">{es?"Organización · clave":"Organization · key"}</option><option value="newest">{es?"Modificados recientemente":"Recently modified"}</option></select>
        <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={data.pagination.pageSize}/><button type="submit">{es?"Aplicar":"Apply"}</button>{(sp.q||sp.sort)?<a className="control-button secondary" href={`/${locale}/plans`}>{es?"Restablecer":"Reset"}</a>:null}
      </form>
      <div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Organización":"Organization"}</th><th>Key</th><th>{es?"Valor":"Value"}</th><th>{es?"Fuente":"Source"}</th></tr></thead><tbody>{rows.map((e:any)=><tr key={e.id}><td><strong>{e.organization.name}</strong></td><td><code>{e.key}</code></td><td><span className="control-break-value">{typeof e.value==="object"?JSON.stringify(e.value):String(e.value)}</span></td><td>{e.source}</td></tr>)}{!rows.length?<tr><td colSpan={4} className="control-table-empty">{es?"No hay capacidades que coincidan con la búsqueda.":"No entitlements match this search."}</td></tr>:null}</tbody></table>
        <PaginationBar pagination={data.pagination} basePath={`/${locale}/plans`} query={{q:sp.q,sort:sp.sort}} locale={locale}/></div>
    </Panel>
  </div>;
}
