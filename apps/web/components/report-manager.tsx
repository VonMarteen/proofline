"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";

const LEVELS = ["L1_EXECUTIVE", "L2_DIAGNOSTIC", "L3_ANALYTICAL", "L4_STRATEGIC"] as const;
type Level = (typeof LEVELS)[number];

function levelLabel(level: string, es: boolean) {
  const labels: Record<string, string> = {
    L1_EXECUTIVE: es ? "L1 · Ejecutivo" : "L1 · Executive",
    L2_DIAGNOSTIC: es ? "L2 · Diagnóstico" : "L2 · Diagnostic",
    L3_ANALYTICAL: es ? "L3 · Analítico" : "L3 · Analytical",
    L4_STRATEGIC: es ? "L4 · Estratégico" : "L4 · Strategic",
    EXECUTIVE: es ? "L1 · Ejecutivo (histórico)" : "L1 · Executive (legacy)",
    FULL: es ? "L4 · Completo (histórico)" : "L4 · Full (legacy)",
  };
  return labels[level] ?? level;
}

export function ReportManager({ assessmentId, locale, reports, role }: { assessmentId: string; locale: "es" | "en"; reports: any[]; role: string }) {
  const es = locale === "es";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("L1_EXECUTIVE");
  const canGenerate = ["OWNER", "ADMIN", "ANALYST"].includes(role);
  const canApprove = ["OWNER", "REVIEWER"].includes(role);
  const canDistribute = role === "OWNER";

  async function post(path: string, body?: any, label?: string, tone: "default" | "danger" = "default") {
    if (busyReport) return;
    const ok = await requestProoflineConfirmation({
      title: es ? "Confirmar acción sobre informe" : "Confirm report action",
      message: es ? `¿Quieres continuar con “${label ?? "esta acción"}”?` : `Do you want to continue with “${label ?? "this action"}”?`,
      confirmLabel: label ?? (es ? "Continuar" : "Continue"),
      tone,
    });
    if (!ok) return;
    setBusyReport(path);
    try {
      const response = await fetch(`/api/proxy${path}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(Array.isArray(payload.message) ? payload.message.join(" · ") : payload.message ?? "Error");
        return;
      }
      setMessage("");
      router.refresh();
    } catch {
      setMessage(es ? "No se pudo completar la solicitud. Consulta el estado antes de reintentar." : "Request failed. Check the current status before retrying.");
    } finally { setBusyReport(null); }
  }

  return (
    <div className="report-manager">
      <div className="report-toolbar">
        <label className="report-level-select">
          <span>{es ? "Profundidad" : "Depth"}</span>
          <select className="select" value={level} onChange={(event) => setLevel(event.target.value as Level)}>
            {LEVELS.map((value) => <option key={value} value={value}>{levelLabel(value, es)}</option>)}
          </select>
        </label>
        <div className="report-actions">
          <a className="btn" href={`/${locale}/assessments/${assessmentId}/report-preview?synthetic=1&level=${level}`}>{es ? "Previsualizar" : "Preview"}</a>
          {canGenerate ? <button className="btn btn-accent" onClick={() => post(`/v1/assessments/${assessmentId}/reports`, { level }, es ? `Generar ${levelLabel(level, es)}` : `Generate ${levelLabel(level, es)}`)}>{es ? "Generar informe" : "Generate report"}</button> : null}
        </div>
      </div>

      <p className="report-contract-note">{es ? "Los cuatro niveles consumen el mismo snapshot canónico; cambia la profundidad, no los datos de origen." : "All four levels consume the same canonical snapshot; depth changes, source data does not."}</p>
      {message ? <div className="workspace-alert danger">{message}</div> : null}

      <div className="report-list">
        {reports.map((report) => {
          const reportLevel = report.level ?? report.kind;
          const deliveries = Array.isArray(report.deliveries) ? report.deliveries : [];
          const pending = deliveries.filter((d: any) => d.status === "PENDING").length;
          const failed = deliveries.filter((d: any) => d.status === "FAILED").length;
          const sent = deliveries.filter((d: any) => d.status === "SENT").length;
          const alreadyRequested = Boolean(report.distributedAt) || deliveries.length > 0;
          return (
            <article key={report.id}>
              <div>
                <strong>{levelLabel(reportLevel, es)}</strong>
                <span>v{report.version} · {report.status} · snapshot {String(report.snapshotHash ?? "").slice(0, 12)}</span>
                {alreadyRequested ? <small>{es ? `${sent} enviados · ${pending} pendientes · ${failed} fallidos` : `${sent} sent · ${pending} pending · ${failed} failed`}</small> : null}
              </div>
              <div className="workspace-card-actions">
                <a className="btn btn-small" href={`/${locale}/assessments/${assessmentId}/report-preview?reportId=${report.id}`}>{es ? "Vista" : "View"}</a>
                <a className="btn btn-small" href={`/api/proxy/v1/reports/${report.id}/pdf`} target="_blank">PDF</a>
                <a className="btn btn-small" href={`/api/proxy/v1/reports/${report.id}/export.csv`}>CSV</a>
                <a className="btn btn-small" href={`/api/proxy/v1/reports/${report.id}/export.json`}>JSON</a>
                {report.status === "DRAFT" && canApprove ? <button className="btn btn-accent btn-small" onClick={() => post(`/v1/reports/${report.id}/approve`, undefined, es ? "Aprobar informe" : "Approve report")}>{es ? "Aprobar" : "Approve"}</button> : null}
                {report.status === "APPROVED" && canDistribute && !alreadyRequested ? <button className="btn btn-accent btn-small" disabled={Boolean(busyReport)} onClick={() => post(`/v1/reports/${report.id}/distribute`, undefined, es ? "Distribuir informe" : "Distribute report")}>{es ? "Distribuir" : "Distribute"}</button> : null}
                {report.status === "APPROVED" && canDistribute && alreadyRequested && failed > 0 && pending === 0 ? <button className="btn btn-small" disabled={Boolean(busyReport)} onClick={() => post(`/v1/reports/${report.id}/retry-failed`, undefined, es ? `Reintentar ${failed} fallidos` : `Retry ${failed} failed`)}>{es ? `Reintentar ${failed} fallidos` : `Retry ${failed} failed`}</button> : null}
                {alreadyRequested && pending > 0 ? <span className="report-delivery-pending">{es ? "Envíos pendientes" : "Pending deliveries"}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
