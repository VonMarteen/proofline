import { normalizeLocale } from "@proofline/i18n";
import { apiGet } from "../../../../../lib/api";

const LEVELS = ["L1_EXECUTIVE", "L2_DIAGNOSTIC", "L3_ANALYTICAL", "L4_STRATEGIC"] as const;

function label(level: string, es: boolean) {
  const labels: Record<string, string> = {
    L1_EXECUTIVE: es ? "L1 · Ejecutivo" : "L1 · Executive",
    L2_DIAGNOSTIC: es ? "L2 · Diagnóstico" : "L2 · Diagnostic",
    L3_ANALYTICAL: es ? "L3 · Analítico" : "L3 · Analytical",
    L4_STRATEGIC: es ? "L4 · Estratégico" : "L4 · Strategic",
  };
  return labels[level] ?? level;
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ synthetic?: string; level?: string; reportId?: string }> }) {
  const { locale: rawLocale, id } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(rawLocale);
  const es = locale === "es";
  const level = LEVELS.includes(query.level as any) ? query.level! : "L1_EXECUTIVE";
  const synthetic = query.synthetic === "0" ? "0" : "1";
  const data = query.reportId
    ? await apiGet(`/v1/reports/${query.reportId}/view`)
    : await apiGet(`/v1/assessments/${id}/report-preview?synthetic=${synthetic}&level=${level}`);

  return (
    <div className="workspace-page report-preview-page">
      <a className="workspace-back" href={`/${locale}/assessments/${id}`}>← {es ? "Volver al assessment" : "Back to assessment"}</a>
      {data.synthetic ? <div className="synthetic-banner"><strong>{es ? "Previsualización con datos sintéticos" : "Synthetic data preview"}</strong><span>{es ? "Permite revisar estructura y profundidad. No predice resultados reales." : "Review structure and depth. It does not predict real results."}</span></div> : null}

      {!query.reportId ? <nav className="report-level-tabs" aria-label={es ? "Nivel de informe" : "Report level"}>
        {LEVELS.map((value) => <a key={value} className={value === data.level ? "active" : ""} href={`/${locale}/assessments/${id}/report-preview?synthetic=${synthetic}&level=${value}`}>{label(value, es)}</a>)}
      </nav> : <div className="report-stored-banner"><strong>{es ? "Snapshot guardado" : "Stored snapshot"}</strong><span>{es ? "Esta vista, el PDF y las exportaciones consumen exactamente la misma fuente de verdad." : "This view, PDF and exports consume exactly the same source of truth."}</span></div>}

      <article className="report-canvas">
        <header>
          <div className="report-brand"><strong>PROOFLINE</strong><span>Signal &amp; Structure</span></div>
          <div className="report-level-line"><strong>{label(data.level, es)}</strong><span>snapshot {String(data.snapshotHash).slice(0, 12)}</span></div>
          <h1>{data.title}</h1><p>{data.objective}</p>
          <div className="report-meta">
            <span>{es ? "Participación" : "Participation"}<strong>{data.participation.rate}%</strong></span>
            <span>{es ? "Índice global" : "Overall"}<strong>{data.overallScore ?? "—"}</strong></span>
            <span>{es ? "Target / gap" : "Target / gap"}<strong>{data.overallTarget ?? "—"} / {data.overallGap == null ? "—" : `${data.overallGap > 0 ? "+" : ""}${data.overallGap}`}</strong></span>
          </div>
        </header>

        <section><h2>{es ? "Lectura ejecutiva" : "Executive reading"}</h2><p className="report-answer">{data.executiveAnswer}</p></section>

        <section>
          <h2>{data.dimensions.length ? (es ? "Dimensiones" : "Dimensions") : (es ? "Distribuciones" : "Distributions")}</h2>
          {data.dimensions.length ? <div className="report-dimension-grid">{data.dimensions.map((dimension: any) => <div key={dimension.name}><div><span>{dimension.name}</span><strong>{dimension.score}/100 · n={dimension.n}{dimension.target == null ? "" : ` · target ${dimension.target} · gap ${dimension.gap > 0 ? "+" : ""}${dimension.gap}`}</strong></div><i><b style={{ width: `${dimension.score}%` }} /></i></div>)}</div> : <div className="report-response-summaries">{(data.responseSummaries ?? []).map((item: string) => <p key={item}>{item}</p>)}</div>}
        </section>

        {data.depth >= 2 ? <section className="report-two-col"><div><h2>{es ? "Prioridades derivadas" : "Derived priorities"}</h2><ul>{data.priorities.map((item: any) => <li key={item.name}>{item.name}: {item.score}/100{item.gap == null ? "" : ` · gap ${item.gap > 0 ? "+" : ""}${item.gap}`}</li>)}</ul></div><div><h2>{es ? "Muestra y límites" : "Sample & limits"}</h2><p>N={data.overallN}</p><ul>{data.limitations.map((item: string) => <li key={item}>{item}</li>)}</ul></div></section> : null}

        {data.depth >= 3 ? <section><h2>{es ? "Detalle analítico" : "Analytical detail"}</h2><div className="report-question-table">{data.questions.filter((question: any) => question.scored).slice(0, 20).map((question: any) => <div key={question.id}><span>{question.code}</span><strong>{question.prompt}</strong><em>{question.score ?? "—"}/100 · n={question.sample?.scored ?? 0}</em></div>)}</div><div className="report-cohort-summary"><strong>{es ? "Cohortes publicables" : "Publishable cohorts"}</strong><span>{data.cohorts.visible.length} · {es ? "suprimidas" : "suppressed"}: {data.cohorts.suppressedCount}</span></div></section> : null}

        {data.depth >= 4 ? <section className="report-two-col"><div><h2>{es ? "Evidencia cualitativa" : "Qualitative evidence"}</h2><ul>{data.qualitativeThemes.length ? data.qualitativeThemes.map((theme: any) => <li key={theme.theme}>{theme.theme}: {theme.mentions} {es ? "menciones" : "mentions"}</li>) : <li>{es ? "Sin evidencia cualitativa suficiente." : "No sufficient qualitative evidence."}</li>}</ul></div><div><h2>{es ? "Trazabilidad" : "Traceability"}</h2><ul><li>sourceHash: {data.source.sourceHash ?? "—"}</li><li>calculationHash: {data.source.calculationHash ?? "—"}</li><li>{data.evidencePolicy}</li></ul></div></section> : null}

        <footer><strong>PROOFLINE · Signal &amp; Structure</strong><span>{data.methodology}</span></footer>
      </article>
    </div>
  );
}
