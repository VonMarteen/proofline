import { normalizeLocale } from "@proofline/i18n";
import { Icon } from "@proofline/ui";
import { EvidencePreview } from "../../components/evidence-preview";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const challenges = es ? [
    { icon: "activity" as const, title: "Información dispersa", text: "Datos, señales, comentarios y fuentes diferentes sin una lectura común." },
    { icon: "search" as const, title: "Significado poco claro", text: "Saber qué ocurre no siempre explica por qué importa ni qué merece atención." },
    { icon: "clock" as const, title: "Decisiones que tardan", text: "Sin evidencia conectada, interpretar, priorizar y actuar requiere demasiado tiempo." },
  ] : [
    { icon: "activity" as const, title: "Scattered information", text: "Data, signals, comments and different sources without a shared reading." },
    { icon: "search" as const, title: "Unclear meaning", text: "Knowing what happened does not always explain why it matters or what deserves attention." },
    { icon: "clock" as const, title: "Slow decisions", text: "Without connected evidence, interpreting, prioritising and acting takes too long." },
  ];

  const process = es ? [
    { icon: "edit" as const, title: "Definir", text: "Formula el objetivo y configura el assessment adecuado." },
    { icon: "people" as const, title: "Recoger", text: "Invita a la población con privacidad, cohortes y seguimiento." },
    { icon: "activity" as const, title: "Analizar", text: "Convierte respuestas en puntuaciones y evidencia estructurada." },
    { icon: "search" as const, title: "Interpretar", text: "Distingue patrones, límites y riesgos antes de concluir." },
    { icon: "clipboard-check" as const, title: "Actuar", text: "Entrega prioridades comprensibles, revisables y trazables." },
  ] : [
    { icon: "edit" as const, title: "Define", text: "Frame the objective and configure the right assessment." },
    { icon: "people" as const, title: "Collect", text: "Invite the right population with privacy, cohorts and tracking." },
    { icon: "activity" as const, title: "Analyse", text: "Turn responses into scores and structured evidence." },
    { icon: "search" as const, title: "Interpret", text: "Separate patterns, limits and risks before concluding." },
    { icon: "clipboard-check" as const, title: "Act", text: "Deliver priorities that are clear, reviewable and traceable." },
  ];

  const outputs = es ? [
    { icon: "reports" as const, title: "Reporte ejecutivo", text: "Hallazgos, evolución, prioridades y recomendaciones en una lectura preparada para dirección." },
    { icon: "activity" as const, title: "Mapa de fortalezas", text: "Dimensiones y cohortes comparables para localizar fortalezas y brechas relevantes." },
    { icon: "alert" as const, title: "Detección de riesgos", text: "Señales tempranas y límites de interpretación antes de convertirlas en una decisión." },
    { icon: "clipboard-check" as const, title: "Prioridades de acción", text: "Siguientes pasos concretos vinculados con los resultados que los justifican." },
  ] : [
    { icon: "reports" as const, title: "Executive report", text: "Findings, movement, priorities and recommendations in a leadership-ready reading." },
    { icon: "activity" as const, title: "Strength map", text: "Comparable dimensions and cohorts to locate relevant strengths and gaps." },
    { icon: "alert" as const, title: "Risk detection", text: "Early signals and interpretation limits before turning them into decisions." },
    { icon: "clipboard-check" as const, title: "Action priorities", text: "Concrete next steps linked back to the results that justify them." },
  ];

  const primaryOutput = outputs[0]!;

  const solutions = es ? [
    { icon: "activity" as const, title: "Clima y experiencia", text: "Escucha, analiza y compara la experiencia de las personas sin perder contexto." },
    { icon: "people" as const, title: "Liderazgo y equipos", text: "Evalúa capacidades colectivas, consistencia y oportunidades de mejora." },
    { icon: "rocket" as const, title: "Cambio y transformación", text: "Entiende condiciones, fricciones, riesgos y preparación para el cambio." },
    { icon: "handshake" as const, title: "Consultoría y advisory", text: "Opera metodologías con clientes distintos bajo reglas, evidencia y permisos claros." },
  ] : [
    { icon: "activity" as const, title: "Climate & experience", text: "Listen, analyse and compare people experience without losing context." },
    { icon: "people" as const, title: "Leadership & teams", text: "Assess collective capability, consistency and improvement opportunities." },
    { icon: "rocket" as const, title: "Change & transformation", text: "Understand conditions, friction, risks and readiness for change." },
    { icon: "handshake" as const, title: "Consulting & advisory", text: "Operate methodologies across clients with clear rules, evidence and permissions." },
  ];

  return (
    <div className="pl2-home">
      <section className="pl2-hero">
        <div className="container pl2-hero-grid">
          <div className="pl2-hero-copy">
            <h1>{es ? <>De las señales de tu organización a <em>decisiones con evidencia.</em></> : <>From organizational signals to <em>evidence-based decisions.</em></>}</h1>
            <p className="pl2-lead">{es ? "Proofline convierte preguntas complejas en conocimiento accionable. Diseña, recoge, analiza y presenta información con contexto, trazabilidad y gobierno." : "Proofline turns complex questions into actionable knowledge. Design, collect, analyse and present information with context, traceability and governance."}</p>
            <div className="pl2-actions">
              <a className="btn btn-primary pl2-primary-action" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Request a demo"}<Icon name="arrow-right" size={16}/></a>
              <a className="btn pl2-secondary-action" href={`/${locale}/product`}>{es ? "Ver cómo funciona" : "See how it works"}<Icon name="arrow-right" size={16}/></a>
            </div>
            <div className="pl2-proof-points" aria-label={es ? "Principios de Proofline" : "Proofline principles"}>
              <span><Icon name="check" size={15}/>{es ? "Metodología estructurada" : "Structured methodology"}</span>
              <span><Icon name="check" size={15}/>{es ? "Evidencia trazable" : "Traceable evidence"}</span>
              <span><Icon name="check" size={15}/>{es ? "Informes para decidir" : "Decision-ready reporting"}</span>
            </div>
          </div>
          <div className="pl2-hero-product"><EvidencePreview locale={locale}/></div>
        </div>
      </section>

      <section className="pl2-audience-strip" aria-label={es ? "Áreas de uso" : "Use areas"}>
        <div className="container pl2-audience-inner">
          <span>{es ? "People & Cultura" : "People & Culture"}</span>
          <span>{es ? "Estrategia" : "Strategy"}</span>
          <span>{es ? "Transformación" : "Transformation"}</span>
          <span>{es ? "Consultoría" : "Consulting"}</span>
        </div>
      </section>

      <section className="pl2-section pl2-challenge pl2-reveal">
        <div className="container">
          <div className="pl2-section-heading">
            <h2>{es ? <>Demasiadas señales.<br/>Pocas decisiones claras.</> : <>Too many signals.<br/>Too few clear decisions.</>}</h2>
            <p>{es ? "La información existe, pero suele estar dispersa entre encuestas, conversaciones, documentos y sistemas. Proofline la ordena para que pueda interpretarse y utilizarse con criterio." : "The information exists, but it is often scattered across surveys, conversations, documents and systems. Proofline structures it so it can be interpreted and used with judgement."}</p>
          </div>
          <div className="pl2-card-grid pl2-card-grid-3">
            {challenges.map((item) => <article className="pl2-card pl2-challenge-card" key={item.title}><span className="pl2-icon-box"><Icon name={item.icon} size={20}/></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="pl2-section pl2-process pl2-reveal">
        <div className="container">
          <div className="pl2-section-heading">
            <h2>{es ? "Un ciclo completo para pasar de la pregunta a la decisión." : "A complete cycle from question to decision."}</h2>
            <div className="pl2-heading-aside"><p>{es ? "Un proceso estructurado y trazable que mantiene conectados objetivo, población, evidencia, interpretación y resultado." : "A structured, traceable process that keeps objective, population, evidence, interpretation and outcome connected."}</p><a href={`/${locale}/product`}>{es ? "Ver el proceso completo" : "See the full process"}<Icon name="arrow-right" size={15}/></a></div>
          </div>
          <div className="pl2-process-grid">
            {process.map((item) => <article className="pl2-process-card" key={item.title}><span className="pl2-process-icon"><Icon name={item.icon} size={19}/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="pl2-section pl2-results pl2-reveal" id="resultados">
        <div className="container">
          <div className="pl2-section-heading">
            <h2>{es ? "Del análisis a una lectura ejecutiva que se puede defender." : "From analysis to an executive reading you can defend."}</h2>
            <div className="pl2-heading-aside"><p>{es ? "Los resultados se presentan con jerarquía, evidencia y contexto. No como un conjunto de gráficos aislados." : "Results are presented with hierarchy, evidence and context — not as a collection of disconnected charts."}</p><a href={`/${locale}/product`}>{es ? "Ver todos los entregables" : "View all outputs"}<Icon name="arrow-right" size={15}/></a></div>
          </div>

          <div className="pl2-results-layout">
            <article className="pl2-executive-output">
              <div className="pl2-executive-copy"><span className="pl2-icon-box"><Icon name={primaryOutput.icon} size={20}/></span><h3>{primaryOutput.title}</h3><p>{primaryOutput.text}</p><a className="pl2-text-link" href={`/${locale}/product`}>{es ? "Ver cómo se estructura" : "See how it is structured"}<Icon name="arrow-right" size={14}/></a></div>
              <div className="pl2-report-preview" aria-hidden="true">
                <div className="pl2-report-head"><strong>Executive Summary</strong><span>Q2 · 2026</span></div>
                <div className="pl2-report-score"><div><strong>78</strong><span>{es ? "Índice global" : "Overall index"}</span></div><i><b/></i></div>
                <div className="pl2-report-lines"><i/><i/><i/></div>
                <div className="pl2-report-metrics"><span><b>82</b>{es ? "Liderazgo" : "Leadership"}</span><span><b>76</b>{es ? "Cultura" : "Culture"}</span><span><b>68</b>{es ? "Ejecución" : "Execution"}</span></div>
                <div className="pl2-report-callout"><Icon name="sparkles" size={15}/><span>{es ? "La claridad de liderazgo mejora; la ejecución concentra la principal brecha." : "Leadership clarity improves; execution holds the main gap."}</span></div>
              </div>
            </article>

            <div className="pl2-output-stack">
              {outputs.slice(1).map((item, index) => (
                <article className="pl2-output-row" key={item.title}>
                  <span className="pl2-icon-box"><Icon name={item.icon} size={19}/></span>
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  <div className={`pl2-output-mini mini-${index + 1}`} aria-hidden="true">
                    {index === 0 ? <><i/><i/><i/><i/></> : null}
                    {index === 1 ? <><span className="risk-high"/><span className="risk-mid"/><span className="risk-low"/></> : null}
                    {index === 2 ? <><i/><i/><i/></> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <p className="pl2-demo-note">{es ? "Visualizaciones ilustrativas · no representan resultados reales de clientes." : "Illustrative visualizations · not real client results."}</p>
        </div>
      </section>

      <section className="pl2-section pl2-trust pl2-reveal">
        <div className="container pl2-trust-grid">
          <div className="pl2-trust-copy"><h2>{es ? <>Tus datos y tu organización,<br/>protegidos por diseño.</> : <>Your data and organization,<br/>protected by design.</>}</h2><p>{es ? "Confidencialidad, trazabilidad y rigor metodológico forman parte de la arquitectura del producto y de sus flujos de trabajo." : "Confidentiality, traceability and methodological rigour are built into the product architecture and its workflows."}</p><a className="btn pl2-secondary-action" href={`/${locale}/trust`}>{es ? "Conoce nuestro enfoque" : "Explore our approach"}<Icon name="arrow-right" size={15}/></a></div>
          <div className="pl2-shield-art" aria-hidden="true">
            <img className="pl2-trust-illustration" src="/brand/proofline-trust-shield.png" alt="" loading="lazy"/>
          </div>
          <div className="pl2-trust-list">
            <div><span className="pl2-icon-box"><Icon name="lock" size={18}/></span><div><h3>{es ? "Privacidad desde el diseño" : "Privacy by design"}</h3><p>{es ? "Recogida proporcional, separación de identidad y reglas de acceso." : "Proportionate collection, identity separation and access rules."}</p></div></div>
            <div><span className="pl2-icon-box"><Icon name="governance" size={18}/></span><div><h3>{es ? "Evidencia trazable" : "Traceable evidence"}</h3><p>{es ? "Conclusiones conectadas con metodología, datos y límites." : "Conclusions linked to method, data and limitations."}</p></div></div>
            <div><span className="pl2-icon-box"><Icon name="reports" size={18}/></span><div><h3>{es ? "Metodología rigurosa" : "Methodological rigour"}</h3><p>{es ? "Versionado, contexto y criterios reproducibles." : "Versioning, context and reproducible criteria."}</p></div></div>
            <div><span className="pl2-icon-box"><Icon name="security" size={18}/></span><div><h3>{es ? "Gobernanza verificable" : "Verifiable governance"}</h3><p>{es ? "Roles, permisos y acciones sensibles con trazabilidad." : "Roles, permissions and sensitive actions with traceability."}</p></div></div>
          </div>
        </div>
      </section>

      <section className="pl2-section pl2-solutions pl2-reveal">
        <div className="container">
          <div className="pl2-section-heading">
            <h2>{es ? "Un enfoque, múltiples áreas de impacto." : "One approach, multiple areas of impact."}</h2>
            <div className="pl2-heading-aside"><p>{es ? "Aplica inteligencia organizacional a retos distintos manteniendo el mismo estándar de evidencia y gobierno." : "Apply organizational intelligence to different challenges while maintaining the same standard of evidence and governance."}</p><a href={`/${locale}/solutions`}>{es ? "Explorar todas las soluciones" : "Explore all solutions"}<Icon name="arrow-right" size={15}/></a></div>
          </div>
          <div className="pl2-solutions-grid">
            {solutions.map((item) => <a className="pl2-solution-card" href={`/${locale}/solutions`} key={item.title}><span className="pl2-solution-top"><span className="pl2-icon-box"><Icon name={item.icon} size={20}/></span><span className="pl2-solution-arrow"><Icon name="arrow-right" size={18}/></span></span><h3>{item.title}</h3><p>{item.text}</p><span className="pl2-solution-link">{es ? "Ver solución" : "View solution"}</span></a>)}
          </div>
        </div>
      </section>

      <section className="pl2-cta-section pl2-reveal">
        <div className="container">
          <div className="pl2-cta-banner">
            <div className="pl2-cta-copy"><h2>{es ? "Ve tu organización con más claridad." : "See your organization more clearly."}</h2><p>{es ? "Solicita una demo personalizada y descubre cómo Proofline puede ayudarte a convertir evidencia en decisiones mejor fundamentadas." : "Request a personalized demo and see how Proofline can help turn evidence into better-grounded decisions."}</p><div className="pl2-cta-actions"><a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Request a demo"}<Icon name="arrow-right" size={16}/></a><a className="btn pl2-ghost-action" href={`/${locale}/product`}>{es ? "Ver cómo funciona" : "See how it works"}<Icon name="arrow-right" size={16}/></a></div></div>
            <div className="pl2-cta-signal" aria-hidden="true"/>
          </div>
        </div>
      </section>
    </div>
  );
}
