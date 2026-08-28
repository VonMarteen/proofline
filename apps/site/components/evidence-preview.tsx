import type { Locale } from "@proofline/i18n";

export function EvidencePreview({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const rows = es
    ? [["Comunicación", 78], ["Reconocimiento", 72], ["Confianza", 64], ["Operaciones", 51]] as const
    : [["Communication", 78], ["Recognition", 72], ["Trust", 64], ["Operations", 51]] as const;

  return (
    <div className="evidence-preview" aria-label={es ? "Vista previa de resultados con datos sintéticos" : "Result preview with synthetic data"}>
      <div className="evidence-preview-top">
        <div>
          <span className="preview-label">{es ? "Pregunta de decisión" : "Decision question"}</span>
          <h2>{es ? "¿Existen diferencias relevantes en la percepción del liderazgo?" : "Are there meaningful differences in leadership perception?"}</h2>
        </div>
        <div className="evidence-confidence">
          <span>{es ? "Evidencia" : "Evidence"}</span>
          <strong>{es ? "Alta" : "High"}</strong>
        </div>
      </div>
      <div className="evidence-answer">
        <span>{es ? "Respuesta ejecutiva" : "Executive answer"}</span>
        <p>{es
          ? "Sí. La señal se concentra en comunicación y reconocimiento, mientras que Operaciones muestra la brecha más consistente frente al resto de colectivos."
          : "Yes. The strongest signal appears in communication and recognition, while Operations shows the most consistent gap versus other cohorts."}</p>
      </div>
      <div className="evidence-chart">
        {rows.map(([label, value]) => (
          <div className="evidence-row" key={label}>
            <div className="evidence-row-label"><span>{label}</span><strong>{value}</strong></div>
            <div className="evidence-track"><span style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="evidence-note">{es ? "Índice sintético · datos demostrativos" : "Synthetic index · demo data"}</div>
      <div className="evidence-metrics">
        <div><strong>1.248</strong><span>{es ? "respuestas" : "responses"}</span></div>
        <div><strong>91/100</strong><span>{es ? "preparación" : "readiness"}</span></div>
        <div><strong>8 min</strong><span>{es ? "hasta el brief" : "to brief"}</span></div>
      </div>
    </div>
  );
}
