import { normalizeLocale } from "@proofline/i18n";
import { supportGet } from "../../../../lib/api";
import { supportIdentity } from "../../../../lib/session";
import { Status, dateTime } from "../../../../components/support-ticket-ui";
import {
  addSupportMessage,
  assignSupportTicket,
  requestSupportInformation,
  updateAccountChangeStatus,
  updateTicketStatus,
} from "../../../actions";

function internalRoleLabel(role: string | undefined, es: boolean) {
  if (role === "INTERNAL_PLATFORM_OWNER") return es ? "Superadmin / Control" : "Superadmin / Control";
  if (role === "INTERNAL_SUPPORT") return es ? "Soporte" : "Support";
  if (role === "INTERNAL_OPERATIONS") return es ? "Operaciones" : "Operations";
  return role?.replaceAll("_", " ") ?? "";
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  const locale = normalizeLocale(p.locale);
  const es = locale === "es";
  const identity = await supportIdentity();
  const t = await supportGet(`/v1/control/support/tickets/${encodeURIComponent(p.id)}`);
  const mine = t.assignee?.email === identity.email;
  const activeDocumentRequest = t.documentRequests?.find((r: any) => r.status === "OPEN");

  return (
    <div className="support-stack">
      <section className="support-page-head">
        <div>
          <a className="support-back" href={`/${locale}`}>← {es ? "Cola de soporte" : "Support queue"}</a>
          <h1>{t.subject}</h1>
          <p>{t.organization.name} · {t.category} · {t.priority}</p>
        </div>
        <Status value={t.status} />
      </section>

      <div className="support-ticket-meta">
        <div><span>{es ? "Solicitante" : "Requester"}</span><strong>{t.requester?.displayName ?? "—"}</strong><small>{t.requester?.email ?? ""}</small></div>
        <div><span>{es ? "Responsable" : "Assignee"}</span><strong>{t.assignee?.displayName ?? (es ? "Sin adjudicar" : "Unassigned")}</strong><small>{mine ? (es ? "Asignado a ti" : "Assigned to you") : t.assignee?.email ?? ""}</small></div>
        <div><span>SLA</span><strong className={new Date(t.slaDueAt) < new Date() && !["RESOLVED", "CLOSED"].includes(t.status) ? "danger" : ""}>{dateTime(t.slaDueAt, locale)}</strong><small>{t.escalatedAt ? (es ? "Escalado" : "Escalated") : ""}</small></div>
        <div><span>{es ? "Creado" : "Created"}</span><strong>{dateTime(t.createdAt, locale)}</strong><small>{es ? "Última actividad" : "Last activity"}: {dateTime(t.updatedAt, locale)}</small></div>
      </div>

      <div className="support-actions">
        {!t.assignee ? (
          <form action={assignSupportTicket}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="support-button">{es ? "Adjudicarme ticket" : "Assign ticket to me"}</button>
          </form>
        ) : null}
        <form action={updateTicketStatus}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="locale" value={locale} />
          <select name="status" defaultValue={t.status}>
            <option>OPEN</option><option>ASSIGNED</option><option>IN_PROGRESS</option><option>WAITING</option><option>RESOLVED</option><option>ESCALATED</option><option>CLOSED</option>
          </select>
          <button className="support-button secondary">{es ? "Actualizar estado" : "Update status"}</button>
        </form>
      </div>

      {t.accountChangeRequest ? (
        <section className="support-panel">
          <h2>{es ? "Cambio de cuenta / contrato" : "Account / contract change"}</h2>
          <div className="support-change">
            <div>
              <Status value={t.accountChangeRequest.status} />
              <h3>{t.accountChangeRequest.type}</h3>
              <p>{t.accountChangeRequest.summary}</p>
              <pre>{JSON.stringify(t.accountChangeRequest.requestedData, null, 2)}</pre>
            </div>
            <form action={updateAccountChangeStatus}>
              <input type="hidden" name="id" value={t.accountChangeRequest.id} />
              <input type="hidden" name="ticketId" value={t.id} />
              <input type="hidden" name="locale" value={locale} />
              <select name="status" defaultValue={t.accountChangeRequest.status}>
                <option>REQUESTED</option><option>IN_REVIEW</option><option>NEEDS_INFO</option><option>APPROVED</option><option>REJECTED</option>
              </select>
              <textarea
                name="resolutionNote"
                placeholder={es
                  ? "Si eliges NEEDS_INFO, escribe exactamente qué debe aportar el cliente: se convertirá en mensaje del ticket y se enviará por email. Para otros estados, funciona como nota de revisión."
                  : "If you choose NEEDS_INFO, write exactly what the customer must provide: it becomes a ticket message and email. For other statuses, it remains a review note."}
                defaultValue={t.accountChangeRequest.resolutionNote ?? ""}
              />
              <label className="support-document-toggle">
                <input type="checkbox" name="requestDocument" />
                <span><strong>{es ? "Habilitar solicitud de documento" : "Enable document request"}</strong><small>{es ? "Solo se habilitará al cliente para esta solicitud. Máximo 5 MB." : "The customer is enabled only for this request. Maximum 5 MB."}</small></span>
              </label>
              <button className="support-button">{es ? "Aplicar revisión" : "Apply review"}</button>
            </form>
          </div>
        </section>
      ) : null}

      {t.status !== "CLOSED" ? (
        <section className="support-panel">
          <h2>{es ? "Solicitar información al cliente" : "Request information from customer"}</h2>
          <p>{es
            ? "Esta acción crea un mensaje real en la conversación, pone el ticket en espera del cliente, envía un correo y deja auditoría."
            : "This creates a real conversation message, puts the ticket in customer-waiting state, sends an email and records an audit event."}</p>
          <form action={requestSupportInformation} className="support-reply">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea name="body" required minLength={3} placeholder={es ? "Indica qué información necesitas…" : "Describe the information required…"} />
            <label className="support-document-toggle">
              <input type="checkbox" name="requestDocument" />
              <span><strong>{es ? "Habilitar solicitud de documento" : "Enable document request"}</strong><small>{es ? "El cliente verá el botón Adjuntar documento solo para esta petición. PDF, JPG, PNG o WEBP · máx. 5 MB." : "The customer sees Attach document only for this request. PDF, JPG, PNG or WEBP · max. 5 MB."}</small></span>
            </label>
            <div><button className="support-button">{es ? "Enviar solicitud al cliente" : "Send request to customer"}</button></div>
          </form>
        </section>
      ) : null}

      {activeDocumentRequest ? (
        <section className="support-panel support-document-request">
          <h2>{es ? "Documento solicitado al cliente" : "Document requested from customer"}</h2>
          <p>{activeDocumentRequest.instructions}</p>
          <small>{es ? "Pendiente de adjunto · máximo 5 MB · el cliente no puede adjuntar fuera de esta solicitud." : "Waiting for attachment · max. 5 MB · the customer cannot attach outside this request."}</small>
        </section>
      ) : null}

      <section className="support-panel">
        <h2>{es ? "Conversación" : "Conversation"}</h2>
        <div className="support-thread">
          {t.messages.map((m: any) => (
            <article key={m.id} className={m.visibility === "INTERNAL" ? "internal-note" : m.internalUser ? "agent" : "customer"}>
              <div>
                <strong>{m.internalUser?.displayName ?? m.user?.displayName ?? "—"}</strong>
                {m.internalUser?.role ? <small>{internalRoleLabel(m.internalUser.role, es)}</small> : null}
                <Status value={m.visibility} />
                <time>{dateTime(m.createdAt, locale)}</time>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
              {m.attachments?.length ? <div className="support-attachments">{m.attachments.map((a: any) => <a key={a.id} className="support-attachment-link" href={`/${locale}/tickets/${t.id}/attachments/${a.id}`}>↗ {es ? "Ver documento" : "View document"} · {a.originalFileName} · {(a.sizeBytes / 1024 / 1024).toFixed(2)} MB</a>)}</div> : null}
            </article>
          ))}
        </div>
        {t.status !== "CLOSED" ? (
          <form action={addSupportMessage} className="support-reply">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea name="body" required placeholder={es ? "Escribe una respuesta o una nota interna…" : "Write a reply or internal note…"} />
            <div>
              <select name="visibility" defaultValue="CUSTOMER">
                <option value="CUSTOMER">{es ? "Respuesta visible para cliente" : "Customer-visible reply"}</option>
                <option value="INTERNAL">{es ? "Nota interna" : "Internal note"}</option>
              </select>
              <button className="support-button">{es ? "Enviar mensaje" : "Send message"}</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="support-panel">
        <h2>{es ? "Historial del ticket" : "Ticket history"}</h2>
        {t.historyVisibleFrom ? <p>{es ? `Tu historial operativo es visible desde ${dateTime(t.historyVisibleFrom, locale)}.` : `Your operational history is visible from ${dateTime(t.historyVisibleFrom, locale)}.`}</p> : null}
        <div className="support-history">
          {t.history?.length ? t.history.map((h: any) => (
            <div key={h.id}>
              <span className="support-history-dot" />
              <div><strong>{h.action.replaceAll("_", " ")}</strong><span>{h.actorId} · {h.actorType}</span>{h.metadata && Object.keys(h.metadata).length ? <small>{JSON.stringify(h.metadata)}</small> : null}</div>
              <time>{dateTime(h.createdAt, locale)}</time>
            </div>
          )) : <p className="support-empty">{es ? "Sin eventos auditados todavía." : "No audited events yet."}</p>}
        </div>
      </section>
    </div>
  );
}
