import Link from "next/link";
import { notFound } from "next/navigation";
import { PaginationBar } from "@proofline/ui";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../lib/api";
import { controlIdentity } from "../../../../lib/session";
import { PageIntro, Panel, Status, dateTime } from "../../../../components/control-ui";

type Search={page?:string;pageSize?:string};
export default async function Page({params,searchParams}:{params:Promise<{locale:string;id:string}>;searchParams:Promise<Search>}){
 const {locale:raw,id}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
 const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25"});
 const [d,identity]=await Promise.all([controlGet(`/v1/control/reports/${encodeURIComponent(id)}/operational-detail?${qs}`),controlIdentity()]);
 if(!d?.id)notFound();
 const canSeeDelivery=["INTERNAL_PLATFORM_OWNER","INTERNAL_OPERATIONS"].includes(identity.role);
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/reports`}>{es?"← Volver a Informes":"← Back to reports"}</Link></div>
  <PageIntro title={d.assessment.title} text={`${d.assessment.organization.name} · ${d.kind} · v${d.version}`}/>
  <Panel title={es?"Evidencia y publicación":"Evidence and publication"}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Estado":"Status"}</strong><Status value={d.status}/></div>
    <div><strong>{es?"Creado":"Created"}</strong><span>{dateTime(d.createdAt,locale)}</span></div>
    <div><strong>{es?"Aprobado":"Approved"}</strong><span>{dateTime(d.approvedAt,locale)}</span></div>
    <div><strong>{es?"Distribuido":"Distributed"}</strong><span>{dateTime(d.distributedAt,locale)}</span></div>
    <div><strong>SHA-256</strong><code title={d.snapshotHash}>{d.snapshotHash}</code></div>
    <div><strong>{es?"Assessment de origen":"Source assessment"}</strong><Link className="control-link-strong" href={`/${locale}/assessments/${encodeURIComponent(d.assessment.id)}`}>{es?"Ver assessment":"View assessment"}</Link></div>
   </div>
   <p className="control-note">{es?"La huella identifica el snapshot persistido; no representa una comprobación criptográfica de los bytes exportados. Este panel no publica, distribuye ni descarga contenido confidencial.":"The hash identifies the persisted snapshot; this is not independent verification of exported bytes. This panel does not publish, distribute or download confidential content."}</p>
  </Panel>
  <Panel title={es?"Resultados de distribución":"Delivery outcomes"}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Total":"Total"}</strong><span>{d.deliverySummary.total}</span></div>
    <div><strong>{es?"Enviados":"Sent"}</strong><span>{d.deliverySummary.sent}</span></div>
    <div><strong>{es?"Pendientes":"Pending"}</strong><span>{d.deliverySummary.pending}</span></div>
    <div><strong>{es?"Fallidos":"Failed"}</strong><span>{d.deliverySummary.failed}</span></div>
   </div>
   <p className="control-note">{es?"El estado SENT registra el envío, no confirma la lectura ni recepción final. Solo se muestra metadato operativo.":"SENT records a send event, not verified reading or final delivery. Only operational metadata is displayed."}</p>
   <div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Estado":"Status"}</th><th>{es?"Canal":"Channel"}</th><th>{es?"Creado":"Created"}</th><th>{es?"Enviado":"Sent"}</th><th>{es?"Incidencia":"Issue"}</th>{canSeeDelivery?<th>{es?"Detalle":"Detail"}</th>:null}</tr></thead><tbody>
    {d.deliveries.items.map((v:any)=><tr key={v.id}><td><Status value={v.status}/></td><td>{v.channel}</td><td>{dateTime(v.createdAt,locale)}</td><td>{dateTime(v.sentAt,locale)}</td><td>{v.errorRecorded?(es?"Registrada":"Recorded"):"—"}</td>{canSeeDelivery?<td><Link className="control-link-strong" href={`/${locale}/communications/deliveries/${encodeURIComponent(v.id)}`}>{es?"Ver entrega":"View delivery"}</Link></td>:null}</tr>)}
    {!d.deliveries.items.length?<tr><td colSpan={canSeeDelivery?6:5} className="control-table-empty">{es?"No hay entregas para este informe.":"No deliveries for this report."}</td></tr>:null}
   </tbody></table>
   <PaginationBar pagination={d.deliveries.pagination} basePath={`/${locale}/reports/${encodeURIComponent(id)}`} locale={locale}/></div>
  </Panel>
 </div>;
}
