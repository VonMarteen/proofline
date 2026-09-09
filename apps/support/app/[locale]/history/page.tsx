import { normalizeLocale } from "@proofline/i18n";
import { supportGet } from "../../../lib/api";
import { Status, dateTime } from "../../../components/support-ticket-ui";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const d = await supportGet("/v1/control/support");
  const rows = (d.tickets as any[])
    .filter(t => ["RESOLVED", "CLOSED"].includes(t.status))
    .sort((a, b) => new Date(b.resolvedAt ?? b.closedAt ?? b.updatedAt).getTime() - new Date(a.resolvedAt ?? a.closedAt ?? a.updatedAt).getTime());

  return (
    <div className="support-stack">
      <section className="support-page-head">
        <div>
          <h1>{es ? "Histórico de tickets" : "Ticket history"}</h1>
          <p>{d.historyVisibleFrom
            ? (es
                ? `Tu histórico operativo comienza en tu fecha de alta (${dateTime(d.historyVisibleFrom, locale)}). Los tickets activos anteriores siguen siendo visibles cuando necesitas contexto o trabajas sobre ellos.`
                : `Your operational history starts on your activation date (${dateTime(d.historyVisibleFrom, locale)}). Older active tickets remain visible when you need context or work on them.`)
            : (es
                ? "Vista completa de tickets resueltos y cerrados, con responsable, tiempos y trazabilidad."
                : "Complete view of resolved and closed tickets with assignee, timing and traceability.")}</p>
        </div>
        <a className="support-button secondary" href={`/${locale}`}>{es ? "Volver a la cola" : "Back to queue"}</a>
      </section>

      <section className="support-panel">
        {rows.length ? (
          <div className="support-table-wrap">
            <table>
              <thead><tr><th>Ticket</th><th>{es ? "Organización" : "Organization"}</th><th>{es ? "Responsable" : "Assignee"}</th><th>{es ? "Estado" : "Status"}</th><th>{es ? "Resuelto / cerrado" : "Resolved / closed"}</th></tr></thead>
              <tbody>{rows.map(t => (
                <tr key={t.id}>
                  <td><a className="support-ticket-link" href={`/${locale}/tickets/${t.id}`}>{t.subject}</a><small>{t.category} · {t.priority}</small></td>
                  <td>{t.organization.name}</td>
                  <td>{t.assignee?.displayName ?? "—"}</td>
                  <td><Status value={t.status} /></td>
                  <td>{dateTime(t.closedAt ?? t.resolvedAt ?? t.updatedAt, locale)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="support-empty">{es ? "Aún no hay tickets resueltos visibles para tu histórico." : "There are no resolved tickets visible in your history yet."}</div>}
      </section>
    </div>
  );
}
