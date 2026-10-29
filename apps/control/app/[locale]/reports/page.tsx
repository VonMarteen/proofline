import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { PageIntro, Panel, Status, date } from "../../../components/control-ui";

type Search={q?:string;status?:string;kind?:string;delivery?:string;page?:string;pageSize?:string};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Search>}){
  const {locale:raw}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25"});
  for(const key of ["q","status","kind","delivery"] as const)if(sp[key])qs.set(key,sp[key]!);
  const d=await controlGet(`/v1/control/tables/reports?${qs}`),rows=d.items??[];
  return <div className="control-stack">
    <PageIntro title={es?"Informes":"Reports"}/>
    <Panel title={es?"Registro de informes":"Report register"}>
      <form method="get" className="bo-filter-form bo-table-filters" data-proofline-no-confirm="true" role="search">
        <input name="q" maxLength={120} aria-label={es?"Buscar informe":"Search report"} defaultValue={sp.q??""} placeholder={es?"Assessment u organización":"Assessment or organization"}/>
        <select name="status" defaultValue={sp.status??""} aria-label={es?"Estado de informe":"Report status"}><option value="">{es?"Todos los estados":"All statuses"}</option>{["DRAFT","APPROVED","DISTRIBUTED"].map(x=><option key={x}>{x}</option>)}</select>
        <select name="kind" defaultValue={sp.kind??""} aria-label={es?"Tipo de informe":"Report type"}><option value="">{es?"Todos los tipos":"All types"}</option><option value="EXECUTIVE">Executive</option><option value="FULL">Full</option></select>
        <select name="delivery" defaultValue={sp.delivery??""} aria-label={es?"Estado de entrega":"Delivery status"}><option value="">{es?"Todas las entregas":"All deliveries"}</option><option value="PENDING">{es?"Con entregas pendientes":"Has pending deliveries"}</option><option value="SENT">{es?"Con entregas enviadas":"Has sent deliveries"}</option><option value="FAILED">{es?"Con entregas fallidas":"Has failed deliveries"}</option><option value="NONE">{es?"Sin entregas":"Without deliveries"}</option></select>
        <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={d.pagination.pageSize}/>
        <button type="submit">{es?"Filtrar":"Filter"}</button><a className="control-button secondary" href={`/${locale}/reports`}>{es?"Limpiar":"Reset"}</a>
      </form>
      <p className="control-note">{d.pagination.total} {es?"informes coincidentes. El estado DISTRIBUTED no implica que cada entrega se haya enviado correctamente.":"matching reports. DISTRIBUTED does not imply that every delivery succeeded."}</p>
      <div className="control-table-wrap"><table className="control-table"><thead><tr>
        <th>{es?"Informe":"Report"}</th><th>{es?"Organización":"Organization"}</th><th>{es?"Estado":"Status"}</th><th>{es?"Versión":"Version"}</th><th>{es?"Entregas registradas":"Recorded deliveries"}</th><th>{es?"Aprobado":"Approved"}</th><th>{es?"Distribuido":"Distributed"}</th><th>{es?"Evidencia":"Evidence"}</th>
      </tr></thead><tbody>{rows.map((r:any)=>{
        const delivery=r.deliverySummary??{total:0,sent:0,failed:0,pending:0};
        return <tr key={r.id}><td><Link href={`/${locale}/reports/${encodeURIComponent(r.id)}`} className="control-link-strong">{r.assessment.title}</Link><span className="control-cell-secondary">{r.kind} · {date(r.createdAt,locale)}</span></td><td>{r.assessment.organization.name}</td><td><Status value={r.status}/></td><td>v{r.version}</td>
          <td><strong>{delivery.total}</strong><span className="control-cell-secondary">{delivery.sent} {es?"enviados":"sent"} · {delivery.pending} {es?"pendientes":"pending"}</span>{delivery.failed>0?<span className="control-risk">{delivery.failed} {es?"fallidos":"failed"}</span>:null}</td>
          <td>{date(r.approvedAt,locale)}</td><td>{date(r.distributedAt,locale)}</td><td><code title={r.snapshotHash}>{String(r.snapshotHash??"").slice(0,12)||"—"}</code></td>
        </tr>;
      })}{!rows.length?<tr><td colSpan={8} className="control-table-empty">{es?"Sin informes que coincidan con los filtros.":"No reports match the filters."}</td></tr>:null}</tbody></table>
        <PaginationBar pagination={d.pagination} basePath={`/${locale}/reports`} query={{q:sp.q,status:sp.status,kind:sp.kind,delivery:sp.delivery}} locale={locale}/>
      </div>
    </Panel>
    <p className="control-note">{es?"La huella del snapshot permite verificar la referencia del resultado. Aprobación, distribución y envío son estados distintos; aquí no se ejecutan acciones de publicación ni envíos.":"The snapshot fingerprint identifies the result source. Approval, distribution and actual sending are distinct states; this screen does not publish or send reports."}</p>
  </div>;
}
