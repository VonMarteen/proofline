import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { CtaBand } from "../../../components/cta-band";
import { localizedFramework, publicFrameworks } from "../../../lib/frameworks";

export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const frameworks = publicFrameworks.map((framework) => localizedFramework(framework, locale));

  const originLabel = (origin: string) => {
    if (locale === "en") return origin === "ORIGINAL" ? "Proofline" : origin === "PARTNER_READY" ? "Partner-ready" : "Editable";
    return origin === "ORIGINAL" ? "Proofline" : origin === "PARTNER_READY" ? "Preparado para partner" : "Editable";
  };

  return <>
    <section className="page-hero">
      <div className="container">
        <PageIntro
          title={es ? "No siempre hay que empezar desde una hoja en blanco." : "You do not always need to start from a blank page."}
          text={es
            ? "La Library reúne frameworks que pueden servir como punto de partida, convivir con metodologías privadas o complementarse con cuestionarios importados. Cada pieza explica qué intenta responder, para qué contextos está pensada y qué estructura habría que revisar antes de utilizarla."
            : "The Library brings together frameworks that can serve as a starting point, coexist with private methodologies or complement imported questionnaires. Each item explains what it aims to answer, which contexts it is designed for and which structure should be reviewed before use."}
        />
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container">
        <div className="library-guidance">
          <div><strong>{es ? "Usar" : "Use"}</strong><span>{es ? "Partir de un framework existente cuando el objetivo, la población y el tipo de decisión encajan con tu caso." : "Start from an existing framework when the objective, population and decision type fit your case."}</span></div>
          <div><strong>{es ? "Adaptar" : "Adapt"}</strong><span>{es ? "Duplicar y ajustar una base existente manteniendo claro qué cambió y qué comparaciones siguen siendo válidas." : "Duplicate and adjust an existing base while keeping clear what changed and which comparisons remain valid."}</span></div>
          <div><strong>{es ? "Importar" : "Import"}</strong><span>{es ? "Traer un cuestionario propio para someterlo al mismo ciclo de revisión, versionado y gobierno que el resto de la Library." : "Bring your own questionnaire into the same review, versioning and governance cycle as the rest of the Library."}</span></div>
          <div><strong>{es ? "Publicar" : "Publish"}</strong><span>{es ? "Preparar metodologías de partners para distribución controlada, bibliotecas privadas o modelos de licencia cuando corresponda." : "Prepare partner methodologies for controlled distribution, private libraries or licensing models where appropriate."}</span></div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="content-heading two-column-heading">
          <h2>{es ? "Frameworks de demostración" : "Demo frameworks"}</h2>
          <p>{es ? "Cada ficha permite entender el objetivo, la audiencia, las dimensiones y los principales casos de uso antes de decidir si merece la pena adaptarla." : "Each profile lets you understand the objective, audience, dimensions and main use cases before deciding whether it is worth adapting."}</p>
        </div>
        <div className="framework-grid">
          {frameworks.map((framework) => <a className="framework-card" href={`/${locale}/library/${framework.slug}`} key={framework.slug}>
            <h3>{framework.title}</h3>
            <p>{framework.summary}</p>
            <div className="framework-meta">
              <div><span>{es ? "Duración orientativa" : "Indicative duration"}</span><strong>{framework.duration}</strong></div>
              <div><span>{es ? "Dimensiones" : "Dimensions"}</span><strong>{framework.dimensions.length}</strong></div>
            </div>
            <div className="framework-audience"><span>{es ? "Pensado para" : "Designed for"}</span><strong>{framework.audience}</strong></div>
            <div className="framework-provenance"><span>{es ? "Procedencia" : "Provenance"}</span><strong>{originLabel(framework.origin)}</strong></div>
            <div className="framework-link">{es ? "Abrir ficha completa" : "Open full profile"} →</div>
          </a>)}
        </div>
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container private-library-grid">
        <div>
          <h2>{es ? "Tu metodología no tiene que hacerse pública para vivir en Proofline." : "Your methodology does not need to be public to live in Proofline."}</h2>
          <p>{es
            ? "Una organización o partner puede mantener una Library privada con sus propios cuestionarios, dimensiones, scoring y reglas. El valor está en tratarlos como activos metodológicos gobernados: con versiones, permisos, comparabilidad, procedencia y evidencia de uso."
            : "An organization or partner can keep a private Library with its own questionnaires, dimensions, scoring and rules. The value is treating them as governed methodological assets: with versions, permissions, comparability, provenance and usage evidence."}</p>
        </div>
        <div className="private-library-list">
          <div><strong>{es ? "Procedencia" : "Provenance"}</strong><span>{es ? "Quién creó el framework, quién puede usarlo y bajo qué modalidad se distribuye." : "Who created the framework, who can use it and under which model it is distributed."}</span></div>
          <div><strong>{es ? "Edición" : "Editing"}</strong><span>{es ? "Qué puede cambiarse dentro de una versión y qué modificación debería crear una nueva versión metodológica." : "What can change within a version and which modification should create a new methodological version."}</span></div>
          <div><strong>{es ? "Comparabilidad" : "Comparability"}</strong><span>{es ? "Qué cambios permiten seguir comparando oleadas y cuáles deben quedar documentados como una ruptura de serie." : "Which changes preserve comparison across waves and which should be documented as a break in series."}</span></div>
          <div><strong>{es ? "Licencia" : "Licence"}</strong><span>{es ? "Arquitectura preparada para bibliotecas privadas, distribución partner y modelos de licencia o revenue share cuando el negocio lo requiera." : "Architecture ready for private libraries, partner distribution and licensing or revenue-share models when the business requires them."}</span></div>
        </div>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "¿Ya tienes un cuestionario o una metodología propia?" : "Already have a questionnaire or proprietary methodology?"}
      text={es ? "No hace falta empezar desde nuestra Library. Podemos enseñarte cómo importarlo, versionarlo, revisarlo y mantener su gobernanza dentro del mismo flujo." : "You do not need to start from our Library. We can show you how to import, version, review and govern it within the same flow."}
      secondaryHref={`/${locale}/product`}
      secondaryLabel={es ? "Ver el ciclo de producto" : "View the product cycle"}
    />
  </>;
}
