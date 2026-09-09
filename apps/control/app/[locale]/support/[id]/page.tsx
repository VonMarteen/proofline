import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../../components/control-ui";
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
  const t = await controlGet(`/v1/control/support/tickets/${encodeURIComponent(p.id)}`);
  const activeDocumentRequest = t.documentRequests?.find((r: any) => r.status === "OPEN");

  return (
    <div className="control-stack">
      <PageIntro title={t.subject} text={`${t.organization.name} · ${t.category} · ${t.priority}`} />

      <div className="control-ticket-meta">
        <div><span>{es ? "Estado" : "Status"}</span><Status value={t.status} /></div>
        <div><span>{es ? "Responsable" : "Assignee"}</span><strong>{t.assignee?.displayName ?? (es ? "Sin adjudicar" : "Unassigned")}</strong></div>
        <div><span>SLA</span><strong>{dateTime(t.slaDueAt, locale)}</strong></div>
        <div><span>{es ? "Solicitante" : "Requester"}</span><strong>{t.requester?.displayName ?? "—"}</strong></div>
      </div>

      <div className="control-compact-actions">
        {!t.assignee ? (
          <form action={assignSupportTicket}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="control-button">{es ? "Adjudicarme ticket" : "Assign ticket to me"}</button>
          </form>
        ) : null}
        <form action={updateTicketStatus} className="control-inline-form">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="locale" value={locale} />
          <select className="control-select" name="status" defaultValue={t.status}>
            <option>OPEN</option><option>ASSIGNED</option><option>IN_PROGRESS</option><option>WAITING</option><option>RESOLVED</option><option>ESCALATED</option><option>CLOSED</option>
          </select>
          <button className="control-button">{es ? "Actualizar estado" : "Update status"}</button>
        </form>
      </div>

      {t.accountChangeRequest ? (
        <Panel title={es ? "Cambio de cuenta / contrato" : "Account / contract change"}>
          <div className="control-change-request">
            <div>
              <strong>{t.accountChangeRequest.type}</strong>
              <p>{t.accountChangeRequest.summary}</p>
              <pre className="control-json">{JSON.stringify(t.accountChangeRequest.requestedData, null, 2)}</pre>
            </div>
            <form action={updateAccountChangeStatus} className="control-change-form">
              <input type="hidden" name="id" value={t.accountChangeRequest.id} />
              <input type="hidden" name="ticketId" value={t.id} />
              <input type="hidden" name="locale" value={locale} />
              <select className="control-select" name="status" defaultValue={t.accountChangeRequest.status}>
                <option>REQUESTED</option><option>IN_REVIEW</option><option>NEEDS_INFO</option><option>APPROVED</option><option>REJECTED</option><option>APPLIED</option>
              </select>
              <textarea
                className="control-textarea"
                name="resolutionNote"
                placeholder={es
                  ? "Si eliges NEEDS_INFO, este texto se enviará al cliente como mensaje + email y luego se vaciará de este campo. Para otros estados, queda como nota de revisión."
                  : "If you choose NEEDS_INFO, this text is sent to the customer as a message + email and then cleared here. For other statuses it remains a review note."}
                defaultValue={t.accountChangeRequest.resolutionNote ?? ""}
              />
              <label className="control-document-toggle">
                <input type="checkbox" name="requestDocument" />
                <span><strong>{es ? "Habilitar solicitud de documento" : "Enable document request"}</strong><small>{es ? "Solo se habilitará al cliente para esta solicitud. Máximo 5 MB." : "The customer is enabled only for this request. Maximum 5 MB."}</small></span>
              </label>
              <button className="control-button">{es ? "Aplicar revisión" : "Apply review"}</button>
            </form>
          </div>
        </Panel>
      ) : null}

      {t.status !== "CLOSED" ? (
        <Panel title={es ? "Solicitar información al cliente" : "Request information from customer"}>
          <p>{es
            ? "Genera una entrada real en el ticket, la hace visible en el Workspace, pone el ticket en espera del cliente, envía email y registra auditoría."
            : "Creates a real ticket entry, makes it visible in Workspace, waits for the customer, sends email and records audit history."}</p>
          <form action={requestSupportInformation} className="control-support-reply">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea className="control-textarea" name="body" required minLength={3} placeholder={es ? "Indica qué información necesitas…" : "Describe the information required…"} />
            <label className="control-document-toggle">
              <input type="checkbox" name="requestDocument" />
              <span><strong>{es ? "Habilitar solicitud de documento" : "Enable document request"}</strong><small>{es ? "El cliente verá Adjuntar documento solo para esta petición. PDF, JPG, PNG o WEBP · máx. 5 MB." : "The customer sees Attach document only for this request. PDF, JPG, PNG or WEBP · max. 5 MB."}</small></span>
            </label>
            <div><button className="control-button">{es ? "Enviar solicitud al cliente" : "Send request to customer"}</button></div>
          </form>
        </Panel>
      ) : null}

      {activeDocumentRequest ? (
        <Panel title={es ? "Documento solicitado al cliente" : "Document requested from customer"}>
          <div className="control-document-request"><strong>{activeDocumentRequest.instructions}</strong><span>{es ? "Pendiente de adjunto · máximo 5 MB · carga habilitada únicamente para esta solicitud." : "Waiting for attachment · max. 5 MB · upload enabled only for this request."}</span></div>
        </Panel>
      ) : null}

      <Panel title={es ? "Conversación" : "Conversation"}>
        <div className="control-support-thread">
          {t.messages.map((m: any) => (
            <article key={m.id} className={m.visibility === "INTERNAL" ? "internal-note" : m.internalUser ? "agent-message" : "customer-message"}>
              <div>
                <strong>{m.internalUser?.displayName ?? m.user?.displayName ?? "—"}</strong>
                {m.internalUser?.role ? <small>{internalRoleLabel(m.internalUser.role, es)}</small> : null}
                <Status value={m.visibility} />
                <time>{dateTime(m.createdAt, locale)}</time>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
              {m.attachments?.length ? <div className="control-attachments">{m.attachments.map((a: any) => <a key={a.id} className="control-attachment-link" href={`/${locale}/support/${t.id}/attachments/${a.id}`}>↗ {es ? "Ver documento" : "View document"} · {a.originalFileName} · {(a.sizeBytes / 1024 / 1024).toFixed(2)} MB</a>)}</div> : null}
            </article>
          ))}
        </div>
      </Panel>

      <Panel title={es ? "Historial del ticket" : "Ticket history"}>
        <div className="control-ticket-history">
          {t.history?.length ? t.history.map((h: any) => (
            <div key={h.id}>
              <div><strong>{h.action.replaceAll("_", " ")}</strong><span>{h.actorId} · {h.actorType}</span>{h.metadata && Object.keys(h.metadata).length ? <small>{JSON.stringify(h.metadata)}</small> : null}</div>
              <time>{dateTime(h.createdAt, locale)}</time>
            </div>
          )) : <p className="control-empty">{es ? "No hay eventos auditados todavía." : "No audited events yet."}</p>}
        </div>
      </Panel>

      {t.status !== "CLOSED" ? (
        <Panel title={es ? "Responder o añadir nota" : "Reply or add note"}>
          <form action={addSupportMessage} className="control-support-reply">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea className="control-textarea" name="body" required placeholder={es ? "Escribe una respuesta o una nota interna…" : "Write a reply or internal note…"} />
            <div>
              <select className="control-select" name="visibility" defaultValue="CUSTOMER">
                <option value="CUSTOMER">{es ? "Respuesta visible para cliente" : "Customer-visible reply"}</option>
                <option value="INTERNAL">{es ? "Nota interna" : "Internal note"}</option>
              </select>
              <button className="control-button">{es ? "Enviar mensaje" : "Send message"}</button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
