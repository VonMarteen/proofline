import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../../lib/api";
import { SupportReply } from "../../../../components/support-center";
import { WorkspaceSupportRealtime } from "../../../../components/workspace-support-realtime";
import { WorkspaceSupportMarkRead } from "../../../../components/workspace-support-mark-read";
import { WorkspaceSupportDocumentUpload } from "../../../../components/workspace-support-document-upload";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  const locale = normalizeLocale(p.locale);
  const es = locale === "es";
  const t = await apiGet(`/v1/workspace/support/tickets/${encodeURIComponent(p.id)}`);
  const documentRequest = t.documentRequests?.[0] ?? null;

  return (
    <div className="workspace-page">
      <WorkspaceSupportRealtime />
      <WorkspaceSupportMarkRead ticketId={t.id} readVersion={String(t.lastInternalReplyAt ?? t.updatedAt ?? "")} />
      <section className="workspace-detail-head">
        <a className="workspace-back" href={`/${locale}/support`}>← {es ? "Soporte" : "Support"}</a>
        <h1>{t.subject}</h1>
        <p>{t.category} · {t.priority} · {t.status}{t.assignee ? ` · ${es ? "Asignado a" : "Assigned to"} ${t.assignee.displayName}` : ""}</p>
      </section>

      {t.accountChangeRequest ? (
        <section className="support-change-banner">
          <strong>{es ? "Solicitud de cambio vinculada" : "Linked account change request"}</strong>
          <span>{t.accountChangeRequest.type} · {t.accountChangeRequest.status}</span>
          <p>{t.accountChangeRequest.summary}</p>
        </section>
      ) : null}

      {t.canReply ? (
        <section className="workspace-alert">
          <strong>{es ? "Proofline espera tu respuesta" : "Proofline is waiting for your response"}</strong>
          <span>{es
            ? "Revisa el último mensaje del equipo y responde desde este mismo ticket. Tu respuesta quedará sincronizada con Soporte y Superadmin."
            : "Review the latest team message and reply in this same ticket. Your response is synchronized with Support and Superadmin."}</span>
        </section>
      ) : null}

      {documentRequest ? <WorkspaceSupportDocumentUpload locale={locale} ticketId={t.id} request={documentRequest} /> : null}

      <section className="support-thread">
        {t.messages.map((m: any) => (
          <article key={m.id} className={m.internalUser ? "from-support" : "from-customer"}>
            <div><strong>{m.internalUser?.displayName ?? m.user?.displayName ?? (es ? "Usuario" : "User")}</strong><time>{new Date(m.createdAt).toLocaleString(locale)}</time></div>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
            {m.attachments?.length ? <div className="support-attachments">{m.attachments.map((a: any) => <a key={a.id} className="support-attachment-link" href={`/${locale}/support/${t.id}/attachments/${a.id}`}>↗ {es ? "Ver documento" : "View document"} · {a.originalFileName} · {(a.sizeBytes / 1024 / 1024).toFixed(2)} MB</a>)}</div> : null}
          </article>
        ))}
      </section>

      {t.status === "CLOSED" ? (
        <section className="workspace-alert"><strong>{es ? "Ticket cerrado" : "Ticket closed"}</strong><span>{es ? "Este ticket ya no admite respuestas. Si aparece una incidencia distinta, crea una nueva solicitud." : "This ticket no longer accepts replies. If a different issue appears, create a new request."}</span></section>
      ) : t.canReply ? (
        <SupportReply locale={locale} ticketId={t.id} />
      ) : (
        <section className="workspace-alert"><strong>{es ? "Esperando respuesta de Proofline" : "Waiting for Proofline"}</strong><span>{es ? "Ya has enviado la información disponible. Podrás responder de nuevo cuando Soporte o Control escriban en este ticket." : "You already sent the available information. You can reply again when Support or Control writes in this ticket."}</span></section>
      )}
    </div>
  );
}
