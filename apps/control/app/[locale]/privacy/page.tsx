import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../lib/api";
import { Metric, PageIntro, Panel, Status, date } from "../../../components/control-ui";
import { PaginationBar } from "@proofline/ui";
import { releaseLegalHold } from "../../actions";

export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string;status?:string;recordClass?:string;page?:string;pageSize?:string}>}){
  const {locale:raw}=await params,locale=normalizeLocale(raw),es=locale==="es";
  const sp=await searchParams;
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25",...(sp.q?{q:sp.q}:{}),...(sp.status?{status:sp.status}:{}),...(sp.recordClass?{recordClass:sp.recordClass}:{})});
  const [d,archive]=await Promise.all([controlGet("/v1/control/legal?view=ui"),controlGet(`/v1/control/tables/legal/records?${qs}`)]);
  const active=d.legalHolds.filter((h:any)=>h.status==="ACTIVE");
  const due=Number(d.dueSoon??0);
  return <div className="control-stack">
    <PageIntro title={es?"Privacidad y retención":"Privacy & retention"} text={es?"Políticas, documentos, retención y legal holds. Los plazos son configuración operativa; no sustituyen revisión jurídica aplicable.":"Policies, records, retention and legal holds. Operational timelines do not replace applicable legal review."}/>
    <div className="control-metrics control-metrics-3"><Metric label={es?"Políticas":"Policies"} value={d.retentionPolicies.length}/><Metric label={es?"Legal holds activos":"Active legal holds"} value={active.length}/><Metric label={es?"Registros próximos a retención":"Records due soon"} value={due}/></div>
    <div className="control-grid-2 control-align-start">
      <Panel title={es?"Políticas de retención":"Retention policies"}><div className="control-list compact">{d.retentionPolicies.map((p:any)=><div key={p.id}><div><strong>{p.recordClass}</strong><span>{p.organization.name}{p.assessment?` · ${p.assessment.title}`:""}</span></div><span>{p.durationDays}d · {p.action}{p.locked?" · locked":""}</span></div>)}</div></Panel>
      <Panel title="Legal holds">{d.legalHolds.length?<div className="control-list">{d.legalHolds.map((h:any)=><div key={h.id}><div><strong>{h.scope}</strong><span>{h.organization.name} · {h.reason}</span></div><div><Status value={h.status}/>{h.status==="ACTIVE"?<form action={releaseLegalHold} data-confirm-title={es?"Liberar legal hold":"Release legal hold"} data-confirm-message={es?"La liberación permitirá que las políticas de retención vuelvan a aplicarse a estos registros.":"Releasing the hold allows retention policies to apply to these records again."} data-confirm-tone="danger"><input type="hidden" name="id" value={h.id}/><input type="hidden" name="locale" value={locale}/><button className="control-button small danger" type="submit">{es?"Liberar":"Release"}</button></form>:null}</div></div>)}</div>:<p className="control-empty">{es?"No hay legal holds.":"No legal holds."}</p>}</Panel>
    </div>
    <Panel title={es?"Archivo documental":"Document records"}>
      <form className="bo-filter-form control-uxa3-filters" method="get" role="search" data-proofline-no-confirm="true">
        <input type="search" name="q" maxLength={100} defaultValue={sp.q??""} aria-label={es?"Buscar documentos":"Search documents"} placeholder={es?"Documento, organización o clase":"Document, organization or class"}/>
        <select name="status" defaultValue={sp.status??""} aria-label={es?"Estado":"Status"}><option value="">{es?"Todos los estados":"All statuses"}</option>{["ACTIVE","RETENTION_PENDING","BLOCKED","ANONYMIZED","DELETION_SCHEDULED","DESTROYED"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select>
        <input name="recordClass" maxLength={70} defaultValue={sp.recordClass??""} aria-label={es?"Clase documental exacta":"Exact record class"} placeholder={es?"Clase exacta (opcional)":"Exact class (optional)"}/>
        <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={archive.pagination.pageSize}/>
        <button type="submit">{es?"Filtrar":"Filter"}</button><a className="control-button secondary" href={`/${locale}/privacy`}>{es?"Limpiar":"Clear"}</a>
      </form>
      <div className="control-table-wrap"><table className="control-table"><thead><tr>{[es?"Documento":"Document",es?"Organización":"Organization",es?"Clase":"Class",es?"Estado":"Status",es?"Retención hasta":"Retain until"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
        {archive.items.map((r:any)=><tr key={r.id}><td><strong>{r.title}</strong><span className="control-cell-secondary">{r.fileName}</span></td><td>{r.organization.name}</td><td>{r.recordClass}</td><td><Status value={r.status}/></td><td>{date(r.retentionUntil,locale)}</td></tr>)}
        {!archive.items.length?<tr><td colSpan={5} className="control-table-empty">{es?"Sin documentos que coincidan con los filtros.":"No documents match the filters."}</td></tr>:null}
      </tbody></table><PaginationBar pagination={archive.pagination} basePath={`/${locale}/privacy`} query={{q:sp.q,status:sp.status,recordClass:sp.recordClass}} locale={locale}/></div>
    </Panel>
  </div>;
}
