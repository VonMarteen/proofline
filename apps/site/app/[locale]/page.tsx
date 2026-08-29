import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { Icon, type ProoflineIconName } from "@proofline/ui";
import { copy } from "../../lib/copy";
import { EvidencePreview } from "../../components/evidence-preview";
import { CtaBand } from "../../components/cta-band";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const c = copy[locale];
  const es = locale === "es";

  const capabilities: Array<{ icon: ProoflineIconName; title: string; text: string; className: string }> = es ? [
    { icon: "clipboard-check", title: "Diseña antes de preguntar", text: "Objetivo, cuestionario y población quedan conectados desde el principio para detectar huecos antes de lanzar.", className: "bento-primary" },
    { icon: "governance", title: "Privacidad operativa", text: "Confidencialidad, cohortes y avisos versionados forman parte del flujo, no de una revisión final.", className: "bento-trust" },
    { icon: "sparkles", title: "IA con límites claros", text: "Asiste en revisión y síntesis sin convertir inferencias en hechos ni esconder la evidencia debajo.", className: "bento-ai" },
    { icon: "reports", title: "Respuesta ejecutiva primero", text: "La dirección recibe una lectura clara y quien necesite profundidad puede bajar hasta métricas, comentarios y reglas.", className: "bento-report" },
    { icon: "history", title: "Trazabilidad de punta a punta", text: "Versiones, decisiones y salidas conservan contexto suficiente para explicar cómo se llegó al resultado.", className: "bento-history" },
  ] : [
    { icon: "clipboard-check", title: "Design before asking", text: "Objective, questionnaire and population stay connected from the start so gaps surface before launch.", className: "bento-primary" },
    { icon: "governance", title: "Operational privacy", text: "Confidentiality, cohorts and versioned notices live in the workflow, not in a final review.", className: "bento-trust" },
    { icon: "sparkles", title: "AI with explicit boundaries", text: "Supports review and synthesis without turning inference into fact or hiding the evidence underneath.", className: "bento-ai" },
    { icon: "reports", title: "Executive answer first", text: "Leadership gets a clear reading while specialists can drill into metrics, comments and rules.", className: "bento-report" },
    { icon: "history", title: "End-to-end traceability", text: "Versions, decisions and outputs retain enough context to explain how the result was reached.", className: "bento-history" },
  ];


  return <>
    <section className="site-home-hero">
      <div className="site-hero-glow site-hero-glow-a" aria-hidden="true" />
      <div className="site-hero-glow site-hero-glow-b" aria-hidden="true" />
      <div className="container site-hero-shell">
        <div className="site-hero-copy">
          <h1>{c.hero.title}</h1>
          <p className="hero-lead">{c.hero.text}</p>
          <div className="hero-actions site-hero-actions">
            <Link className="btn btn-accent site-hero-primary" href={`/${locale}/product`}>{c.hero.primary}<Icon name="arrow-right" size={16} /></Link>
            <Link className="btn site-hero-secondary" href={`/${locale}/contact`}>{es ? "Ver una demo" : "See a demo"}</Link>
          </div>
        </div>
        <div className="site-product-visual">
          <EvidencePreview locale={locale} />
        </div>
      </div>
    </section>

    <section className="section home-positioning">
      <div className="container home-positioning-grid">
        <div className="home-positioning-title">
          <h2>{es ? "No necesitas más encuestas. Necesitas una respuesta defendible." : "You do not need more surveys. You need a defensible answer."}</h2>
        </div>
        <div className="home-positioning-copy">
          <p>{es
            ? "Proofline conecta el trabajo que normalmente queda repartido entre formularios, hojas de cálculo, consultoría, análisis y presentaciones. El valor no está en recoger respuestas: está en preservar el hilo entre la pregunta original y la decisión final."
            : "Proofline connects work that normally lives across forms, spreadsheets, consulting, analysis and presentations. The value is not collecting responses; it is preserving the thread between the original question and the final decision."}</p>
          <Link className="text-link editorial-link" href={`/${locale}/product`}>{es ? "Cómo funciona Proofline" : "How Proofline works"}<Icon name="arrow-right" size={15} /></Link>
        </div>
      </div>
    </section>

    <section className="section home-bento-section">
      <div className="container">
        <div className="home-section-heading">
          <h2>{es ? "Todo lo que convierte un assessment en inteligencia organizacional." : "Everything that turns an assessment into organizational intelligence."}</h2>
          <p>{es ? "Un mismo hilo conecta diseño, privacidad, análisis y reporting para que el resultado conserve contexto y evidencia." : "One continuous thread connects design, privacy, analysis and reporting so the result keeps its context and evidence."}</p>
        </div>
        <div className="commercial-bento">
          {capabilities.map(item => <article className={`commercial-bento-card ${item.className}`} key={item.title}>
            <div className="bento-card-copy">
              <div className="bento-title-row"><span className="bento-icon"><Icon name={item.icon} size={18} /></span><h3>{item.title}</h3></div>
              <p>{item.text}</p>
            </div>
            {item.className === "bento-primary" ? <div className="bento-mini-ui" aria-hidden="true">
              <div><span>Objective coverage</span><strong>92%</strong></div>
              <div className="bento-mini-track"><i /></div>
              <div className="bento-mini-row"><span>Privacy</span><b>Ready</b></div>
              <div className="bento-mini-row"><span>Question load</span><b>Good</b></div>
            </div> : null}
          </article>)}
        </div>
      </div>
    </section>

    <section className="section home-outcome-section">
      <div className="container home-outcome-showcase">
        <div className="outcome-showcase-copy">
          <h2>{es ? "Una respuesta para dirección. Toda la evidencia para quien la necesita." : "One answer for leadership. All the evidence for those who need it."}</h2>
          <p>{es ? "Proofline evita dos extremos: el dashboard interminable y el PDF opaco. Empieza por la lectura ejecutiva y mantiene debajo el camino hacia la evidencia." : "Proofline avoids two extremes: the endless dashboard and the opaque PDF. It starts with the executive reading and keeps the path to evidence underneath."}</p>
          <Link className="btn" href={`/${locale}/product`}>{es ? "Explorar reporting" : "Explore reporting"}<Icon name="arrow-right" size={15} /></Link>
        </div>
        <div className="outcome-stack" aria-label={es ? "Capas de reporting" : "Reporting layers"}>
          <article className="outcome-stack-card outcome-stack-answer"><div><strong>{es ? "Respuesta" : "Answer"}</strong><p>{es ? "Qué puedes afirmar, qué no y con qué nivel de evidencia." : "What you can claim, what you cannot and with what level of evidence."}</p></div><Icon name="approved" size={18} /></article>
          <article className="outcome-stack-card outcome-stack-insights"><div><strong>Insights</strong><p>{es ? "Dónde aparecen diferencias, tendencias y temas recurrentes." : "Where differences, trends and recurring themes appear."}</p></div><Icon name="sparkles" size={18} /></article>
          <article className="outcome-stack-card outcome-stack-evidence"><div><strong>{es ? "Evidencia" : "Evidence"}</strong><p>{es ? "Distribuciones, cohortes, comentarios, scoring y limitaciones." : "Distributions, cohorts, comments, scoring and limitations."}</p></div><Icon name="reports" size={18} /></article>
        </div>
      </div>
    </section>

    <section className="section home-modes-section">
      <div className="container">
        <div className="home-section-heading">
          <h2>{es ? "Para equipos internos y para quienes convierten metodología en servicio." : "For internal teams and for those turning methodology into a service."}</h2>
        </div>
        <div className="commercial-mode-grid">
          <article className="commercial-mode-card">
            <h3>Proofline Direct</h3>
            <p>{es ? "Diseña, lanza y repite assessments con un proceso guiado que mantiene método, privacidad y reporting conectados." : "Design, launch and repeat assessments through a guided process that keeps method, privacy and reporting connected."}</p>
            <Link href={`/${locale}/solutions#direct`} className="text-link">{es ? "Conocer Direct" : "Explore Direct"}<Icon name="arrow-right" size={15} /></Link>
          </article>
          <article className="commercial-mode-card commercial-mode-card-accent">
            <h3>Proofline Professional</h3>
            <p>{es ? "Opera múltiples clientes, frameworks y audiencias sin multiplicar hojas de cálculo, versiones ni trabajo manual." : "Operate multiple clients, frameworks and audiences without multiplying spreadsheets, versions or manual work."}</p>
            <Link href={`/${locale}/solutions#professional`} className="text-link">{es ? "Conocer Professional" : "Explore Professional"}<Icon name="arrow-right" size={15} /></Link>
          </article>
        </div>
      </div>
    </section>

    <section className="section home-trust-section">
      <div className="container home-trust-panel">
        <div className="home-trust-copy">
          <h2>{es ? "La confianza no se añade al final del informe." : "Trust is not added at the end of the report."}</h2>
          <p>{es ? "Qué datos se necesitan, para qué, quién puede acceder y qué se puede mostrar por cohortes se decide dentro del producto y queda trazable." : "Which data are needed, why, who can access them and what can be shown by cohort are decided inside the product and remain traceable."}</p>
          <Link className="btn btn-ghost trust-panel-link" href={`/${locale}/trust`}>{es ? "Explorar Trust Center" : "Explore Trust Center"}<Icon name="arrow-right" size={15} /></Link>
        </div>
        <div className="home-trust-list">
          <div><Icon name="lock" size={17} /><span><strong>{es ? "Datos mínimos" : "Minimum data"}</strong><small>{es ? "Cada campo necesita propósito." : "Every field needs a purpose."}</small></span></div>
          <div><Icon name="people" size={17} /><span><strong>{es ? "Identidad separada" : "Separated identity"}</strong><small>{es ? "Menos exposición innecesaria." : "Less unnecessary exposure."}</small></span></div>
          <div><Icon name="history" size={17} /><span><strong>{es ? "Evidencia versionada" : "Versioned evidence"}</strong><small>{es ? "Contexto para revisión posterior." : "Context for later review."}</small></span></div>
          <div><Icon name="sparkles" size={17} /><span><strong>{es ? "IA gobernada" : "Governed AI"}</strong><small>{es ? "Funciones explícitas y revisables." : "Explicit, reviewable functions."}</small></span></div>
        </div>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Si la pregunta importa, el proceso también." : "If the question matters, so does the process."}
      text={es ? "Cuéntanos qué necesitas poder responder. Te mostramos cómo Proofline preserva el hilo desde el diseño hasta la decisión." : "Tell us what you need to answer. We will show how Proofline preserves the thread from design to decision."}
      secondaryHref={`/${locale}/library`}
      secondaryLabel={es ? "Explorar assessments" : "Explore assessments"}
    />
  </>;
}
