import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { CtaBand } from "../../../components/cta-band";

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const stages = es ? [
    {
      title: "Define qué necesitas poder responder",
      text: "Cada assessment empieza por un objetivo explícito y por la decisión que ese resultado debería apoyar. Proofline conserva esa pregunta como referencia para revisar el instrumento y para construir una salida final coherente.",
      details: ["Objetivo de investigación o negocio", "Decisión esperada", "Población y segmentación prevista"],
    },
    {
      title: "Importa, adapta o parte de un framework",
      text: "Puedes traer un cuestionario existente, trabajar con un framework de la Library o utilizar una metodología privada. El sistema conserva procedencia, reglas de edición, estructura de scoring y condiciones de comparabilidad.",
      details: ["Tipos de pregunta y escalas", "Dimensiones y scoring", "Versionado y procedencia"],
    },
    {
      title: "Comprueba el assessment antes de lanzarlo",
      text: "Proofline Check revisa si el instrumento parece preparado para responder al objetivo declarado y señala problemas que conviene resolver antes de recoger una sola respuesta.",
      details: ["Cobertura y redundancia", "Claridad y consistencia de escalas", "Carga, análisis y privacidad"],
    },
    {
      title: "Recoge respuestas con controles visibles",
      text: "La colección se diseña alrededor de propósito, confidencialidad, avisos versionados, tokens seguros y segmentación gobernada. La identidad puede permanecer separada del Response Store cuando el modo lo requiere.",
      details: ["Invitaciones y recordatorios", "Confidencialidad por cohortes", "Trazabilidad de avisos"],
    },
    {
      title: "Convierte datos en una respuesta trazable",
      text: "El motor estadístico produce las métricas reproducibles y las capacidades de IA ayudan a revisar, sintetizar e interpretar. La salida conserva la diferencia entre observación, asociación, hipótesis y recomendación.",
      details: ["Respuesta ejecutiva", "Insights y tendencias", "Evidencia y limitaciones"],
    },
  ] : [
    {
      title: "Define what you need to answer",
      text: "Every assessment starts with an explicit objective and the decision the result should support. Proofline keeps that question as the reference point for reviewing the instrument and building a coherent final output.",
      details: ["Research or business objective", "Expected decision", "Population and planned segmentation"],
    },
    {
      title: "Import, adapt or start from a framework",
      text: "Bring an existing questionnaire, use a Library framework or work with a private methodology. The system preserves provenance, edit rules, scoring structure and comparability conditions.",
      details: ["Question types and scales", "Dimensions and scoring", "Versioning and provenance"],
    },
    {
      title: "Check the assessment before launch",
      text: "Proofline Check reviews whether the instrument appears ready to answer the declared objective and flags issues worth resolving before a single response is collected.",
      details: ["Coverage and redundancy", "Clarity and scale consistency", "Burden, analysis and privacy"],
    },
    {
      title: "Collect responses with visible controls",
      text: "Collection is designed around purpose, confidentiality, versioned notices, secure tokens and governed segmentation. Identity can remain separated from the Response Store when the mode requires it.",
      details: ["Invitations and reminders", "Cohort confidentiality", "Notice traceability"],
    },
    {
      title: "Turn data into a traceable answer",
      text: "The statistical engine produces reproducible metrics while AI capabilities help review, synthesise and interpret. The output preserves the distinction between observation, association, hypothesis and recommendation.",
      details: ["Executive answer", "Insights and trends", "Evidence and limitations"],
    },
  ];

  return <>
    <section className="page-hero">
      <div className="container">
        <PageIntro
          title={es ? "Sofisticación analítica sin complejidad operativa." : "Analytical sophistication without operational complexity."}
          text={es
            ? "Proofline cubre el ciclo del assessment desde la pregunta inicial hasta la distribución del resultado. El objetivo es concentrar en un mismo sistema el trabajo metodológico, operativo y de evidencia que normalmente queda repartido entre formularios, hojas de cálculo, documentos y análisis manuales."
            : "Proofline covers the assessment cycle from the initial question to result distribution. The goal is to bring methodological, operational and evidence work into one system instead of scattering it across forms, spreadsheets, documents and manual analysis."}
          aside={<div className="page-intro-note"><strong>{es ? "Principio de producto" : "Product principle"}</strong><span>{es ? "Menos operación manual. Más claridad metodológica, trazabilidad y evidencia visible." : "Less manual operation. More methodological clarity, traceability and visible evidence."}</span></div>}
        />
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="content-heading">
          <h2>{es ? "Un ciclo completo, con contexto en cada etapa." : "A complete cycle with context at every stage."}</h2>
          <p>{es ? "Cada fase conserva lo que necesita la siguiente, desde el objetivo hasta el informe." : "Each phase preserves what the next one needs, from the objective through to the report."}</p>
        </div>
        <div className="product-timeline">
          {stages.map((stage) => <article className="product-stage" key={stage.title}>
            <div className="product-stage-copy">
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
            </div>
            <ul className="product-stage-details">{stage.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
          </article>)}
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container check-grid">
        <div>
          <h2>{es ? "Proofline Check: mejorar el instrumento antes de invertir en la recogida." : "Proofline Check: improve the instrument before investing in collection."}</h2>
          <p>{es
            ? "Una vez lanzado un assessment, cambiar preguntas, escalas o dimensiones puede romper comparaciones y obligar a repetir trabajo. La revisión previa ayuda a detectar problemas cuando todavía es barato corregirlos y deja documentado qué se revisó antes del lanzamiento."
            : "Once an assessment is live, changing questions, scales or dimensions can break comparisons and force rework. Pre-launch review helps surface issues while they are still inexpensive to fix and documents what was checked before launch."}</p>
          <div className="check-list">
            {(es ? [
              ["Cobertura", "¿Las preguntas cubren realmente el objetivo declarado y las dimensiones necesarias?"],
              ["Calidad", "¿Hay ambigüedad, redundancia, sesgos evidentes o escalas inconsistentes?"],
              ["Viabilidad", "¿La estructura permite el análisis, las comparaciones y el reporting que después se quieren realizar?"],
              ["Privacidad", "¿Se pide algún dato sin finalidad suficiente o con un riesgo de disclosure que debería revisarse?"],
            ] : [
              ["Coverage", "Do the questions actually cover the declared objective and required dimensions?"],
              ["Quality", "Is there ambiguity, redundancy, obvious bias or inconsistent scaling?"],
              ["Feasibility", "Does the structure support the intended analysis, comparisons and reporting?"],
              ["Privacy", "Is any data point requested without sufficient purpose or with disclosure risk that should be reviewed?"],
            ]).map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}
          </div>
        </div>
        <aside className="method-note">
          <strong>{es ? "Preparación metodológica visible" : "Visible methodological readiness"}</strong>
          <p>{es
            ? "El Readiness Score resume señales operativas de preparación y hace visibles los puntos que requieren revisión. Cuando una metodología necesita validación psicométrica o científica especializada, Proofline conserva ese trabajo como una responsabilidad profesional diferenciada y documentable."
            : "The Readiness Score summarises operational readiness signals and makes review points visible. Where a methodology requires specialist psychometric or scientific validation, Proofline keeps that work as a distinct, documentable professional responsibility."}</p>
        </aside>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="content-heading two-column-heading">
          <h2>{es ? "Un motor de análisis donde cada capacidad hace el trabajo que mejor sabe hacer." : "An analysis engine where each capability does the work it is best suited for."}</h2>
          <p>{es ? "La estadística produce métricas reproducibles; la IA ayuda a interpretar, sintetizar y navegar la evidencia sin ocultar de dónde sale la lectura." : "Statistics produce reproducible metrics; AI helps interpret, synthesise and navigate evidence without hiding where the reading comes from."}</p>
        </div>
        <div className="analysis-layers">
          <article><h3>{es ? "Estadística reproducible" : "Reproducible statistics"}</h3><p>{es ? "Scores, distribuciones, brechas, cohortes, tendencias, significancia y tamaños de efecto se calculan con reglas explícitas y pueden volver a ejecutarse sobre la misma base de datos." : "Scores, distributions, gaps, cohorts, trends, significance and effect sizes are calculated through explicit rules and can be rerun against the same data."}</p></article>
          <article><h3>{es ? "Lectura cualitativa asistida" : "Assisted qualitative reading"}</h3><p>{es ? "Comentarios abiertos pueden pasar por redacción de PII, agrupación temática, frecuencias y contrastes para acelerar la revisión sin convertir la síntesis en una caja negra." : "Open comments can go through PII redaction, thematic grouping, frequency analysis and contrasts to speed up review without turning synthesis into a black box."}</p></article>
          <article><h3>{es ? "Evidencia conectada" : "Connected evidence"}</h3><p>{es ? "Cada insight puede conservar el camino hacia distribuciones, comparaciones, comentarios, población y limitaciones, de modo que la lectura ejecutiva siga siendo revisable." : "Each insight can preserve the path back to distributions, comparisons, comments, population and limitations so the executive reading remains reviewable."}</p></article>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container output-grid">
        <div>
          <h2>{es ? "El resultado cambia según quién lo necesita." : "The result changes depending on who needs it."}</h2>
          <p>{es
            ? "La misma evidencia puede presentarse de forma distinta a dirección, People, managers, analistas o una consultora. La audiencia cambia la profundidad y la forma de lectura; la fuente de verdad sigue siendo la misma."
            : "The same evidence can be presented differently to leadership, People teams, managers, analysts or a consultancy. The audience changes depth and reading format; the source of truth remains the same."}</p>
        </div>
        <div className="output-cards">
          <div><strong>{es ? "Brief ejecutivo" : "Executive brief"}</strong><span>{es ? "Qué está ocurriendo, por qué importa, qué nivel de evidencia existe y qué merece atención a continuación." : "What is happening, why it matters, what level of evidence exists and what deserves attention next."}</span></div>
          <div><strong>{es ? "Informe de análisis" : "Analysis report"}</strong><span>{es ? "Dimensiones, comparaciones, tendencias, análisis cualitativo, evolución entre oleadas y limitaciones de interpretación." : "Dimensions, comparisons, trends, qualitative analysis, movement across waves and interpretation limitations."}</span></div>
          <div><strong>{es ? "Evidencia y metodología" : "Evidence & methodology"}</strong><span>{es ? "Scoring, versiones, población, reglas, cobertura, decisiones de revisión y anexos disponibles para quien necesita comprobar el detalle." : "Scoring, versions, population, rules, coverage, review decisions and appendices for anyone who needs to verify the detail."}</span></div>
        </div>
      </div>
    </section>

    <section className="section product-boundaries">
      <div className="container boundaries-panel">
        <div>
          <h2>{es ? "Especialización que permite profundizar." : "Specialisation that enables depth."}</h2>
          <p className="boundaries-intro">{es ? "Proofline concentra su arquitectura en assessments e inteligencia organizacional para poder tratar con más calidad los problemas que realmente importan dentro de ese ciclo." : "Proofline focuses its architecture on assessments and organizational intelligence so it can handle the important problems inside that cycle with greater depth."}</p>
        </div>
        <div className="boundaries-list">
          <p><strong>{es ? "Assessment intelligence." : "Assessment intelligence."}</strong> {es ? "Objetivo, cuestionario, población, scoring, recogida y resultados permanecen conectados en lugar de operar como piezas sueltas." : "Objective, questionnaire, population, scoring, collection and results stay connected instead of operating as isolated pieces."}</p>
          <p><strong>{es ? "Gobernanza incorporada." : "Built-in governance."}</strong> {es ? "Versiones, roles, privacidad, auditoría y distribución forman parte del flujo y no dependen de una hoja de control externa." : "Versions, roles, privacy, audit and distribution are part of the flow rather than depending on an external control sheet."}</p>
          <p><strong>{es ? "IA con contexto." : "AI with context."}</strong> {es ? "Las capacidades de IA trabajan dentro del objetivo, la metodología y la evidencia disponible, para acelerar revisión e interpretación sin desconectarse del dato." : "AI capabilities work within the objective, methodology and available evidence to accelerate review and interpretation without disconnecting from the data."}</p>
        </div>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Veamos qué tendría que responder tu próximo assessment." : "Let's define what your next assessment needs to answer."}
      text={es ? "Una demo útil empieza por tu problema, el instrumento que ya utilizas y el tipo de decisión que quieres apoyar." : "A useful demo starts with your problem, the instrument you already use and the kind of decision you want to support."}
      secondaryHref={`/${locale}/library`}
      secondaryLabel={es ? "Explorar la Library" : "Explore the Library"}
    />
  </>;
}
