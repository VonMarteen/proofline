import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const data = await controlGet("/v1/control/billing");
  const invoice = data.invoices.find((item: any) => item.id === id && item.status !== "DRAFT");

  if (!invoice) {
    return (
      <div className="control-stack">
        <a className="control-back" href={`/${locale}/billing`}>← {es ? "Volver a facturación" : "Back to billing"}</a>
        <section className="control-panel"><h2>{es ? "Factura no disponible" : "Invoice unavailable"}</h2></section>
      </div>
    );
  }

  const number = invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id;
  const source = `/api/billing/invoices/${encodeURIComponent(invoice.id)}`;
  const closeHref = `/${locale}/billing`;

  return (
    <div className="control-stack document-viewer-page">
      <div className="document-viewer-toolbar">
        <div>
          <a className="control-back" href={closeHref}>← {es ? "Volver a facturas emitidas" : "Back to issued invoices"}</a>
          <h1>{es ? "Factura" : "Invoice"} {number}</h1>
          <p>{invoice.organization.name} · {new Date(invoice.issuedAt).toLocaleDateString(locale)} · {eurText(invoice.amountCents + invoice.taxCents, invoice.currency, locale)}</p>
        </div>
        <div className="document-viewer-actions">
          <a className="control-button" href={`${source}?download=1`}>{es ? "Descargar PDF" : "Download PDF"}</a>
          <a className="document-viewer-close" href={closeHref} aria-label={es ? "Cerrar visor" : "Close viewer"} title={es ? "Cerrar" : "Close"}>×</a>
        </div>
      </div>
      <div className="document-viewer-shell invoice-viewer-shell">
        <iframe className="document-viewer-frame" title={`${es ? "Factura" : "Invoice"} ${number}`} src={source} />
      </div>
    </div>
  );
}

function eurText(cents: number, currency: string, locale: string) {
  return `${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
