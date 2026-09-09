import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../lib/api";
import { PaymentMethodManager } from "../../../components/payment-method-manager";

const statusLabel = (status: string, es: boolean) => ({
  OPEN: es ? "Pendiente" : "Open",
  PAID: es ? "Pagada" : "Paid",
  VOID: es ? "Anulada" : "Void",
  UNCOLLECTIBLE: es ? "Incobrable" : "Uncollectible",
}[status] ?? status.replaceAll("_", " "));

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const data = await apiGet("/v1/workspace/billing");

  if (!data.visible) return <div className="workspace-page">
    <section className="workspace-page-head"><div><h1>{es ? "Plan y uso" : "Plan and usage"}</h1><p>{es ? "Tu rol puede consultar capacidad operativa, pero no precios, facturas ni datos económicos." : "Your role can see operational capacity but not pricing, invoices or financial data."}</p></div></section>
    <div className="billing-capacity"><strong>{data.capacity.used}</strong><span>{es ? "participaciones facturables registradas en el periodo" : "billable participations recorded in the period"}</span></div>
  </div>;

  const [payments, invoices] = await Promise.all([
    apiGet("/v1/workspace/billing/payment-methods"),
    apiGet("/v1/workspace/billing/invoices"),
  ]);
  const entitlements = data.capacity.entitlements;

  return <div className="workspace-page">
    <section className="workspace-page-head">
      <div><h1>{es ? "Plan, uso y facturación" : "Plan, usage and billing"}</h1><p>{es ? "Consulta el plan, el consumo y tus facturas emitidas. Los documentos económicos sólo son visibles para roles autorizados." : "Review your plan, usage and issued invoices. Financial documents are visible only to authorized roles."}</p></div>
      <div className="workspace-head-context"><span>{data.subscription?.plan?.name ?? "—"}</span><strong>{data.subscription?.status ?? "—"}</strong></div>
    </section>

    <section className="billing-kpis">
      <article><span>{es ? "Uso del periodo" : "Period usage"}</span><strong>{data.capacity.used}</strong><small>{es ? "respuestas válidas completadas" : "valid completed responses"}</small></article>
      <article><span>{es ? "Allowance anual" : "Annual allowance"}</span><strong>{String(entitlements["participants.year.max"] ?? "—")}</strong><small>{es ? "participaciones incluidas" : "included participations"}</small></article>
      <article><span>{es ? "Cuota base" : "Base fee"}</span><strong>{data.subscription?.plan ? `${(data.subscription.plan.monthlyAmountCents / 100).toLocaleString(locale)} EUR` : "—"}</strong><small>{es ? "mensual" : "monthly"}</small></article>
    </section>

    <PaymentMethodManager locale={locale} data={payments} />

    <section className="workspace-section invoice-section">
      <div className="workspace-section-head clean"><div><h2>{es ? "Mis facturas" : "My invoices"}</h2><p>{es ? "Cada factura emitida puede abrirse primero en el visor seguro de PROOFLINE y descargarse sólo cuando lo necesites." : "Each issued invoice can be opened first in PROOFLINE's secure viewer and downloaded only when needed."}</p></div></div>
      {invoices.length ? <div className="workspace-invoice-table">
        <div className="workspace-invoice-row workspace-invoice-head"><span>{es ? "Factura" : "Invoice"}</span><span>{es ? "Emitida" : "Issued"}</span><span>{es ? "Estado" : "Status"}</span><span>{es ? "Base" : "Subtotal"}</span><span>{es ? "Impuestos" : "Tax"}</span><span>Total</span><span>{es ? "Documento" : "Document"}</span></div>
        {invoices.map((invoice: any) => {
          const number = invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id;
          const source = `/api/proxy/v1/workspace/billing/invoice-documents/${encodeURIComponent(invoice.id)}`;
          return <div className="workspace-invoice-row" key={invoice.id}>
            <strong>{number}</strong>
            <span>{new Date(invoice.issuedAt).toLocaleDateString(locale)}</span>
            <span className={`invoice-status status-${String(invoice.status).toLowerCase()}`}>{statusLabel(invoice.status, es)}</span>
            <span>{(invoice.amountCents / 100).toLocaleString(locale)} {invoice.currency}</span>
            <span>{(invoice.taxCents / 100).toLocaleString(locale)} {invoice.currency}</span>
            <strong>{((invoice.amountCents + invoice.taxCents) / 100).toLocaleString(locale)} {invoice.currency}</strong>
            <div className="invoice-actions"><a className="btn" href={`/${locale}/billing/invoices/${invoice.id}`}>{es ? "Ver" : "View"}</a><a className="btn btn-ghost" href={`${source}?download=1`}>{es ? "Descargar" : "Download"}</a></div>
          </div>;
        })}
      </div> : <div className="workspace-empty-state"><h3>{es ? "Todavía no hay facturas emitidas" : "No issued invoices yet"}</h3><p>{es ? "Cuando PROOFLINE emita una factura aparecerá aquí con su documento consultable y descargable." : "When PROOFLINE issues an invoice it will appear here with a viewable and downloadable document."}</p></div>}
    </section>

    <section className="workspace-section"><h2>{es ? "Justificación de uso" : "Usage ledger"}</h2><div className="usage-ledger">{data.usage.slice(0, 50).map((item: any) => <div key={item.id}><span>{new Date(item.occurredAt).toLocaleDateString(locale)}</span><strong>{item.eventType}</strong><span>{item.quantity} {item.unit}</span><b>{item.billable ? (es ? "Facturable" : "Billable") : (es ? "Incluido / no facturable" : "Included / non-billable")}</b></div>)}</div></section>
  </div>;
}
