import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../components/control-ui";
import { assignSupportTicket, updateTicketStatus } from "../../actions";

type SupportSearch = {page?:string;pageSize?:string;q?:string;priority?:string;status?:string};
const statuses = ["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED","RESOLVED","CLOSED"];
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<SupportSearch>}){
  const {locale:raw}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
  const supportUrl=process.env.SUPPORT_APP_URL??"http://localhost:4205";
  const filters={q:sp.q,priority:sp.priority,status:sp.status};
  const qs=new URLSearchParams({view:"all",page:sp.page??"1",pageSize:sp.pageSize??"25"});
  for(const [k,v] of Object.entries(filters))if(v)qs.set(k,v);
  const d=await controlGet(`/v1/control/tables/support?${qs}`);
  const rows=d.items as any[];
  return <div className="control-stack">
    <PageIntro title={es?"Soporte":"Support"} text={es?"Cola operativa compartida con el Workspace y la consola de agentes.":"Shared operational queue with Workspace and the agent console."}/>
    <div className="control-compact-actions"><a className="control-button" href={`${supportUrl}/${locale}`} target="_blank" rel="noopener noreferrer">{es?"Abrir consola de soporte":"Open Support Console"}</a><a className="control-button" href={`/${locale}/support/history`}>{es?"Histórico de tickets":"Ticket history"}</a></div>
    <div className="control-metrics control-metrics-3">
      <div className="control-metric"><span>{es?"Sin adjudicar":"Unassigned"}</span><strong>{d.metrics.unassigned}</strong></div>
      <div className="control-metric"><span>{es?"Fuera de SLA":"Past SLA"}</span><strong>{d.metrics.overdue}</strong></div>
      <div className="control-metric"><span>{es?"Riesgo de saturación":"Saturation risk"}</span><strong>{d.metrics.saturationRisk??0}</strong></div>
    </div>
    <form method="get" className="bo-filter-form" role="search" data-proofline-no-confirm="true">
      <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={d.pagination.pageSize}/>
      <input name="q" aria-label={es?"Buscar ticket u organización":"Search ticket or organization"} defaultValue={sp.q} maxLength={120} placeholder={es?"Ticket, asunto u organización":"Ticket, subject or organization"}/>
      <select name="priority" aria-label={es?"Prioridad":"Priority"} defaultValue={sp.priority??""}><option value="">{es?"Todas las prioridades":"All priorities"}</option>{["URGENT","HIGH","NORMAL","LOW"].map(p=><option key={p}>{p}</option>)}</select>
      <select name="status" aria-label={es?"Estado":"Status"} defaultValue={sp.status??""}><option value="">{es?"Todos los estados":"All statuses"}</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
      <button type="submit">{es?"Filtrar":"Filter"}</button><a href={`/${locale}/support`} className="control-button small">{es?"Limpiar":"Clear"}</a>
    </form>
    <Panel><div className="control-table-wrap"><table className="control-table"><thead><tr><th>Ticket</th><th>{es?"Organización":"Organization"}</th><th>{es?"Responsable":"Assignee"}</th><th>SLA</th><th>{es?"Estado":"Status"}</th><th>{es?"Acciones":"Actions"}</th></tr></thead><tbody>
      {rows.map((t:any)=>{const closed=t.status==="CLOSED"||t.status==="RESOLVED";return <tr key={t.id} className={t.sla.overdue?"control-row-danger":""}>
        <td><a className="control-link-strong" href={`/${locale}/support/${t.id}`}>{t.subject}</a><span className="control-cell-secondary">{t.category} · {t.priority} · {t._count.messages} msgs</span>{t.risk?.possibleSaturation?<span className="control-risk">{es?"Posible saturación":"Possible saturation"} · {t.risk.requesterOpenTickets}</span>:null}</td>
        <td>{t.organization.name}<span className="control-cell-secondary">{t.requester?.displayName??"—"}</span></td>
        <td>{t.assignee?<><strong>{t.assignee.displayName}</strong><span className="control-cell-secondary">{t.assignee.email}</span></>:<span className="control-risk">{es?"Sin adjudicar":"Unassigned"}</span>}</td>
        <td><strong className={t.sla.overdue?"danger-text":""}>{closed?"—":t.sla.overdue?(es?"Vencido":"Overdue"):(t.sla.minutesRemaining<60?`${t.sla.minutesRemaining} min`:`${Math.ceil(t.sla.minutesRemaining/60)} h`)}</strong><span className="control-cell-secondary">{dateTime(t.slaDueAt,locale)}</span></td>
        <td><Status value={t.status}/></td>
        <td><div className="control-compact-actions">{!t.assignee&&!closed?<form action={assignSupportTicket} data-confirm-title={es?"Adjudicar ticket":"Assign ticket"} data-confirm-message={es?"El ticket quedará asignado a tu usuario y registrado.":"The ticket will be assigned to you and audited."}><input type="hidden" name="id" value={t.id}/><input type="hidden" name="locale" value={locale}/><button className="control-button small" type="submit">{es?"Adjudicarme":"Assign to me"}</button></form>:null}
        <form action={updateTicketStatus} className="control-inline-form" data-confirm-title={es?"Confirmar cambio de estado":"Confirm status change"}><input type="hidden" name="id" value={t.id}/><input type="hidden" name="locale" value={locale}/><select name="status" defaultValue={t.status} className="control-select" aria-label={es?"Cambiar estado":"Change status"}>{statuses.map(s=><option key={s}>{s}</option>)}</select><button className="control-button small" type="submit">{es?"Guardar":"Save"}</button></form></div></td>
      </tr>})}</tbody></table>
      {!rows.length?<p className="control-empty">{es?"No hay tickets que coincidan con los filtros.":"No tickets match the filters."}</p>:null}
      <PaginationBar pagination={d.pagination} basePath={`/${locale}/support`} query={filters} locale={locale}/></div></Panel>
  </div>;
}
