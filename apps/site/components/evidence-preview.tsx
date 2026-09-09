import { Brand, Icon } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";

export function EvidencePreview({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const signals = [
    { label: es ? "Compromiso" : "Engagement", value: 82, delta: "+6%" },
    { label: es ? "Alineación" : "Alignment", value: 76, delta: "+4%" },
    { label: es ? "Cultura" : "Culture", value: 71, delta: "+2%" },
    { label: es ? "Liderazgo" : "Leadership", value: 64, delta: "−3%" },
  ];
  return (
    <div className="pl-product-window" aria-label={es ? "Vista de producto con datos sintéticos" : "Product preview with synthetic data"}>
      <div className="pl-product-chrome"><Brand compact/><div className="pl-product-user"><span>MC</span><div><strong>María Castillo</strong><small>People Director</small></div></div></div>
      <div className="pl-product-body">
        <aside className="pl-product-side">
          <span className="active"><Icon name="overview" size={15}/>{es ? "Visión general" : "Overview"}</span>
          <span><Icon name="people" size={15}/>{es ? "Personas" : "People"}</span>
          <span><Icon name="assessments" size={15}/>Assessments</span>
          <span><Icon name="reports" size={15}/>{es ? "Informes" : "Reports"}</span>
          <span><Icon name="security" size={15}/>{es ? "Confianza" : "Trust"}</span>
        </aside>
        <div className="pl-product-main">
          <div className="pl-product-heading"><div><span>{es ? "VISIÓN GENERAL" : "OVERVIEW"}</span><h2>{es ? "Salud organizacional" : "Organizational health"}</h2></div><button type="button">{es ? "Últimos 90 días" : "Last 90 days"}</button></div>
          <div className="pl-health-grid">
            <div className="pl-health-score"><div className="pl-score-ring"><strong>78</strong><span>/100</span></div><div><span>{es ? "Índice global" : "Overall index"}</span><b>+6%</b></div></div>
            <div className="pl-signal-list">{signals.map(s=><div key={s.label}><span>{s.label}</span><strong>{s.value}</strong><em className={s.delta.startsWith("−")?"down":"up"}>{s.delta}</em></div>)}</div>
          </div>
          <div className="pl-preview-grid">
            <div className="pl-trend-card"><div className="pl-card-title"><strong>{es ? "Tendencia de señales" : "Signal trend"}</strong><span>{es ? "6 meses" : "6 months"}</span></div><svg viewBox="0 0 360 120" role="img" aria-label={es ? "Tendencia sintética" : "Synthetic trend"}><path className="grid" d="M0 20H360M0 60H360M0 100H360"/><path className="line secondary" d="M0 88 C45 82 62 77 92 72 S145 62 181 66 S250 45 360 38"/><path className="line primary" d="M0 78 C46 70 65 66 98 62 S155 50 196 55 S268 34 360 25"/></svg><div className="pl-trend-legend"><span><i/>Compromiso</span><span><i/>Alineación</span></div></div>
            <div className="pl-distribution-card"><div className="pl-card-title"><strong>{es ? "Señales verificadas" : "Verified signals"}</strong><span>312</span></div><div className="pl-donut"><strong>312</strong><span>{es ? "señales" : "signals"}</span></div><div className="pl-mini-legend"><span>People <b>35%</b></span><span>{es ? "Procesos" : "Process"} <b>24%</b></span><span>{es ? "Liderazgo" : "Leadership"} <b>22%</b></span></div></div>
          </div>
          <div className="pl-product-note"><Icon name="approved" size={15}/>{es ? "Datos demostrativos · no representan resultados reales" : "Demo data · does not represent real results"}</div>
        </div>
      </div>
    </div>
  );
}
