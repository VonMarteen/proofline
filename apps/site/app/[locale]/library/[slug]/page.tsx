import { notFound } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { CtaBand } from "../../../../components/cta-band";
import { localizedFramework, publicFrameworks } from "../../../../lib/frameworks";

export function generateStaticParams() {
  return publicFrameworks.flatMap((framework) => [
    { locale: "es", slug: framework.slug },
    { locale: "en", slug: framework.slug },
  ]);
}

export default async function FrameworkDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  const es = locale === "es";
  const source = publicFrameworks.find((framework) => framework.slug === slug);
  if (!source) notFound();
  const framework = localizedFramework(source, locale);
  const origin = locale === "es"
    ? source.origin === "ORIGINAL" ? "Proofline" : source.origin === "PARTNER_READY" ? "Preparado para partner" : "Plantilla editable"
    : source.origin === "ORIGINAL" ? "Proofline" : source.origin === "PARTNER_READY" ? "Partner-ready" : "Editable template";

  return <>
    <section className="framework-detail-hero">
      <div className="container">
        <a className="back-link" href={`/${locale}/library`}>← {es ? "Volver a Assessments" : "Back to Assessments"}</a>
        <div className="framework-detail-heading">
          <div>
            <h1>{framework.title}</h1>
            <p>{framework.objective}</p>
          </div>
          <div className="framework-detail-meta">
            <div><span>{es ? "Duración orientativa" : "Indicative duration"}</span><strong>{framework.duration}</strong></div>
            <div><span>{es ? "Dimensiones" : "Dimensions"}</span><strong>{framework.dimensions.length}</strong></div>
            <div><span>{es ? "Pensado para" : "Designed for"}</span><strong>{framework.audience}</strong></div>
            <div><span>{es ? "Procedencia" : "Provenance"}</span><strong>{origin}</strong></div>
          </div>
        </div>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container framework-detail-grid">
        <div className="framework-detail-main">
          <section>
            <h2>{es ? "Qué busca responder" : "What it is designed to answer"}</h2>
            <p>{framework.summary}</p>
            <p>{es
              ? "La estructura sirve como punto de partida para ordenar la conversación y la recogida de evidencia. Antes de utilizarla en un contexto real conviene ajustar lenguaje, población, escalas y reglas de scoring al objetivo concreto de la organización."
              : "The structure is a starting point for organising the conversation and evidence collection. Before using it in a real context, language, population, scales and scoring rules should be adapted to the organization's specific objective."}</p>
          </section>
          <section>
            <h2>{es ? "Dimensiones previstas" : "Planned dimensions"}</h2>
            <div className="dimension-list">{framework.dimensions.map((dimension) => <div key={dimension}><strong>{dimension}</strong></div>)}</div>
          </section>
          <section>
            <h2>{es ? "Casos de uso" : "Use cases"}</h2>
            <p className="section-supporting-copy">{es ? "Ejemplos de situaciones donde este marco puede ayudar a estructurar una investigación, siempre adaptando el instrumento al contexto." : "Examples of situations where this framework can help structure an investigation, with the instrument adapted to context."}</p>
            <ul className="detail-bullet-list">{framework.useCases.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h2>{es ? "Gobernanza del framework" : "Framework governance"}</h2>
            <p className="section-supporting-copy">{es ? "La utilidad de un framework no depende sólo de sus preguntas: también importa conservar qué versión se utilizó, qué cambió y bajo qué reglas se interpretan los resultados." : "A framework's value does not depend only on its questions: it also matters which version was used, what changed and under which rules results are interpreted."}</p>
            <ul className="detail-bullet-list">{framework.governance.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
        <aside className="framework-detail-aside">
          <strong>{es ? "Cómo lo adaptaríamos contigo" : "How we would adapt it with you"}</strong>
          <p>{es
            ? "En una demo podemos partir de esta estructura y revisar objetivo, población, dimensiones, escalas, scoring, privacidad y tipo de salida. Así puedes ver cómo se convierte una base metodológica en un assessment operable sin tratar el framework como una caja cerrada."
            : "In a demo we can start from this structure and review objective, population, dimensions, scales, scoring, privacy and output type. This shows how a methodological base becomes an operable assessment without treating the framework as a closed box."}</p>
          <a className="btn btn-primary framework-demo-button" href={`/${locale}/contact`}>{es ? "Ver este framework en una demo" : "See this framework in a demo"}</a>
          <span className="framework-detail-version">{es ? `Referencia metodológica: versión ${framework.version}` : `Methodology reference: version ${framework.version}`}</span>
        </aside>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Un framework es un punto de partida, no una caja negra." : "A framework is a starting point, not a black box."}
      text={es ? "Proofline está diseñado para que objetivo, dimensiones, scoring, versión y reglas sigan siendo visibles y gobernables a medida que el assessment evoluciona." : "Proofline is designed so objective, dimensions, scoring, version and rules remain visible and governable as the assessment evolves."}
      secondaryHref={`/${locale}/library`}
      secondaryLabel={es ? "Ver otros assessments" : "View other assessments"}
    />
  </>;
}
