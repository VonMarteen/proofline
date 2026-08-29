import { Icon } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";

export function EvidencePreview({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const rows = es
    ? [["Comunicación", 78], ["Reconocimiento", 72], ["Confianza", 64], ["Operaciones", 51]] as const
    : [["Communication", 78], ["Recognition", 72], ["Trust", 64], ["Operations", 51]] as const;

  return (
    <div className="product-preview" aria-label={es ? "Vista previa de Proofline con datos sintéticos" : "Proofline preview with synthetic data"}>
      <div className="product-window-bar">
        <div className="product-window-dots" aria-hidden="true"><span /><span /><span /></div>
        <span>proofline / executive brief</span>
        <div className="product-window-status"><i /> {es ? "Listo" : "Ready"}</div>
      </div>
      <div className="product-window-body">
        <aside className="product-preview-rail" aria-hidden="true">
          <div className="product-preview-mark"><span /><span /></div>
          <Icon name="overview" size={15} />
          <Icon name="assessments" size={15} />
          <Icon name="reports" size={15} />
          <Icon name="people" size={15} />
          <span className="product-preview-rail-spacer" />
          <Icon name="settings" size={15} />
        </aside>
        <div className="evidence-preview">
          <div className="evidence-preview-top">
            <div>
              <span className="preview-label">{es ? "Pregunta de decisión" : "Decision question"}</span>
              <h2>{es ? "¿Existen diferencias relevantes en la percepción del liderazgo?" : "Are there meaningful differences in leadership perception?"}</h2>
            </div>
            <div className="evidence-confidence">
              <Icon name="approved" size={15} />
              <span>{es ? "Evidencia alta" : "High evidence"}</span>
            </div>
          </div>
          <div className="evidence-answer">
            <span>{es ? "Respuesta ejecutiva" : "Executive answer"}</span>
            <p>{es
              ? "Sí. La señal se concentra en comunicación y reconocimiento; Operaciones muestra la brecha más consistente frente al resto de colectivos."
              : "Yes. The strongest signal appears in communication and recognition; Operations shows the most consistent gap versus other cohorts."}</p>
          </div>
          <div className="evidence-dashboard-grid">
            <div className="evidence-chart-card">
              <div className="evidence-card-label">{es ? "Señal por dimensión" : "Signal by dimension"}</div>
              <div className="evidence-chart">
                {rows.map(([label, value]) => (
                  <div className="evidence-row" key={label}>
                    <div className="evidence-row-label"><span>{label}</span><strong>{value}</strong></div>
                    <div className="evidence-track"><span style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="evidence-mini-insight">
              <span>{es ? "Brecha prioritaria" : "Priority gap"}</span>
              <strong>−18</strong>
              <p>{es ? "Operaciones vs. media global" : "Operations vs. global mean"}</p>
              <div className="mini-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="evidence-metrics">
            <div><strong>1.248</strong><span>{es ? "respuestas" : "responses"}</span></div>
            <div><strong>91/100</strong><span>{es ? "readiness" : "readiness"}</span></div>
            <div><strong>8 min</strong><span>{es ? "hasta el brief" : "to brief"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
