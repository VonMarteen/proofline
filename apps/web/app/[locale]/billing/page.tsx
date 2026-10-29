import "./billing-ledger-filters.css";
import { normalizeLocale } from "@proofline/i18n";
import { Icon, PaginationBar } from "@proofline/ui";
import { apiGet } from "../../../lib/api";
import { PaymentMethodManager } from "../../../components/payment-method-manager";

const statusLabel = (status: string, es: boolean) => ({
  OPEN: es ? "Pendiente" : "Open",
  PAID: es ? "Pagada" : "Paid",
  VOID: es ? "Anulada" : "Void",
  UNCOLLECTIBLE: es ? "Incobrable" : "Uncollectible",
}[status] ?? status.replaceAll("_", " "));

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ invoicePage?: string; invoicePageSize?: string; usagePage?: string; usagePageSize?: string; period?: string; eventType?: string; billable?: string }> }) {
  const { locale: raw } = await params;
  const sp = await searchParams;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const data = await apiGet("/v1/workspace/billing");

  if (!data.visible) return <div className="workspace-page">
    <section className="workspace-page-head"><div><h1>{es ? "Plan y uso" : "Plan and usage"}</h1><p>{es ? "Tu rol puede consultar capacidad operativa, pero no precios, facturas ni datos económicos." : "Your role can see operational capacity but not pricing, invoices or financial data."}</p></div></section>
    <div className="billing-capacity"><strong>{data.capacity.used}</strong><span>{es ? "participaciones facturables registradas en el periodo" : "billable participations recorded in the period"}</span></div>
  </div>;

  const invoicePage=sp.invoicePage??"1",invoicePageSize=sp.invoicePageSize??"25",usagePage=sp.usagePage??"1",usagePageSize=sp.usagePageSize??"25";
  const period=/^\d{4}-(0[1-9]|1[0-2])$/.test(sp.period??"")?sp.period!:"";
  const eventType=["RESPONSE_COMPLETED","ASSESSMENT_LAUNCHED"].includes(sp.eventType??"")?sp.eventType!:"";
  const billable=["true","false"].includes(sp.billable??"")?sp.billable!:"";
  const usageFilters={...(period?{period}:{}),...(eventType?{eventType}:{}),...(billable?{billable}:{})};
  const [payments, invoices, usage] = await Promise.all([
    apiGet("/v1/workspace/billing/payment-methods"),
    apiGet(`/v1/workspace/billing/invoices/table?${new URLSearchParams({page:invoicePage,pageSize:invoicePageSize})}`),
    apiGet(`/v1/workspace/billing/usage/table?${new URLSearchParams({page:usagePage,pageSize:usagePageSize,...usageFilters})}`),
  ]);
  const entitlements = data.capacity.entitlements;

  return <div className="workspace-page">
    <section className="workspace-page-head">
      <div><h1>{es ? "Plan, uso y facturación" : "Plan, usage and billing"}</h1><p>{es ? "Consulta el plan, el consumo y tus facturas emitidas. Los documentos económicos sólo son visibles para roles autorizados." : "Review your plan, usage and issued invoices. Financial documents are visible only to authorized roles."}</p></div>
      <div className="workspace-head-context"><span>{data.subscription?.plan?.name ?? "—"}</span><strong>{data.subscription?.status ?? "—"}</strong></div>
    </section>

    <section className="billing-kpis">
      <article><span>{es ? "Uso del periodo" : "Period usage"}</span><span className="ws-r6-billing-icon"><Icon name="people" size={16}/></span><strong>{data.capacity.used}</strong><small>{es ? "respuestas válidas completadas" : "valid completed responses"}</small></article>
      <article><span>{es ? "Allowance anual" : "Annual allowance"}</span><span className="ws-r6-billing-icon"><Icon name="database" size={16}/></span><strong>{String(entitlements["participants.year.max"] ?? "—")}</strong><small>{es ? "participaciones incluidas" : "included participations"}</small></article>
      <article><span>{es ? "Cuota base" : "Base fee"}</span><span className="ws-r6-billing-icon"><Icon name="wallet" size={16}/></span><strong>{data.subscription?.plan ? `${(data.subscription.plan.monthlyAmountCents / 100).toLocaleString(locale)} EUR` : "—"}</strong><small>{es ? "mensual" : "monthly"}</small></article>
      <article><span>{es ? "Facturas emitidas" : "Issued invoices"}</span><span className="ws-r6-billing-icon"><Icon name="reports" size={16}/></span><strong>{invoices.pagination.total}</strong><small>{es?"Total registrado":"Recorded total"}</small></article>
      <article><span>{es?"Eventos de uso":"Usage events"}</span><span className="ws-r6-billing-icon"><Icon name="activity" size={16}/></span><strong>{usage.pagination.total}</strong><small>{es?"Para los filtros aplicados":"For applied filters"}</small></article>
      <article><span>{es?"Estado del plan":"Plan status"}</span><span className="ws-r6-billing-icon"><Icon name="check-circle" size={16}/></span><strong>{data.subscription?.status??"—"}</strong><small>{data.subscription?.plan?.name??"—"}</small></article>
    </section>

    <PaymentMethodManager locale={locale} data={payments} />

    <section className="workspace-section invoice-section">
      <div className="workspace-section-head clean"><div><h2>{es ? "Mis facturas" : "My invoices"}</h2></div></div>
      <div className="ws-r3-table-meta">{es?`Página ${invoices.pagination.page} de ${invoices.pagination.pages}`:`Page ${invoices.pagination.page} of ${invoices.pagination.pages}`}</div>
      {invoices.items.length ? <div className="workspace-invoice-table">
        <div className="workspace-invoice-row workspace-invoice-head"><span>{es ? "Factura" : "Invoice"}</span><span>{es ? "Emitida" : "Issued"}</span><span>{es ? "Estado" : "Status"}</span><span>{es ? "Base" : "Subtotal"}</span><span>{es ? "Impuestos" : "Tax"}</span><span>Total</span><span>{es ? "Documento" : "Document"}</span></div>
        {invoices.items.map((invoice: any) => {
          const number = invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id;
          const source = `/api/proxy/v1/workspace/billing/invoice-documents/${encodeURIComponent(invoice.id)}`;
          return <div className="workspace-invoice-row" key={invoice.id}><strong>{number}</strong><span>{new Date(invoice.issuedAt).toLocaleDateString(locale)}</span><span className={`invoice-status status-${String(invoice.status).toLowerCase()}`}>{statusLabel(invoice.status, es)}</span><span>{(invoice.amountCents / 100).toLocaleString(locale)} {invoice.currency}</span><span>{(invoice.taxCents / 100).toLocaleString(locale)} {invoice.currency}</span><strong>{((invoice.amountCents + invoice.taxCents) / 100).toLocaleString(locale)} {invoice.currency}</strong><div className="invoice-actions"><a className="btn" href={`/${locale}/billing/invoices/${invoice.id}`}>{es ? "Ver" : "View"}</a><a className="btn btn-ghost" href={`${source}?download=1`}>{es ? "Descargar" : "Download"}</a></div></div>;
        })}
        <PaginationBar pagination={invoices.pagination} basePath={`/${locale}/billing`} query={{usagePage,usagePageSize,...usageFilters}} locale={locale} pageParam="invoicePage" pageSizeParam="invoicePageSize"/>
      </div> : <><div className="workspace-empty-state"><h3>{es ? "Todavía no hay facturas emitidas" : "No issued invoices yet"}</h3></div><PaginationBar pagination={invoices.pagination} basePath={`/${locale}/billing`} query={{usagePage,usagePageSize,...usageFilters}} locale={locale} pageParam="invoicePage" pageSizeParam="invoicePageSize"/></>}
    </section>

    <section className="workspace-section"><div className="workspace-section-head clean"><h2>{es ? "Justificación de uso" : "Usage ledger"}</h2><span className="muted">{usage.pagination.total} {es?"registros coincidentes":"matching records"}</span></div>
      <form method="get" action={`/${locale}/billing`} className="workspace-filter-form" aria-label={es?"Filtrar consumo":"Filter usage"}>
        <input type="hidden" name="invoicePage" value={invoicePage}/><input type="hidden" name="invoicePageSize" value={invoicePageSize}/>
        <label>{es?"Período":"Period"}<input className="input" type="month" name="period" defaultValue={period}/></label>
        <label>{es?"Evento":"Event"}<select className="input" name="eventType" defaultValue={eventType}><option value="">{es?"Todos los eventos":"All events"}</option><option value="RESPONSE_COMPLETED">{es?"Respuesta completada":"Response completed"}</option><option value="ASSESSMENT_LAUNCHED">{es?"Assessment lanzado":"Assessment launched"}</option></select></label>
        <label>{es?"Facturación":"Billing"}<select className="input" name="billable" defaultValue={billable}><option value="">{es?"Todos":"All"}</option><option value="true">{es?"Facturable":"Billable"}</option><option value="false">{es?"No facturable":"Non-billable"}</option></select></label>
        <button className="btn" type="submit">{es?"Filtrar":"Filter"}</button><a className="btn btn-ghost" href={`/${locale}/billing?${new URLSearchParams({invoicePage,invoicePageSize})}`}>{es?"Limpiar":"Clear"}</a>
      </form>
      <div className="ws-r3-table-meta">{es?`Página ${usage.pagination.page} de ${usage.pagination.pages}`:`Page ${usage.pagination.page} of ${usage.pagination.pages}`}</div>
      <div className="usage-ledger">{usage.items.map((item: any) => <div key={item.id}><span>{new Date(item.occurredAt).toLocaleDateString(locale)}</span><strong>{item.eventType}</strong><span>{item.quantity} {item.unit}</span><b>{item.billable ? (es ? "Facturable" : "Billable") : (es ? "Incluido / no facturable" : "Included / non-billable")}</b></div>)}{!usage.items.length?<p className="workspace-empty-state">{es?"No hay eventos para estos filtros.":"No usage events match these filters."}</p>:null}</div><PaginationBar pagination={usage.pagination} basePath={`/${locale}/billing`} query={{invoicePage,invoicePageSize,...usageFilters}} locale={locale} pageParam="usagePage" pageSizeParam="usagePageSize"/></section>
  </div>;
}
