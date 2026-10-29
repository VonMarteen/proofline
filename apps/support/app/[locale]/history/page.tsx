import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { supportGet } from "../../../lib/api";
import { Status, dateTime } from "../../../components/support-ticket-ui";

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{page?:string;pageSize?:string}> }) {
  const { locale: raw } = await params;
  const sp=await searchParams;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const qs=new URLSearchParams({view:"history",page:sp.page??"1",pageSize:sp.pageSize??"25"});
  const d = await supportGet(`/v1/control/tables/support?${qs}`);
  const rows = d.items as any[];

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
        <PaginationBar pagination={d.pagination} basePath={`/${locale}/history`} locale={locale}/>
      </section>
    </div>
  );
}
