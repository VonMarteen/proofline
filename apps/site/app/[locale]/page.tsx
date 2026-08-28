import { normalizeLocale } from "@proofline/i18n";
import { copy } from "../../lib/copy";
import { EvidencePreview } from "../../components/evidence-preview";
import { CtaBand } from "../../components/cta-band";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const c = copy[locale];
  const es = locale === "es";

  const workflow = es ? [
    {
      title: "Empieza por la decisión",
      text: "Declara qué necesitas poder responder, qué decisión debería habilitar el estudio y a qué población afecta. Proofline conserva ese objetivo como referencia para revisar el cuestionario, la recogida y la salida final.",
    },
    {
      title: "Revisa antes de lanzar",
      text: "Importa tu cuestionario o parte de un framework y comprueba si realmente cubre el objetivo. La revisión señala redundancias, ambigüedades, escalas inconsistentes, carga innecesaria y riesgos de privacidad antes de recoger respuestas.",
    },
    {
      title: "Recoge con control",
      text: "Gestiona invitaciones, avisos versionados, confidencialidad, cohortes y seguimiento desde un mismo flujo. La identidad puede mantenerse separada de la respuesta cuando el modo del assessment lo requiere.",
    },
    {
      title: "Recibe una lectura defendible",
      text: "La salida prioriza qué puede afirmarse respecto al objetivo y permite profundizar después en tendencias, diferencias entre grupos, comentarios y limitaciones. La dirección obtiene claridad sin perder el camino hacia la evidencia.",
    },
  ] : [
    {
      title: "Start with the decision",
      text: "Declare what you need to answer, which decision the study should enable and which population it concerns. Proofline preserves that objective as the reference point for reviewing the questionnaire, collection and final output.",
    },
    {
      title: "Review before launch",
      text: "Import your questionnaire or start from a framework and check whether it actually covers the objective. The review flags redundancy, ambiguity, inconsistent scales, unnecessary burden and privacy risks before responses are collected.",
    },
    {
      title: "Collect with control",
      text: "Manage invitations, versioned notices, confidentiality, cohorts and follow-up in one flow. Identity can remain separated from response data when the assessment mode requires it.",
    },
    {
      title: "Get a defensible reading",
      text: "The output prioritises what can be said about the objective and then lets you drill into trends, group differences, comments and limitations. Leadership gets clarity without losing the path back to evidence.",
    },
  ];

  return <>
    <section className="hero site-hero">
      <div className="container site-hero-grid">
        <div className="site-hero-copy">
          <p className="hero-kicker">{c.hero.kicker}</p>
          <h1>{c.hero.title}</h1>
          <p className="hero-lead">{c.hero.text}</p>
          <div className="hero-actions">
            <a className="btn btn-accent" href={`/${locale}/product`}>{c.hero.primary}</a>
            <a className="btn" href={`/${locale}/library`}>{c.hero.secondary}</a>
          </div>
          <div className="hero-proof-points" aria-label={es ? "Principios de Proofline" : "Proofline principles"}>
            <span>{es ? "Revisión antes de lanzar" : "Pre-launch review"}</span>
            <span>{es ? "Privacidad desde el diseño" : "Privacy by design"}</span>
            <span>{es ? "Resultados trazables" : "Traceable results"}</span>
          </div>
        </div>
        <EvidencePreview locale={locale} />
      </div>
    </section>

    <section className="section editorial-section">
      <div className="container editorial-split">
        <div>
          <h2>{es ? "No es otra herramienta de encuestas." : "It is not another survey tool."}</h2>
        </div>
        <div className="editorial-copy">
          <p>{es
            ? "Proofline está pensado para situaciones en las que la organización ya tiene una pregunta relevante y necesita llegar a una respuesta con método, sin convertir el proceso en un proyecto de análisis interminable."
            : "Proofline is designed for situations where the organization already has an important question and needs a methodical answer without turning the process into an endless analysis project."}</p>
          <p>{es
            ? "La plataforma conecta diseño del assessment, recogida, análisis, privacidad y reporting dentro de un mismo sistema de evidencia. Cada etapa conserva contexto suficiente para que el resultado final pueda explicarse, revisarse y reutilizarse en futuras oleadas."
            : "The platform connects assessment design, collection, analysis, privacy and reporting within a single evidence system. Each stage preserves enough context for the final result to be explained, reviewed and reused in future waves."}</p>
          <a className="text-link" href={`/${locale}/product`}>{es ? "Ver cómo funciona el ciclo completo" : "See how the full cycle works"} →</a>
        </div>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="content-heading">
          <h2>{es ? "De la pregunta al resultado, sin perder el hilo." : "From question to result without losing the thread."}</h2>
          <p>{es ? "Un proceso continuo donde objetivo, método, privacidad y evidencia permanecen conectados." : "A continuous process where objective, method, privacy and evidence remain connected."}</p>
        </div>
        <div className="workflow-grid">
          {workflow.map((item) => <article className="workflow-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container outcome-grid">
        <div className="outcome-copy">
          <h2>{es ? "Primero la respuesta. Después, toda la profundidad que necesites." : "The answer first. Then all the depth you need."}</h2>
          <p>{es
            ? "Un directivo no debería tener que navegar veinte gráficos para entender qué está ocurriendo. Proofline empieza por una lectura ejecutiva y conserva debajo la profundidad suficiente para que analistas, People o consultores puedan comprobar cómo se llegó a ella."
            : "A decision-maker should not need to navigate twenty charts to understand what is happening. Proofline starts with an executive reading and keeps enough depth underneath for analysts, People teams or consultants to verify how it was reached."}</p>
        </div>
        <div className="outcome-layers">
          <div className="outcome-layer"><div><strong>{es ? "Respuesta" : "Answer"}</strong><p>{es ? "Una conclusión directa respecto al objetivo original: qué puede afirmarse, qué no y con qué nivel de evidencia. Está pensada para que dirección entienda el resultado sin tener que reconstruir el análisis." : "A direct conclusion against the original objective: what can be said, what cannot and with what level of evidence. Designed so leadership can understand the result without reconstructing the analysis."}</p></div></div>
          <div className="outcome-layer"><div><strong>{es ? "Insights" : "Insights"}</strong><p>{es ? "La señal se descompone en diferencias entre grupos, dimensiones, tendencias y temas recurrentes. Aquí aparece dónde conviene mirar con más atención y qué merece una siguiente pregunta." : "The signal is broken down into group differences, dimensions, trends and recurring themes. This layer shows where to look more closely and what deserves a follow-up question."}</p></div></div>
          <div className="outcome-layer"><div><strong>{es ? "Evidencia" : "Evidence"}</strong><p>{es ? "Distribuciones, comparaciones, comentarios, reglas de scoring, población y limitaciones quedan disponibles para revisar la lectura, documentarla y sostener decisiones posteriores." : "Distributions, comparisons, comments, scoring rules, population and limitations remain available to review the reading, document it and support subsequent decisions."}</p></div></div>
        </div>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="content-heading two-column-heading">
          <h2>{es ? "Una plataforma, dos formas de trabajar." : "One platform, two ways to work."}</h2>
          <p>{es ? "La misma base metodológica y de confianza, adaptada a quién opera el servicio." : "The same methodological and trust foundation, adapted to whoever operates the service."}</p>
        </div>
        <div className="mode-grid">
          <article className="mode-panel">
            <div className="mode-title"><span>{es ? "Equipos internos" : "Internal teams"}</span><h3>Proofline Direct</h3></div>
            <p>{es ? "Para organizaciones que quieren diseñar y ejecutar sus propios assessments con un proceso guiado, gobernado y repetible." : "For organizations that want to design and run their own assessments through a guided, governed and repeatable process."}</p>
            <ul>
              <li>{es ? "Assessment Check antes del lanzamiento" : "Assessment Check before launch"}</li>
              <li>{es ? "Resultados ejecutivos y evidencia navegable" : "Executive results and navigable evidence"}</li>
              <li>{es ? "Roles, privacidad y distribución controlada" : "Roles, privacy and controlled distribution"}</li>
            </ul>
            <a className="text-link" href={`/${locale}/solutions#direct`}>{es ? "Conocer Direct" : "Explore Direct"} →</a>
          </article>
          <article className="mode-panel">
            <div className="mode-title"><span>{es ? "Operación multi-cliente" : "Multi-client operation"}</span><h3>Proofline Professional</h3></div>
            <p>{es ? "Para consultoras y partners que quieren convertir una metodología propia en una operación consistente, trazable y escalable sin multiplicar trabajo manual." : "For consultancies and partners turning proprietary methodology into a consistent, traceable and scalable operation without multiplying manual work."}</p>
            <ul>
              <li>{es ? "Clientes, bibliotecas y frameworks privados" : "Clients, libraries and private frameworks"}</li>
              <li>{es ? "Reporting por audiencia y marca" : "Audience- and brand-specific reporting"}</li>
              <li>{es ? "Gobernanza y operación repetible" : "Governance and repeatable operation"}</li>
            </ul>
            <a className="text-link" href={`/${locale}/solutions#professional`}>{es ? "Conocer Professional" : "Explore Professional"} →</a>
          </article>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container trust-home-grid">
        <div>
          <h2>{es ? "La confianza no aparece al final del informe." : "Trust does not appear at the end of the report."}</h2>
          <p>{es
            ? "Se diseña desde el principio: qué datos se necesitan, para qué, quién puede acceder, cómo se separa la identidad, qué puede mostrarse por cohortes y qué evidencia legal debe conservarse."
            : "It is designed from the start: which data are needed, why, who can access them, how identity is separated, what can be shown by cohort and which legal evidence should be retained."}</p>
          <a className="btn" href={`/${locale}/trust`}>{es ? "Explorar el Trust Center" : "Explore the Trust Center"}</a>
        </div>
        <div className="trust-principles">
          <div><strong>{es ? "Datos mínimos" : "Minimum data"}</strong><span>{es ? "Cada campo necesita un propósito declarado y una política de retención coherente." : "Every field needs a declared purpose and coherent retention policy."}</span></div>
          <div><strong>{es ? "Identidad separada" : "Separated identity"}</strong><span>{es ? "Identidad y respuesta pueden permanecer en dominios distintos para reducir exposición innecesaria." : "Identity and response can remain in separate domains to reduce unnecessary exposure."}</span></div>
          <div><strong>{es ? "IA especializada" : "Specialised AI"}</strong><span>{es ? "La IA apoya revisión, síntesis e interpretación dentro de funciones explícitas y revisables." : "AI supports review, synthesis and interpretation within explicit, reviewable functions."}</span></div>
          <div><strong>{es ? "Evidencia trazable" : "Traceable evidence"}</strong><span>{es ? "Versiones, accesos y decisiones relevantes pueden conservar contexto suficiente para una revisión posterior." : "Versions, access and relevant decisions can retain enough context for later review."}</span></div>
        </div>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Si la pregunta importa, el proceso también." : "If the question matters, so does the process."}
      text={es ? "Cuéntanos qué necesitas poder responder y te mostramos cómo se estructuraría en Proofline." : "Tell us what you need to answer and we will show you how it would be structured in Proofline."}
      secondaryHref={`/${locale}/library`}
      secondaryLabel={es ? "Ver assessments" : "View assessments"}
    />
  </>;
}
