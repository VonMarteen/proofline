import { normalizeLocale } from "@proofline/i18n";
import { Icon, PaginationBar, type ProoflineIconName } from "@proofline/ui";
import { supportGet } from "../../lib/api";
import { Status, dateTime, slaLabel } from "../../components/support-ticket-ui";

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; page?: string; pageSize?: string }>;
}) {
  const { locale: raw } = await params;
  const q = await searchParams;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const view = q.view ?? "open";
  const qs = new URLSearchParams({ view, page: q.page ?? "1", pageSize: q.pageSize ?? "25" });
  const d = await supportGet(`/v1/control/tables/support?${qs}`);
  const rows = d.items as any[];

  const metrics: { label: string; value: number; href: string; icon: ProoflineIconName }[] = [
    { label: es ? "Abiertos" : "Open", value: d.metrics.open, href: `/${locale}?view=open`, icon: "support" },
    { label: es ? "Sin adjudicar" : "Unassigned", value: d.metrics.unassigned, href: `/${locale}?view=unassigned`, icon: "people" },
    { label: es ? "SLA vencido" : "Past SLA", value: d.metrics.overdue, href: `/${locale}?view=overdue`, icon: "clock" },
    { label: es ? "Resueltos / cerrados" : "Resolved / closed", value: d.metrics.resolved, href: `/${locale}/history`, icon: "check-circle" },
  ];
  return (
    <div className="support-stack">
      <section className="support-page-head">
        <div>
          <h1>{es ? "Cola de soporte" : "Support queue"}</h1>
          <p>{es
            ? "Support y Backoffice operan sobre el mismo ticket, conversación e historial. Los cambios se sincronizan automáticamente."
            : "Support and Backoffice operate on the same ticket, conversation and history. Changes synchronize automatically."}</p>
        </div>
        <a className="support-button secondary" href={`/${locale}/history`}>{es ? "Ver histórico" : "View history"}</a>
      </section>
      <div className="support-metrics">
        {metrics.map(metric => (
          <a key={metric.href} href={metric.href}>
            <span className="support-metric-icon"><Icon name={metric.icon} size={17} /></span>
            <span className="support-metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
          </a>
        ))}
      </div>
      {d.metrics.saturationRisk > 0 ? (
        <div className="support-error">
          <strong>{es ? "Posible saturación o incidencia general" : "Possible saturation or broader incident"}</strong>
          <span>{es
            ? `${d.metrics.saturationRisk} tickets pertenecen a solicitantes con un volumen anormal de incidencias abiertas. Revisa si existe un problema común antes de tratarlos de forma aislada.`
            : `${d.metrics.saturationRisk} tickets belong to requesters with an unusual number of open issues. Check for a common incident before handling them separately.`}</span>
        </div>
      ) : null}
      <div className="support-filters" aria-label={es ? "Filtrar tickets" : "Filter tickets"}>
        <a className={view === "open" ? "active" : ""} href={`/${locale}`}>{es ? "Abiertos" : "Open"}</a>
        <a className={view === "mine" ? "active" : ""} href={`/${locale}?view=mine`}>{es ? "Mis tickets" : "Mine"}</a>
        <a className={view === "unassigned" ? "active" : ""} href={`/${locale}?view=unassigned`}>{es ? "Sin adjudicar" : "Unassigned"}</a>
        <a className={view === "overdue" ? "active" : ""} href={`/${locale}?view=overdue`}>{es ? "Fuera de SLA" : "Past SLA"}</a>
        <a className={view === "all" ? "active" : ""} href={`/${locale}?view=all`}>{es ? "Todos" : "All"}</a>
      </div>
      <section className="support-panel">
        {rows.length ? (
          <div className="support-table-wrap">
            <table>
              <thead><tr>
                <th>Ticket</th><th>{es ? "Organización" : "Organization"}</th><th>{es ? "Responsable" : "Assignee"}</th>
                <th>SLA</th><th>{es ? "Estado" : "Status"}</th><th>{es ? "Actividad" : "Activity"}</th>
              </tr></thead>
              <tbody>{rows.map(t => (
                <tr key={t.id} className={t.sla.overdue ? "is-overdue" : ""}>
                  <td>
                    <a className="support-ticket-link" href={`/${locale}/tickets/${t.id}`}>{t.subject}</a>
                    <small>{t.category} · {t.priority} · {t._count.messages} msgs</small>
                    {t.risk?.possibleSaturation ? <small className="danger">{es
                      ? `Volumen anormal · ${t.risk.requesterOpenTickets} abiertos`
                      : `Unusual volume · ${t.risk.requesterOpenTickets} open`}</small> : null}
                  </td>
                  <td><strong>{t.organization.name}</strong><small>{t.requester?.displayName ?? "—"}</small></td>
                  <td>{t.assignee ? <><strong>{t.assignee.displayName}</strong><small>{t.assignee.email}</small></>
                    : <span className="support-unassigned">{es ? "Sin adjudicar" : "Unassigned"}</span>}</td>
                  <td><strong className={t.sla.overdue ? "danger" : ""}>{slaLabel(t.sla, es)}</strong><small>{dateTime(t.slaDueAt, locale)}</small></td>
                  <td><Status value={t.status} /></td>
                  <td><small>{dateTime(t.updatedAt, locale)}</small></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="support-empty">{es ? "No hay tickets en esta vista." : "No tickets in this view."}</div>}
        <PaginationBar pagination={d.pagination} basePath={`/${locale}`} query={{ view }} locale={locale} />
      </section>
    </div>
  );
}
