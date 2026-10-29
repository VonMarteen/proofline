import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../lib/api";
import { controlIdentity } from "../../../../lib/session";
import { Meter, PageIntro, Panel, Status, dateTime } from "../../../../components/control-ui";
import { reprocessAssessment } from "../../../actions";

export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const [d,identity]=await Promise.all([
  controlGet(`/v1/control/assessments/${encodeURIComponent(id)}/operational-detail`),
  controlIdentity(),
 ]);
 if(!d?.id)notFound();
 const canManage=["INTERNAL_PLATFORM_OWNER","INTERNAL_OPERATIONS"].includes(identity.role);
 const p=d.progress;
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/assessments`}>{es?"← Volver a Assessments":"← Back to assessments"}</Link></div>
  <PageIntro title={d.title} text={`${d.organization.name} · ${d.level} · ${d.privacyMode}`}/>
  <Panel title={es?"Estado y controles":"Status and controls"}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Estado":"Status"}</strong><Status value={d.status}/></div>
    <div><strong>{es?"Perfil legal":"Legal profile"}</strong><span>{d.legalProfile?.approvedAt?(es?"Aprobado":"Approved"):(es?"Pendiente de revisión":"Review required")}</span></div>
    <div><strong>{es?"Legal hold activo":"Active legal hold"}</strong><span>{d.legalHolds?.length?(es?"Sí":"Yes"):(es?"No":"No")}</span></div>
    <div><strong>{es?"Última actualización":"Last updated"}</strong><span>{dateTime(d.updatedAt,locale)}</span></div>
   </div>
   <p className="control-note">{d.objective}</p>
   {canManage&&d.canReprocess?<form action={reprocessAssessment} data-confirm-title={es?"Reprocesar assessment":"Reprocess assessment"} data-confirm-message={es?"Se añadirá una nueva ejecución a la cola; no cambia ni aprueba informes existentes.":"A new analytical run will be queued; existing reports are not changed or approved."}>
    <input type="hidden" name="id" value={d.id}/><input type="hidden" name="locale" value={locale}/>
    <button type="submit" className="control-button">{es?"Reprocesar análisis":"Reprocess analysis"}</button>
   </form>:<p className="control-note">{es?"El reprocesamiento solo está disponible para responsables autorizados, con el assessment cerrado o archivado y sin análisis activo.":"Reprocessing is restricted to authorized operators, closed or archived assessments, and no active run."}</p>}
  </Panel>
  <Panel title={es?"Participación agregada":"Aggregate participation"}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Completados":"Completed"}</strong><span>{p.completed} / {p.eligible}</span></div>
    <div><strong>{es?"Pendientes":"Pending"}</strong><span>{p.invited}</span></div>
    <div><strong>{es?"En curso":"In progress"}</strong><span>{p.started}</span></div>
    <div><strong>{es?"Revocados":"Revoked"}</strong><span>{p.revoked}</span></div>
   </div><Meter value={p.completed} max={p.eligible}/>
   <p className="control-note">{es?"Los estados son actuales, no acumulativos. No se muestran identidades, respuestas ni resultados sensibles.":"Statuses are current, not historical totals. No identities, responses or sensitive results are shown."}</p>
  </Panel>
  <Panel title={es?"Ejecuciones analíticas":"Analysis runs"}>
   <div className="control-table-wrap"><table className="control-table"><thead><tr><th>ID</th><th>{es?"Estado":"Status"}</th><th>{es?"Motor":"Engine"}</th><th>{es?"Creada":"Created"}</th><th>{es?"Finalizada":"Finished"}</th><th>{es?"Error registrado":"Error recorded"}</th></tr></thead><tbody>
    {d.analysisRuns.map((r:any)=><tr key={r.id}><td><code title={r.id}>{r.id.slice(0,12)}</code></td><td><Status value={r.status}/></td><td>{r.engineVersion}</td><td>{dateTime(r.createdAt,locale)}</td><td>{dateTime(r.completedAt,locale)}</td><td>{r.errorRecorded?(es?"Sí · revisar Operaciones":"Yes · check Operations"):(es?"No":"No")}</td></tr>)}
    {!d.analysisRuns.length?<tr><td colSpan={6} className="control-table-empty">{es?"No hay ejecuciones analíticas registradas.":"No analytical runs recorded."}</td></tr>:null}
   </tbody></table></div>
   <p className="control-note">{es?`Mostrando ${d.analysisRuns.length} de ${d._count.analysisRuns} ejecuciones recientes.`:`Showing ${d.analysisRuns.length} of ${d._count.analysisRuns} recent runs.`} {d.truncated.analysisRuns?(es?"Para el histórico completo, utiliza Operaciones.":"Use Operations for the full history."):null}</p>
   <Link className="control-link-strong" href={`/${locale}/operations`}>{es?"Abrir Operaciones":"Open Operations"}</Link>
  </Panel>
  <Panel title={es?"Informes del assessment":"Assessment reports"}>
   <div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Informe":"Report"}</th><th>{es?"Versión":"Version"}</th><th>{es?"Estado":"Status"}</th><th>{es?"Creado":"Created"}</th><th>{es?"Detalle":"Detail"}</th></tr></thead><tbody>
    {d.reports.map((r:any)=><tr key={r.id}><td>{r.kind}</td><td>v{r.version}</td><td><Status value={r.status}/></td><td>{dateTime(r.createdAt,locale)}</td><td><Link className="control-link-strong" href={`/${locale}/reports/${encodeURIComponent(r.id)}`}>{es?"Ver evidencia":"View evidence"}</Link></td></tr>)}
    {!d.reports.length?<tr><td colSpan={5} className="control-table-empty">{es?"Sin informes generados.":"No reports generated."}</td></tr>:null}
   </tbody></table></div>
   {d.truncated.reports?<p className="control-note">{es?`Últimos ${d.reports.length} de ${d._count.reports} informes; consulta el registro completo.`:`Latest ${d.reports.length} of ${d._count.reports} reports; use the full register.`}</p>:null}
  </Panel>
 </div>;
}
