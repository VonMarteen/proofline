import { normalizeLocale } from "@proofline/i18n";
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

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const data = await apiGet("/v1/workspace/support");

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
          <strong>{data.tickets.filter((ticket: any) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length}</strong>
          {data.unreadCount > 0 ? (
            <small className="support-head-unread">
              {es ? `${data.unreadCount} con mensajes nuevos` : `${data.unreadCount} with new messages`}
            </small>
          ) : null}
        </div>
      </section>

      <SupportCenter locale={locale} canRequestAccountChange={data.canRequestAccountChange} />

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><h2>{es ? "Tus solicitudes" : "Your requests"}</h2></div>
        </div>

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
            <div className="support-empty">{es ? "Todavía no hay tickets." : "No tickets yet."}</div>
          )}
        </div>
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
