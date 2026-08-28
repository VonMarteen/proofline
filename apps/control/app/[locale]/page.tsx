import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../lib/api";
import { Metric, PageIntro, Panel, Status, dateTime, eur } from "../../components/control-ui";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params; const locale = normalizeLocale(raw); const es = locale === "es";
  const d = await controlGet("/v1/control/overview");
  const participantPct = d.counts.participants ? Math.round((d.counts.completedParticipants / d.counts.participants) * 100) : 0;
  return <div className="control-stack">
    <PageIntro title={es ? "Estado de la plataforma" : "Platform status"} text={es ? "Negocio, clientes, producto y operación en una sola vista. Las respuestas individuales no forman parte de este panel." : "Business, customers, product and operations in one view. Individual answers are never part of this dashboard."}/>
    <div className="control-metrics control-metrics-4">
      <Metric label={es ? "Organizaciones" : "Organizations"} value={d.counts.organizations} note={`${d.counts.activeAssessments} ${es ? "assessments activos" : "active assessments"}`}/>
      <Metric label="MRR" value={eur(d.finance.mrrCents, locale)} note={`ARR ${eur(d.finance.arrCents, locale)}`}/>
      <Metric label={es ? "Uso facturable del mes" : "Billable usage this month"} value={d.finance.billableUnits.toLocaleString(locale)} note={d.period}/>
      <Metric label={es ? "Participación completada" : "Completed participation"} value={`${participantPct}%`} note={`${d.counts.completedParticipants}/${d.counts.participants}`}/>
    </div>
    <div className="control-grid-2">
      <Panel title={es ? "Atención operativa" : "Operational attention"}>
        <div className="control-attention-list">
          <a href={`/${locale}/operations`}><span>{es ? "Jobs pendientes" : "Pending jobs"}</span><strong>{d.operations.pendingJobs}</strong></a>
          <a href={`/${locale}/operations`}><span>{es ? "Jobs fallidos" : "Failed jobs"}</span><strong className={d.operations.failedJobs ? "danger-text" : ""}>{d.operations.failedJobs}</strong></a>
          <a href={`/${locale}/operations`}><span>{es ? "Análisis pendientes" : "Pending analyses"}</span><strong>{d.operations.pendingAnalysis}</strong></a>
          <a href={`/${locale}/support`}><span>{es ? "Tickets abiertos" : "Open tickets"}</span><strong>{d.counts.openTickets}</strong></a>
          <a href={`/${locale}/privacy`}><span>{es ? "Retención en próximos 30 días" : "Retention due in 30 days"}</span><strong>{d.counts.retentionDue30d}</strong></a>
          <a href={`/${locale}/privacy`}><span>{es ? "Legal holds activos" : "Active legal holds"}</span><strong>{d.counts.activeLegalHolds}</strong></a>
        </div>
      </Panel>
      <Panel title={es ? "Salud del sistema" : "System health"}>
        <div className="control-health-grid">{Object.entries(d.system).map(([key, value]) => <div key={key}><span>{key}</span><Status value={String(value)}/></div>)}</div>
      </Panel>
    </div>
    <div className="control-grid-2">
      <Panel title={es ? "Facturación" : "Billing"}>
        <div className="control-row-metrics">
          <Metric label={es ? "Pendiente de cobro" : "Open invoices"} value={eur(d.finance.openInvoiceCents, locale)} />
          <Metric label={es ? "Facturas abiertas" : "Open invoices"} value={d.finance.openInvoices} />
          <Metric label={es ? "Suscripciones past due" : "Past-due subscriptions"} value={d.finance.pastDueSubscriptions} />
        </div>
      </Panel>
      <Panel title={es ? "Producto" : "Product"}>
        <div className="control-row-metrics">
          <Metric label={es ? "Assessments activos" : "Active assessments"} value={d.counts.activeAssessments}/>
          <Metric label={es ? "Assessments cerrados" : "Closed assessments"} value={d.counts.completedAssessments}/>
          <Metric label={es ? "Informes en borrador" : "Draft reports"} value={d.operations.draftReports}/>
        </div>
      </Panel>
    </div>
    <Panel title={es ? "Actividad privilegiada reciente" : "Recent privileged activity"}>
      {d.recentAudit.length ? <div className="control-activity">{d.recentAudit.map((a:any) => <div key={a.id}><div><strong>{a.action}</strong><span>{a.organization ?? a.targetType}</span></div><time>{dateTime(a.createdAt, locale)}</time></div>)}</div> : <p className="control-empty">{es ? "Todavía no hay actividad privilegiada registrada." : "No privileged activity has been recorded yet."}</p>}
    </Panel>
  </div>;
}
