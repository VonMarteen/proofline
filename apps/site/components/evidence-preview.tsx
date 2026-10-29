import { Icon } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";

export function EvidencePreview({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const dimensions = [
    { label: es ? "Liderazgo" : "Leadership", value: 82 },
    { label: es ? "Cultura" : "Culture", value: 76 },
    { label: es ? "Ejecución" : "Execution", value: 68 },
    { label: es ? "Cambio" : "Change", value: 71 },
  ];

  return (
    <div className="pl2-dashboard" role="img" aria-label={es ? "Vista ilustrativa de Proofline con datos de demostración" : "Illustrative Proofline view with demonstration data"}>
      <div className="pl2-dashboard-header">
        <span className="pl2-dashboard-brand"><img src="/brand/proofline-mark-official.png" alt="" aria-hidden="true"/><strong>Proofline</strong></span>
        <span className="pl2-demo-badge">{es ? "Demo" : "Demo"}</span>
      </div>
      <div className="pl2-dashboard-body">
        <aside className="pl2-dashboard-side" aria-hidden="true">
          <span className="active"><Icon name="overview" size={14}/>{es ? "Resumen" : "Overview"}</span>
          <span><Icon name="assessments" size={14}/>Assessments</span>
          <span><Icon name="people" size={14}/>{es ? "Personas" : "People"}</span>
          <span><Icon name="reports" size={14}/>{es ? "Resultados" : "Results"}</span>
          <span><Icon name="library" size={14}/>{es ? "Evidencia" : "Evidence"}</span>
        </aside>
        <div className="pl2-dashboard-main">
          <div className="pl2-dashboard-title"><div><h2>{es ? "Salud organizacional" : "Organizational health"}</h2><span>{es ? "Lectura ejecutiva" : "Executive reading"}</span></div><b>{es ? "T2 2026" : "Q2 2026"}</b></div>
          <div className="pl2-dashboard-summary">
            <div className="pl2-index-panel"><div className="pl2-index-ring"><strong>78</strong></div><div><span>{es ? "Índice general" : "Overall index"}</span><b>+6%</b><small>{es ? "vs. periodo anterior" : "vs. previous period"}</small></div></div>
            <div className="pl2-dimensions-panel"><strong>{es ? "Dimensiones" : "Dimensions"}</strong>{dimensions.map((item) => <div className="pl2-dimension-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value}%` }}/></i><em>{item.value}</em></div>)}</div>
          </div>
          <div className="pl2-dashboard-lower">
            <div className="pl2-trend-panel"><div className="pl2-dashboard-card-title"><strong>{es ? "Evolución" : "Trend"}</strong><span>{es ? "6 meses" : "6 months"}</span></div><svg viewBox="0 0 360 105" aria-hidden="true"><path className="grid" d="M0 20H360M0 52H360M0 84H360"/><path className="area" d="M0 82 C42 77 72 71 105 65 S160 59 198 55 S273 43 360 25 L360 105 L0 105Z"/><path className="line" d="M0 82 C42 77 72 71 105 65 S160 59 198 55 S273 43 360 25"/><circle cx="360" cy="25" r="4"/></svg><div className="pl2-months"><span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span></div></div>
            <div className="pl2-distribution-panel"><div className="pl2-dashboard-card-title"><strong>{es ? "Participación" : "Participation"}</strong></div><div className="pl2-dashboard-donut"><strong>312</strong><span>{es ? "respuestas" : "responses"}</span></div><div className="pl2-donut-legend"><span><i/>People <b>40%</b></span><span><i/>Strategy <b>34%</b></span><span><i/>Risk <b>16%</b></span></div></div>
          </div>
          <div className="pl2-insight-bar"><Icon name="sparkles" size={16}/><div><strong>{es ? "Lectura destacada" : "Key reading"}</strong><span>{es ? "Liderazgo mejora de forma consistente; ejecución concentra la principal brecha frente al resto de dimensiones." : "Leadership improves consistently; execution holds the main gap versus other dimensions."}</span></div></div>
        </div>
      </div>
      <div className="pl2-dashboard-foot"><Icon name="approved" size={13}/><span>{es ? "Datos de demostración · no representan resultados reales" : "Demonstration data · not real client results"}</span></div>
    </div>
  );
}
