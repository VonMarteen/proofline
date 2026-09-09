import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../../../../lib/api";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string; attachmentId: string }> }) {
  const { locale: raw, id, attachmentId } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const ticket = await apiGet(`/v1/workspace/support/tickets/${encodeURIComponent(id)}`);
  const attachment = ticket.messages.flatMap((message: any) => message.attachments ?? []).find((item: any) => item.id === attachmentId);
  const closeHref = `/${locale}/support/${id}`;

  if (!attachment) {
    return (
      <div className="workspace-page">
        <a className="workspace-back" href={closeHref}>← {es ? "Volver al ticket" : "Back to ticket"}</a>
        <section className="workspace-section"><h2>{es ? "Documento no disponible" : "Document unavailable"}</h2></section>
      </div>
    );
  }

  const source = `/api/proxy/v1/workspace/support/tickets/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`;
  return (
    <div className="workspace-page document-viewer-page">
      <div className="document-viewer-toolbar">
        <div>
          <a className="workspace-back" href={closeHref}>← {es ? "Volver al ticket" : "Back to ticket"}</a>
          <h1>{attachment.originalFileName}</h1>
          <p>{attachment.mimeType} · {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <div className="document-viewer-actions">
          <a className="btn btn-accent" href={`${source}?download=1`}>{es ? "Descargar" : "Download"}</a>
          <a className="document-viewer-close" href={closeHref} aria-label={es ? "Cerrar visor" : "Close viewer"} title={es ? "Cerrar" : "Close"}>×</a>
        </div>
      </div>
      <div className="document-viewer-shell">
        <iframe className="document-viewer-frame" title={attachment.originalFileName} src={source} />
      </div>
    </div>
  );
}
