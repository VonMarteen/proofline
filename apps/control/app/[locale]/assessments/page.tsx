import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { controlIdentity } from "../../../lib/session";
import { Meter, Metric, PageIntro, Panel, Status, dateTime } from "../../../components/control-ui";
import { reprocessAssessment } from "../../actions";

type Search = {q?:string;status?:string;page?:string;pageSize?:string};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Search>}){
  const {locale:raw}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25",...(sp.q?{q:sp.q}:{}),...(sp.status?{status:sp.status}:{})});
  const [d,identity]=await Promise.all([controlGet(`/v1/control/tables/assessments?${qs}`),controlIdentity()]);
  const rows=d.items??[],summary=d.summary??{};
  const canManage=["INTERNAL_PLATFORM_OWNER","INTERNAL_OPERATIONS"].includes(identity.role);
  return <div className="control-stack">
    <PageIntro title="Assessments"/>
    <div className="control-metrics control-metrics-4">
      <Metric label={es?"Coincidencias":"Matching assessments"} value={d.pagination.total}/>
      <Metric label={es?"Activos (filtro)":"Active (filtered)"} value={summary.ACTIVE??0}/>
      <Metric label={es?"Cerrados (filtro)":"Closed (filtered)"} value={summary.CLOSED??0}/>
      <Metric label={es?"Archivados (filtro)":"Archived (filtered)"} value={summary.ARCHIVED??0}/>
    </div>
    <Panel title={es?"Seguimiento y análisis":"Collection and analysis"}>
      <form method="get" className="bo-filter-form bo-table-filters" data-proofline-no-confirm="true" role="search">
        <input name="q" maxLength={120} aria-label={es?"Buscar assessment":"Search assessment"} defaultValue={sp.q??""} placeholder={es?"Assessment u organización":"Assessment or organization"}/>
        <select name="status" aria-label={es?"Estado":"Status"} defaultValue={sp.status??""}><option value="">{es?"Todos los estados":"All statuses"}</option>{["DRAFT","PREPARATION","REVIEW","READY","ACTIVE","CLOSED","ARCHIVED"].map(x=><option key={x}>{x}</option>)}</select>
        <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={d.pagination.pageSize}/>
        <button type="submit">{es?"Filtrar":"Filter"}</button><a href={`/${locale}/assessments`} className="control-button secondary">{es?"Limpiar":"Reset"}</a>
      </form>
      <div className="control-table-wrap"><table className="control-table"><thead><tr>
        <th>Assessment</th><th>{es?"Estado":"Status"}</th><th>{es?"Participación agregada":"Aggregate participation"}</th><th>{es?"Último análisis":"Latest analysis"}</th><th>{es?"Informes":"Reports"}</th><th>{es?"Protecciones":"Safeguards"}</th>{canManage?<th>{es?"Acción":"Action"}</th>:null}
      </tr></thead><tbody>{rows.map((a:any)=>{
        const progress=a.progress??{invited:0,started:0,completed:0,revoked:0,eligible:0,completionPct:null};
        return <tr key={a.id}><td><Link href={`/${locale}/assessments/${encodeURIComponent(a.id)}`} className="control-link-strong">{a.title}</Link><span className="control-cell-secondary">{a.organization.name}</span><span className="control-cell-secondary">{a.level} · {a.privacyMode}</span></td>
          <td><Status value={a.status}/></td>
          <td><div className="p5-progress"><strong>{progress.completed} / {progress.eligible}</strong><span>{progress.completionPct===null?"—":`${progress.completionPct}%`}</span></div><Meter value={progress.completed} max={progress.eligible}/><span className="control-cell-secondary">{progress.invited} {es?"pendientes":"pending"} · {progress.started} {es?"en curso":"in progress"} · {progress.revoked} {es?"revocados":"revoked"}</span></td>
          <td>{a.analysisRuns[0]?<><Status value={a.analysisRuns[0].status}/><span className="control-cell-secondary">{dateTime(a.analysisRuns[0].createdAt,locale)}</span></>:"—"}</td>
          <td className="control-number">{a._count.reports}</td>
          <td>{a.legalProfile?.approvedAt?<span className="control-ok">{es?"Legal aprobado":"Legal approved"}</span>:<span className="control-risk">{es?"Revisión legal":"Legal review"}</span>}{a.legalHolds.length?<span className="control-risk"> · HOLD</span>:null}</td>
          {canManage?<td>{a.canReprocess?<form action={reprocessAssessment} data-confirm-title={es?"Reprocesar assessment":"Reprocess assessment"} data-confirm-message={es?"Se creará una nueva ejecución analítica en cola. Los informes existentes no se modifican automáticamente.":"A new analytical run will be queued. Existing reports are not automatically changed."}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="locale" value={locale}/><button type="submit" className="control-button small">{es?"Reprocesar":"Reprocess"}</button></form>:<span className="control-cell-secondary">{["CLOSED","ARCHIVED"].includes(a.status)?es?"Análisis en curso":"Analysis in progress":es?"Debe estar cerrado":"Must be closed"}</span>}</td>:null}
        </tr>;
      })}{!rows.length?<tr><td colSpan={canManage?7:6} className="control-table-empty">{es?"No hay assessments para estos filtros.":"No assessments match these filters."}</td></tr>:null}</tbody></table>
        <PaginationBar pagination={d.pagination} basePath={`/${locale}/assessments`} query={{q:sp.q,status:sp.status}} locale={locale}/>
      </div>
    </Panel>
    <p className="control-note">{es?"Los estados son actuales, no acumulativos: un participante completado ya no aparece como pendiente o en curso. El porcentaje excluye revocados. Reprocesar genera una ejecución nueva, no una aprobación ni una distribución automática.":"These are current statuses, not cumulative historical counts: completed participants are no longer pending or in progress. The percentage excludes revoked participants. Reprocessing queues a new run; it does not approve or distribute reports."}</p>
  </div>;
}
