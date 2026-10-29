import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../../lib/api";
import { reportDeliveryCounts, workspaceReportView } from "../../../../lib/report-view.mjs";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = normalizeLocale(raw), es = locale === "es";
  // The API resolves the tenant, assessment grant and report in one scoped query.
  const report = await apiGet(`/v1/workspace/reports/${encodeURIComponent(id)}`);
  const data = workspaceReportView(report.snapshot);
  const delivery = reportDeliveryCounts(report.deliveries);
  const state: Record<string,string> = es
    ? { DRAFT:"Borrador", APPROVED:"Aprobado", DISTRIBUTED:"Distribuido" }
    : { DRAFT:"Draft", APPROVED:"Approved", DISTRIBUTED:"Distributed" };
  const deliveryState: Record<string,string> = es
    ? { PENDING:"Pendiente", SENT:"Enviado", FAILED:"Fallido" }
    : { PENDING:"Pending", SENT:"Sent", FAILED:"Failed" };
  const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(es ? "es-ES" : "en-GB", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)) : "—";
  return <div className="workspace-page">
    <a className="workspace-back" href={`/${locale}/reports`}>← {es ? "Volver a informes" : "Back to reports"}</a>
    <section className="workspace-page-head">
      <div>
        <h1>{report.assessment.title}</h1>
        <p>{data.organization ? `${data.organization} · ` : ""}{es ? "Informe versionado: aprobación y envío se verifican por separado." : "Versioned report: approval and sending are verified separately."}</p>
      </div>
      <div className="workspace-head-context"><span>{data.level ?? report.kind} · v{report.version}</span><strong>{state[report.status] ?? report.status}</strong></div>
    </section>
    {data.synthetic ? <p className="workspace-alert danger">{es ? "Vista con datos sintéticos. No utilizar como evidencia real." : "Synthetic data. Do not use as real evidence."}</p> : null}
    <div className="report-result-summary">
      <div><span>{es ? "Participación" : "Participation"}</span><strong>{data.participationRate == null ? "—" : `${data.participationRate}%`}</strong><small>{data.completed == null || data.total == null ? "—" : `${data.completed}/${data.total}`}</small></div>
      <div><span>{es ? "Índice global" : "Overall score"}</span><strong>{data.overall ?? "—"}</strong><small>/100</small></div>
      <div className="wide"><span>{es ? "Resultado ejecutivo" : "Executive summary"}</span><p>{data.executive ?? (es ? "Este snapshot no contiene una conclusión ejecutiva." : "This snapshot has no executive summary.")}</p></div>
    </div>
    {data.dimensions.length ? <section className="workspace-section"><h2>{es ? "Dimensiones" : "Dimensions"}</h2><div className="report-dimensions">{data.dimensions.map((dimension, i) => <div key={`${dimension.name}-${i}`}><span>{dimension.name}</span><strong>{dimension.score == null ? "—" : `${dimension.score}/100`}</strong><i><b style={{width:`${Math.max(0,Math.min(100,dimension.score ?? 0))}%`}}/></i></div>)}</div></section> : null}
    <div className="workspace-report-evidence"><span>{es ? "Huella del snapshot" : "Snapshot fingerprint"}</span><code>{report.snapshotHash}</code><span>v{report.version}</span><span>{es ? "Aprobado" : "Approved"}: {date(report.approvedAt)}</span><span>{es ? "Distribución solicitada" : "Distribution requested"}: {date(report.distributedAt)}</span></div>
    <a className="btn btn-accent" href={`/api/proxy/v1/reports/${encodeURIComponent(id)}/pdf`} target="_blank" rel="noopener noreferrer">{es ? "Abrir PDF del informe" : "Open report PDF"}</a>
    <section className="workspace-section"><div className="workspace-section-head"><h2>{es ? "Estado de los envíos" : "Send status"}</h2><p>{es ? `${delivery.sent} enviados · ${delivery.pending} pendientes · ${delivery.failed} fallidos · ${delivery.total} destinatarios.` : `${delivery.sent} sent · ${delivery.pending} pending · ${delivery.failed} failed · ${delivery.total} recipients.`}</p></div><p className="workspace-report-status-note">{es ? "Enviado significa que el sistema procesó el mensaje; no demuestra que el destinatario lo leyera." : "Sent means the system processed the message; it does not prove the recipient read it."}</p>{delivery.total ? <div className="report-deliveries">{report.deliveries.map((item: any) => <div key={item.id}><strong>{item.recipient?.displayName ?? "—"}</strong><span>{item.recipient?.roleLabel ?? item.channel ?? "—"}</span><b>{deliveryState[item.status] ?? item.status}</b><small>{date(item.sentAt)}</small></div>)}</div> : <p className="workspace-report-delivery-empty">{es ? "Todavía no hay entregas registradas para esta versión." : "No deliveries have been recorded for this version."}</p>}</section>
  </div>;
}
