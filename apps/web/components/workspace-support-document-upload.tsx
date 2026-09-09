"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

async function toBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export function WorkspaceSupportDocumentUpload({
  locale,
  ticketId,
  request,
}: {
  locale: "es" | "en";
  ticketId: string;
  request: { id: string; instructions: string; maxFileSizeBytes: number };
}) {
  const es = locale === "es";
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!file) return setError(es ? "Selecciona el documento solicitado." : "Select the requested document.");
    if (!ALLOWED.has(file.type)) return setError(es ? "Formato no permitido. Usa PDF, JPG, PNG o WEBP." : "Unsupported format. Use PDF, JPG, PNG or WEBP.");
    if (file.size > MAX_BYTES) return setError(es ? "El archivo supera el máximo de 5 MB." : "The file exceeds the 5 MB limit.");

    setBusy(true);
    try {
      const base64 = await toBase64(file);
      const response = await fetch(`/api/proxy/v1/workspace/support/tickets/${encodeURIComponent(ticketId)}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: request.id, fileName: file.name, mimeType: file.type, base64, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data?.message ?? (es ? "No se pudo adjuntar el documento." : "The document could not be attached.")));
      setFile(null);
      setNote("");
      setInputKey(value => value + 1);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (es ? "No se pudo adjuntar el documento." : "The document could not be attached."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="support-document-upload">
      <div className="support-document-upload-copy">
        <strong>{es ? "Proofline solicita un documento" : "Proofline requests a document"}</strong>
        <p>{request.instructions}</p>
        <small>{es ? "Carga habilitada únicamente para esta solicitud · PDF, JPG, PNG o WEBP · máximo 5 MB." : "Upload enabled only for this request · PDF, JPG, PNG or WEBP · maximum 5 MB."}</small>
      </div>
      <form onSubmit={submit}>
        <label className="label">
          {es ? "Documento" : "Document"}
          <input key={inputKey} className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} required />
        </label>
        <label className="label">
          {es ? "Comentario opcional" : "Optional note"}
          <textarea className="textarea" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} placeholder={es ? "Añade una aclaración si hace falta…" : "Add a note if needed…"} />
        </label>
        {file ? <div className="support-document-file"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div> : null}
        {error ? <div className="workspace-alert danger"><span>{error}</span></div> : null}
        <button className="btn btn-accent" disabled={busy || !file}>{busy ? (es ? "Adjuntando…" : "Uploading…") : (es ? "Adjuntar documento" : "Attach document")}</button>
      </form>
    </section>
  );
}
