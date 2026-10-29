import "../workspace-list-filters.css";
import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { apiGet } from "../../../lib/api";
import { SupportCenter } from "../../../components/support-center";
import { WorkspaceSupportRealtime } from "../../../components/workspace-support-realtime";

const statusLabel = (value: string, es: boolean) =>
  ({
    OPEN: es ? "Nuevo" : "Open",
    ASSIGNED: es ? "Asignado" : "Assigned",
    IN_PROGRESS: es ? "En curso" : "In progress",
    WAITING: es ? "Esperando tu respuesta" : "Waiting for you",
    RESOLVED: es ? "Resuelto" : "Resolved",
    ESCALATED: es ? "Escalado" : "Escalated",
    CLOSED: es ? "Cerrado" : "Closed",
  })[value] ?? value;

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{page?:string;pageSize?:string;q?:string;status?:string}> }) {
  const { locale: raw } = await params;
  const sp=await searchParams;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const q=(sp.q??"").trim().slice(0,120);
  const statuses=["OPEN","ASSIGNED","IN_PROGRESS","WAITING","RESOLVED","ESCALATED","CLOSED"];
  const status=statuses.includes(sp.status??"")?sp.status!:"";
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25",...(q?{q}:{}),...(status?{status}:{})});
  const data = await apiGet(`/v1/workspace/support/table?${qs}`);

  return (
    <div className="workspace-page">
      <WorkspaceSupportRealtime />

      <section className="workspace-page-head">
        <div>
          <h1>{es ? "Soporte" : "Support"}</h1>
          <p>
            {es
              ? "Cada ticket es una conversación única con Proofline. Evitamos duplicados y mantenemos estado, mensajes e historial sincronizados con Soporte y Control."
              : "Each ticket is a single conversation with Proofline. Duplicates are prevented while status, messages and history stay synchronized with Support and Control."}
          </p>
        </div>

        <div className="workspace-head-context">
          <span>{es ? "Tickets activos" : "Active tickets"}</span>
          <strong>{data.activeCount}</strong>
          {data.unreadCount > 0 ? (
            <small className="support-head-unread">
              {es ? `${data.unreadCount} con mensajes nuevos` : `${data.unreadCount} with new messages`}
            </small>
          ) : null}
        </div>
      </section>

      <section className="ws-r3-support-overview"><SupportCenter locale={locale} canRequestAccountChange={data.canRequestAccountChange}/><aside className="ws-r3-support-summary"><h2>{es?"Mis tickets":"My tickets"}</h2><p>{es?"Estado de tus solicitudes registradas.":"Status of your registered requests."}</p><a href={`/${locale}/support`}><span>{es?"Tickets activos":"Active tickets"}</span><strong>{data.activeCount}</strong></a><a href={`/${locale}/support?status=WAITING`}><span>{es?"Esperando respuesta":"Waiting for response"}</span><strong>{data.tickets.filter((t:any)=>t.status==="WAITING").length}</strong></a><a href={`/${locale}/support?status=RESOLVED`}><span>{es?"Resueltos en esta página":"Resolved on this page"}</span><strong>{data.tickets.filter((t:any)=>t.status==="RESOLVED").length}</strong></a><a href={`/${locale}/support`}><span>{es?"Tickets encontrados":"Matching tickets"}</span><strong>{data.pagination.total}</strong></a></aside></section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><h2>{es ? "Tus solicitudes" : "Your requests"}</h2></div>
        </div>

        <form className="workspace-list-filters" method="get" action={`/${locale}/support`} data-proofline-no-confirm="true" aria-label={es?"Filtrar tickets":"Filter tickets"}>
          <label>{es?"Buscar ticket":"Search tickets"}<input className="input" name="q" maxLength={120} defaultValue={q} placeholder={es?"Asunto o categoría":"Subject or category"}/></label>
          <label>{es?"Estado":"Status"}<select className="input" name="status" defaultValue={status}><option value="">{es?"Todos los estados":"All statuses"}</option>{statuses.map(v=><option key={v} value={v}>{statusLabel(v,es)}</option>)}</select></label>
          <button className="btn" type="submit">{es?"Filtrar":"Filter"}</button><a className="btn btn-ghost" href={`/${locale}/support`}>{es?"Limpiar":"Clear"}</a>
        </form>
        <div className="ws-r3-table-meta">{es?`Página ${data.pagination.page} de ${data.pagination.pages}`:`Page ${data.pagination.page} of ${data.pagination.pages}`}</div>
        <div className="support-ticket-list">
          {data.tickets.length ? data.tickets.map((ticket: any) => (
            <a className={`support-ticket-row${ticket.unread ? " is-unread" : ""}`} key={ticket.id} href={`/${locale}/support/${ticket.id}`}>
              <div className="support-ticket-primary">
                <div className="support-ticket-title-line">
                  <strong>{ticket.subject}</strong>
                  {ticket.unread ? (
                    <span className="support-unread-badge">
                      <i aria-hidden="true" />
                      {es ? "Nuevo mensaje" : "New message"}
                    </span>
                  ) : null}
                </div>
                <span>{ticket.category} · {ticket.priority}</span>
              </div>

              <div className="support-ticket-state">
                <b>{statusLabel(ticket.status, es)}</b>
                <span className={ticket.unread ? "support-ticket-unread-copy" : undefined}>
                  {ticket.unread
                    ? (es ? "Tienes una respuesta nueva de Proofline" : "You have a new reply from Proofline")
                    : ticket.canReply
                      ? (es ? "Proofline espera tu respuesta" : "Proofline is waiting for you")
                      : (es ? "En revisión por Proofline" : "Under review by Proofline")}
                </span>
                <span>{new Date(ticket.updatedAt).toLocaleString(locale)}</span>
              </div>

              <span aria-hidden="true">→</span>
            </a>
          )) : (
            <div className="support-empty">{q||status?(es?"No hay tickets que coincidan con los filtros.":"No tickets match the filters."):(es?"Todavía no hay tickets.":"No tickets yet.")}</div>
          )}
        </div>
        <PaginationBar pagination={data.pagination} basePath={`/${locale}/support`} query={{q,status}} locale={locale}/>
      </section>

      {data.changes.length ? (
        <section className="workspace-section">
          <div className="workspace-section-head"><div><h2>{es ? "Cambios de cuenta y contrato" : "Account & contract changes"}</h2></div></div>
          <div className="support-change-list">
            {data.changes.map((change: any) => (
              <div key={change.id}>
                <strong>{change.type}</strong>
                <span>{change.summary}</span>
                <b>{change.status}</b>
                <small>{new Date(change.createdAt).toLocaleDateString(locale)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
