import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../../../lib/api";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const invoices = await apiGet("/v1/workspace/billing/invoices");
  const invoice = invoices.find((item: any) => item.id === id);

  if (!invoice) {
    return (
      <div className="workspace-page">
        <a className="workspace-back" href={`/${locale}/billing`}>← {es ? "Volver a facturación" : "Back to billing"}</a>
        <section className="workspace-section"><h2>{es ? "Factura no disponible" : "Invoice unavailable"}</h2></section>
      </div>
    );
  }

  const number = invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id;
  const source = `/api/proxy/v1/workspace/billing/invoice-documents/${encodeURIComponent(invoice.id)}`;
  const closeHref = `/${locale}/billing`;

  return (
    <div className="workspace-page document-viewer-page">
      <div className="document-viewer-toolbar">
        <div>
          <a className="workspace-back" href={closeHref}>← {es ? "Volver a Mis facturas" : "Back to My invoices"}</a>
          <h1>{es ? "Factura" : "Invoice"} {number}</h1>
          <p>{new Date(invoice.issuedAt).toLocaleDateString(locale)} · {((invoice.amountCents + invoice.taxCents) / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.currency}</p>
        </div>
        <div className="document-viewer-actions">
          <a className="btn btn-accent" href={`${source}?download=1`}>{es ? "Descargar PDF" : "Download PDF"}</a>
          <a className="document-viewer-close" href={closeHref} aria-label={es ? "Cerrar visor" : "Close viewer"} title={es ? "Cerrar" : "Close"}>×</a>
        </div>
      </div>
      <div className="document-viewer-shell invoice-viewer-shell">
        <iframe className="document-viewer-frame" title={`${es ? "Factura" : "Invoice"} ${number}`} src={source} />
      </div>
    </div>
  );
}
