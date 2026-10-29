import "../workspace-list-filters.css";
import { normalizeLocale } from "@proofline/i18n";
import { Badge, Icon, PaginationBar } from "@proofline/ui";
import { apiGet } from "../../../lib/api";

const states = ["DRAFT","PREPARATION","REVIEW","READY","ACTIVE","CLOSED","ARCHIVED"];
const stateNames: Record<string,[string,string]> = {
  DRAFT:["Borrador","Draft"], PREPARATION:["Preparación","Preparation"],
  REVIEW:["Revisión","Review"], READY:["Listo","Ready"], ACTIVE:["Activo","Active"],
  CLOSED:["Cerrado","Closed"], ARCHIVED:["Archivado","Archived"],
};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;status?:string;page?:string;pageSize?:string}>}){
  const {locale:raw}=await params,sp=await searchParams,l=normalizeLocale(raw),es=l==="es";
  const q=(sp.q??"").trim().slice(0,120),status=states.includes(sp.status??"")?sp.status!:"";
  const page=sp.page??"1",pageSize=sp.pageSize??"25";
  const [d,records]=await Promise.all([
    apiGet(`/v1/workspace/legal?locale=${l}&assessments=none`),
    apiGet(`/v1/workspace/legal/assessments/table?${new URLSearchParams({page,pageSize,...(q?{q}:{}),...(status?{status}:{})})}`),
  ]);
  return <div className="workspace-page">
    <section className="workspace-page-head"><div><h1>{es?"Privacidad y cumplimiento":"Privacy and compliance"}</h1><p>{es?"Consulta perfiles legales, conservación de datos, avisos y protecciones de tu organización.":"Review legal profiles, retention, notices and protections for your organization."}</p></div><div className="workspace-head-context"><span>{es?"Políticas de retención":"Retention policies"}</span><strong>{d.retentionPolicies.length}</strong></div></section>
    <section className="privacy-overview ws-r8-privacy-overview" aria-label={es?"Resumen de privacidad":"Privacy overview"}>
      <article className="ws-r8-privacy-kpi"><span className="ws-r8-privacy-icon"><Icon name="approved" size={17}/></span><span className="ws-r8-privacy-label">{es?"Assessments con perfil aprobado":"Assessments with approved profile"}</span><strong>{records.approvedCount}</strong></article>
      <article className="ws-r8-privacy-kpi"><span className="ws-r8-privacy-icon"><Icon name="lock" size={17}/></span><span className="ws-r8-privacy-label">{es?"Bloqueos legales activos":"Active legal holds"}</span><strong>{d.legalHolds.length}</strong></article>
      <article className="ws-r8-privacy-kpi"><span className="ws-r8-privacy-icon"><Icon name="reports" size={17}/></span><span className="ws-r8-privacy-label">{es?"Documentos legales vigentes":"Active legal documents"}</span><strong>{d.documents.length}</strong></article>
      <article className="ws-r8-privacy-kpi"><span className="ws-r8-privacy-icon"><Icon name="governance" size={17}/></span><span className="ws-r8-privacy-label">{es?"Políticas de retención":"Retention policies"}</span><strong>{d.retentionPolicies.length}</strong></article>
    </section>
    <section className="workspace-section"><div className="workspace-section-head"><h2>{es?"Assessments y privacidad":"Assessments and privacy"}</h2><span className="muted">{records.pagination.total} {es?"coincidencias":"matches"}</span></div>
      <form className="workspace-list-filters" action={`/${l}/legal`} method="get" data-proofline-no-confirm="true" aria-label={es?"Filtrar assessments":"Filter assessments"}>
        <label>{es?"Buscar assessment":"Search assessments"}<input className="input" name="q" maxLength={120} defaultValue={q} placeholder={es?"Nombre del assessment":"Assessment name"}/></label>
        <label>{es?"Estado":"Status"}<select className="input" name="status" defaultValue={status}><option value="">{es?"Todos los estados":"All statuses"}</option>{states.map(v=><option key={v} value={v}>{stateNames[v]?.[es?0:1]??v}</option>)}</select></label>
        <button className="btn" type="submit">{es?"Filtrar":"Filter"}</button><a className="btn btn-ghost" href={`/${l}/legal`}>{es?"Limpiar":"Clear"}</a>
      </form>
      <div className="ws-r3-table-meta">{es?`Página ${records.pagination.page} de ${records.pagination.pages}`:`Page ${records.pagination.page} of ${records.pagination.pages}`}</div>
      <div className="privacy-assessment-list"><div className="ws-r3-privacy-head"><span>Assessment</span><span>{es?"Aprobación":"Approval"}</span><span>{es?"Estado":"Status"}</span><span>{es?"Modo":"Mode"}</span><span>{es?"Cohorte":"Cohort"}</span><span>{es?"Retención":"Retention"}</span><span>{es?"Destinatarios":"Recipients"}</span><span>{es?"Acción":"Action"}</span></div>{records.items.map((a:any)=><article key={a.id}><h3>{a.title}</h3><Badge tone={a.legalProfile?.approvedAt?"good":"warn"}>{a.legalProfile?.approvedAt?(es?"Aprobado":"Approved"):(es?"Pendiente":"Pending")}</Badge><span>{stateNames[a.status]?.[es?0:1]??a.status}</span><span>{a.privacyMode}</span><strong>{a.minCohortSize}</strong><span>{a.legalProfile?.retentionDays??"—"} {es?"días":"days"}</span><strong>{a.resultRecipients}</strong><a className="ws-r6-review-link" href={`/${l}/assessments/${encodeURIComponent(a.id)}`}>{es?"Revisar":"Review"} <span aria-hidden="true">→</span></a></article>)}{!records.items.length?<p className="workspace-empty-state">{es?"No hay assessments para los filtros seleccionados.":"No assessments match these filters."}</p>:null}</div>
      <PaginationBar pagination={records.pagination} basePath={`/${l}/legal`} query={{q,status}} locale={l}/>
    </section>
    <section className="workspace-section"><h2>{es?"Políticas de conservación":"Retention policies"}</h2><div className="retention-grid">{d.retentionPolicies.map((p:any)=><article key={p.id}><strong>{p.recordClass}</strong><span>{p.durationDays} {es?"días":"days"}</span><small>{p.action} · {p.legalBasis}</small></article>)}</div></section>
    <section className="workspace-section"><h2>{es?"Bloqueos legales":"Legal holds"}</h2>{d.legalHolds.length?<div className="retention-grid">{d.legalHolds.map((h:any)=><article key={h.id}><strong>{h.scope}</strong><span>{h.assessmentId?(es?"Assessment específico":"Assessment-specific"):(es?"Organización":"Organization")}</span><small>{h.reason}</small></article>)}</div>:<p className="muted">{es?"No hay bloqueos legales activos para esta organización.":"There are no active legal holds for this organization."}</p>}</section>
    <section className="workspace-section"><h2>{es?"Documentos vigentes":"Active documents"}</h2><div className="workspace-document-table">{d.documents.map((x:any)=><div className="workspace-document-row" key={x.key}><div><strong>{x.version?.title??x.description}</strong><span>{x.description}</span></div><div><strong>{x.scope}</strong></div><div><strong>{x.version?`v${x.version.version}`:"—"}</strong></div></div>)}</div></section>
  </div>;
}
