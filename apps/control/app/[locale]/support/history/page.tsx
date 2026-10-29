import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../../components/control-ui";
type Search={page?:string;pageSize?:string;q?:string;priority?:string;status?:string};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Search>}){
  const{locale:r}=await params,sp=await searchParams,locale=normalizeLocale(r),es=locale==="es";
  const supportUrl=process.env.SUPPORT_APP_URL??"http://localhost:4205";
  const qs=new URLSearchParams({view:"history",page:sp.page??"1",pageSize:sp.pageSize??"25"});
  if(sp.q)qs.set("q",sp.q);if(sp.priority)qs.set("priority",sp.priority);if(sp.status)qs.set("status",sp.status);
  const d=await controlGet(`/v1/control/tables/support?${qs}`),rows=d.items as any[];
  return <div className="control-stack"><PageIntro title={es?"Histórico de tickets":"Ticket history"} text={es?"Resueltos y cerrados según el historial real de soporte.":"Resolved and closed tickets from the actual support history."}/>
    <div className="control-compact-actions"><a className="control-button" href={`/${locale}/support`}>{es?"Volver a soporte":"Back to support"}</a><a className="control-button" href={`${supportUrl}/${locale}/history`} target="_blank" rel="noopener noreferrer">{es?"Consola de soporte":"Support Console"}</a></div>
    <form method="get" className="bo-filter-form" role="search" data-proofline-no-confirm="true"><input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={d.pagination.pageSize}/>
      <input name="q" defaultValue={sp.q} maxLength={120} aria-label={es?"Buscar en histórico":"Search history"} placeholder={es?"Ticket, asunto u organización":"Ticket, subject or organization"}/>
      <select name="status" defaultValue={sp.status??""} aria-label={es?"Estado":"Status"}><option value="">{es?"Resueltos y cerrados":"Resolved and closed"}</option><option value="RESOLVED">RESOLVED</option><option value="CLOSED">CLOSED</option></select>
      <button>{es?"Filtrar":"Filter"}</button><a className="control-button small" href={`/${locale}/support/history`}>{es?"Limpiar":"Clear"}</a></form>
    <Panel><div className="control-table-wrap"><table className="control-table"><thead><tr><th>Ticket</th><th>{es?"Organización":"Organization"}</th><th>{es?"Responsable":"Assignee"}</th><th>{es?"Estado":"Status"}</th><th>{es?"Resuelto / cerrado":"Resolved / closed"}</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><a className="control-link-strong" href={`/${locale}/support/${t.id}`}>{t.subject}</a><span className="control-cell-secondary">{t.category} · {t.priority}</span></td><td>{t.organization.name}</td><td>{t.assignee?.displayName??"—"}</td><td><Status value={t.status}/></td><td>{dateTime(t.closedAt??t.resolvedAt,locale)}</td></tr>)}</tbody></table>
      {!rows.length?<p className="control-empty">{es?"No hay tickets con estos filtros.":"No tickets match these filters."}</p>:null}
      <PaginationBar pagination={d.pagination} basePath={`/${locale}/support/history`} query={{q:sp.q,status:sp.status}} locale={locale}/></div></Panel></div>;
}
