import { normalizeLocale } from "@proofline/i18n";
import { Icon } from "@proofline/ui";

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const stages = es ? [
    { icon: "clipboard-check" as const, title: "Definir", text: "Objetivo, decisión esperada y población quedan vinculados al assessment desde el inicio." },
    { icon: "library" as const, title: "Diseñar", text: "Framework, cuestionario, dimensiones, escalas y scoring se construyen como una única versión controlada." },
    { icon: "gauge" as const, title: "Revisar", text: "Proofline Check hace visibles problemas de cobertura, claridad, carga, análisis y privacidad antes del lanzamiento." },
    { icon: "people" as const, title: "Recoger", text: "Invitaciones, confidencialidad, cohortes y avisos permanecen gobernados durante la recogida." },
    { icon: "reports" as const, title: "Interpretar", text: "Resultados, evidencia y limitaciones se estructuran para apoyar una decisión, no sólo para mostrar métricas." },
  ] : [
    { icon: "clipboard-check" as const, title: "Define", text: "Objective, expected decision and population remain linked to the assessment from the start." },
    { icon: "library" as const, title: "Design", text: "Framework, questionnaire, dimensions, scales and scoring are built as one controlled version." },
    { icon: "gauge" as const, title: "Review", text: "Proofline Check surfaces coverage, clarity, burden, analysis and privacy issues before launch." },
    { icon: "people" as const, title: "Collect", text: "Invitations, confidentiality, cohorts and notices remain governed throughout collection." },
    { icon: "reports" as const, title: "Interpret", text: "Results, evidence and limitations are structured to support a decision, not just display metrics." },
  ];

  const checkItems = es ? [
    ["Cobertura", "El instrumento responde al objetivo declarado y cubre las dimensiones necesarias."],
    ["Calidad", "Ambigüedad, redundancia, sesgos evidentes y escalas inconsistentes quedan señalados para revisión."],
    ["Viabilidad", "La estructura permite el análisis, las comparaciones y el reporting que se quieren obtener."],
    ["Privacidad", "Los datos solicitados y la segmentación se revisan desde la finalidad y el riesgo de disclosure."],
  ] : [
    ["Coverage", "The instrument answers the declared objective and covers the required dimensions."],
    ["Quality", "Ambiguity, redundancy, obvious bias and inconsistent scales are flagged for review."],
    ["Feasibility", "The structure supports the intended analysis, comparisons and reporting."],
    ["Privacy", "Requested data and segmentation are reviewed against purpose and disclosure risk."],
  ];

  return <main className="pp3-page">
    <section className="pp3-hero">
      <div className="container pp3-hero-grid">
        <div className="pp3-hero-copy">
          <h1>{es ? "Un sistema para convertir assessments en decisiones defendibles." : "A system for turning assessments into defensible decisions."}</h1>
          <p>{es
            ? "Proofline conecta diseño metodológico, recogida, análisis y reporting en un mismo ciclo. El contexto no se pierde entre formularios, hojas de cálculo y documentos: permanece unido al objetivo, la población y la evidencia que explican el resultado."
            : "Proofline connects methodological design, collection, analysis and reporting in one cycle. Context is not lost across forms, spreadsheets and documents: it stays linked to the objective, population and evidence that explain the result."}</p>
          <div className="pp3-actions">
            <a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Book a demo"}<Icon name="arrow-right" size={15}/></a>
            <a className="pp3-link" href={`/${locale}/library`}>{es ? "Explorar frameworks" : "Explore frameworks"}<Icon name="chevron-right" size={15}/></a>
          </div>
        </div>

        <div className="pp3-architecture" aria-label={es ? "Arquitectura del ciclo Proofline" : "Proofline cycle architecture"}>
          <div className="pp3-architecture-head">
            <span>{es ? "Objetivo" : "Objective"}</span>
            <strong>{es ? "¿Qué necesitas poder decidir?" : "What do you need to decide?"}</strong>
          </div>
          <div className="pp3-architecture-line" aria-hidden="true" />
          <div className="pp3-architecture-row">
            <div><Icon name="assessments" size={18}/><span>{es ? "Instrumento" : "Instrument"}</span></div>
            <div><Icon name="people" size={18}/><span>{es ? "Población" : "Population"}</span></div>
            <div><Icon name="governance" size={18}/><span>{es ? "Gobernanza" : "Governance"}</span></div>
          </div>
          <div className="pp3-architecture-line" aria-hidden="true" />
          <div className="pp3-architecture-result">
            <Icon name="reports" size={20}/>
            <div><span>{es ? "Resultado" : "Result"}</span><strong>{es ? "Lectura + evidencia + límites" : "Reading + evidence + limits"}</strong></div>
          </div>
        </div>
      </div>
    </section>

    <section className="pp3-section pp3-section-muted">
      <div className="container">
        <div className="pp3-heading">
          <h2>{es ? "De la pregunta a una respuesta que conserva su contexto." : "From the question to an answer that keeps its context."}</h2>
          <p>{es ? "Cada etapa conserva la información que necesita la siguiente. No son cinco herramientas conectadas: es un solo ciclo de trabajo." : "Each stage preserves what the next one needs. It is not five connected tools: it is one working cycle."}</p>
        </div>
        <div className="pp3-flow">
          {stages.map((stage, index) => <article className="pp3-flow-item" key={stage.title}>
            <div className="pp3-flow-icon"><Icon name={stage.icon} size={19}/></div>
            <h3>{stage.title}</h3>
            <p>{stage.text}</p>
            {index < stages.length - 1 ? <span className="pp3-flow-connector" aria-hidden="true"><Icon name="arrow-right" size={20}/></span> : null}
          </article>)}
        </div>
      </div>
    </section>

    <section className="pp3-section">
      <div className="container pp3-check-layout">
        <div className="pp3-check-copy">
          <h2>{es ? "Proofline Check revisa el instrumento antes de que corregirlo sea caro." : "Proofline Check reviews the instrument before fixing it becomes expensive."}</h2>
          <p>{es
            ? "Una vez lanzado un assessment, cambiar preguntas, escalas o dimensiones puede romper comparaciones y obligar a repetir trabajo. La revisión previa concentra los puntos que merece la pena resolver antes de recoger respuestas."
            : "Once an assessment is live, changing questions, scales or dimensions can break comparisons and force rework. Pre-launch review concentrates the issues worth resolving before responses are collected."}</p>
          <div className="pp3-readiness">
            <div className="pp3-readiness-score"><strong>78</strong><span>{es ? "Readiness" : "Readiness"}</span></div>
            <div><strong>{es ? "Preparación operativa visible" : "Visible operational readiness"}</strong><p>{es ? "El score resume señales verificables del instrumento. No sustituye una validación científica especializada cuando ésta sea necesaria." : "The score summarises verifiable instrument signals. It does not replace specialist scientific validation where that is required."}</p></div>
          </div>
        </div>
        <div className="pp3-check-list">
          {checkItems.map(([title, text]) => <div className="pp3-check-item" key={title}>
            <Icon name="check-circle" size={18}/>
            <div><strong>{title}</strong><p>{text}</p></div>
          </div>)}
        </div>
      </div>
    </section>

    <section className="pp3-section pp3-section-deep">
      <div className="container">
        <div className="pp3-heading pp3-heading-light">
          <h2>{es ? "Cálculo e interpretación cumplen funciones distintas." : "Calculation and interpretation perform different jobs."}</h2>
          <p>{es ? "Las métricas reproducibles no se mezclan con la lectura asistida. Proofline mantiene visible qué se calcula, qué se interpreta y qué necesita revisión humana." : "Reproducible metrics are not mixed with assisted interpretation. Proofline keeps visible what is calculated, what is interpreted and what requires human review."}</p>
        </div>
        <div className="pp3-analysis-grid">
          <article>
            <div className="pp3-analysis-icon"><Icon name="activity" size={20}/></div>
            <h3>{es ? "Motor estadístico" : "Statistical engine"}</h3>
            <p>{es ? "Scoring, dimensiones, comparaciones, cohortes y tendencias parten de reglas reproducibles y de una fuente de verdad versionada." : "Scoring, dimensions, comparisons, cohorts and trends are based on reproducible rules and a versioned source of truth."}</p>
            <ul><li>{es ? "Scoring 0–100 y polaridad" : "0–100 scoring and polarity"}</li><li>{es ? "Pesos y dimensiones" : "Weights and dimensions"}</li><li>{es ? "Cohortes y supresión" : "Cohorts and suppression"}</li></ul>
          </article>
          <article>
            <div className="pp3-analysis-icon"><Icon name="sparkles" size={20}/></div>
            <h3>{es ? "Interpretación asistida" : "Assisted interpretation"}</h3>
            <p>{es ? "La IA puede resumir, comparar y ayudar a navegar la evidencia, pero trabaja dentro del objetivo y los datos disponibles y no convierte una hipótesis en un hecho." : "AI can summarise, compare and help navigate evidence, but it works within the objective and available data and does not turn a hypothesis into a fact."}</p>
            <ul><li>{es ? "Síntesis de evidencia" : "Evidence synthesis"}</li><li>{es ? "Patrones y temas" : "Patterns and themes"}</li><li>{es ? "Apoyo a la lectura" : "Reading support"}</li></ul>
          </article>
        </div>
        <div className="pp3-evidence-line">
          <span>{es ? "Dato" : "Data"}</span><Icon name="chevron-right" size={15}/><span>{es ? "Métrica" : "Metric"}</span><Icon name="chevron-right" size={15}/><span>{es ? "Lectura" : "Reading"}</span><Icon name="chevron-right" size={15}/><span>{es ? "Evidencia" : "Evidence"}</span><Icon name="chevron-right" size={15}/><span>{es ? "Decisión" : "Decision"}</span>
        </div>
      </div>
    </section>

    <section className="pp3-section">
      <div className="container pp3-output-layout">
        <div className="pp3-output-copy">
          <h2>{es ? "Una misma fuente de verdad, distintas profundidades de lectura." : "One source of truth, different depths of reading."}</h2>
          <p>{es ? "Dirección, People, managers y analistas no necesitan la misma cantidad de detalle. La profundidad cambia; el snapshot y la evidencia que sostienen el resultado no." : "Leadership, People teams, managers and analysts do not need the same level of detail. Depth changes; the snapshot and evidence supporting the result do not."}</p>
        </div>
        <div className="pp3-output-stack">
          <article className="pp3-output-featured"><Icon name="reports" size={20}/><div><h3>{es ? "Lectura ejecutiva" : "Executive reading"}</h3><p>{es ? "Qué está ocurriendo, por qué importa, qué nivel de evidencia existe y dónde conviene poner atención." : "What is happening, why it matters, what level of evidence exists and where attention is needed."}</p></div></article>
          <article><Icon name="activity" size={18}/><div><h3>{es ? "Análisis" : "Analysis"}</h3><p>{es ? "Dimensiones, comparaciones, tendencias, cohortes y evolución." : "Dimensions, comparisons, trends, cohorts and movement."}</p></div></article>
          <article><Icon name="governance" size={18}/><div><h3>{es ? "Evidencia" : "Evidence"}</h3><p>{es ? "Metodología, población, scoring, versiones, cobertura y limitaciones." : "Methodology, population, scoring, versions, coverage and limitations."}</p></div></article>
        </div>
      </div>
    </section>

    <section className="pp3-section pp3-governance">
      <div className="container">
        <div className="pp3-governance-grid">
          <div><Icon name="history" size={18}/><strong>{es ? "Versionado" : "Versioning"}</strong><span>{es ? "Qué cambió y cuándo." : "What changed and when."}</span></div>
          <div><Icon name="security" size={18}/><strong>{es ? "Privacidad" : "Privacy"}</strong><span>{es ? "Identidad y respuestas gobernadas." : "Identity and responses governed."}</span></div>
          <div><Icon name="people" size={18}/><strong>{es ? "Población" : "Population"}</strong><span>{es ? "Snapshot y cohortes trazables." : "Traceable snapshot and cohorts."}</span></div>
          <div><Icon name="approved" size={18}/><strong>{es ? "Auditoría" : "Audit"}</strong><span>{es ? "Acciones relevantes con evidencia." : "Relevant actions with evidence."}</span></div>
        </div>
      </div>
    </section>

    <section className="pp3-final">
      <div className="container pp3-final-inner">
        <div><h2>{es ? "Veamos qué tendría que responder tu próximo assessment." : "Let's define what your next assessment needs to answer."}</h2><p>{es ? "Una demo útil empieza por el problema que necesitas comprender y la decisión que quieres apoyar." : "A useful demo starts with the problem you need to understand and the decision you want to support."}</p></div>
        <div className="pp3-final-actions"><a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Book a demo"}<Icon name="arrow-right" size={15}/></a><a className="btn" href={`/${locale}/library`}>{es ? "Explorar frameworks" : "Explore frameworks"}</a></div>
      </div>
    </section>
  </main>;
}
