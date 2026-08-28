import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { CtaBand } from "../../../components/cta-band";

type LegalDetail = {
  id: string;
  title: string;
  intro: string;
  points: Array<{ title: string; text: string }>;
};

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const sections = es ? [
    { id: "privacidad", title: "Aviso de privacidad", summary: "Explica de forma comprensible quién trata los datos, para qué se utilizan, qué información interviene, quién puede recibirla y qué derechos tiene la persona." },
    { id: "contratos", title: "Términos y DPA", summary: "Ordena la relación contractual y de tratamiento entre Proofline, la organización y, cuando proceda, partners, con documentos versionados y responsabilidades diferenciadas." },
    { id: "consentimientos", title: "Consentimientos específicos", summary: "Sólo se solicitan cuando existe una finalidad concreta para la que el consentimiento es realmente el permiso adecuado, separado de avisos y obligaciones contractuales." },
    { id: "participantes", title: "Información al participante", summary: "Cada assessment puede necesitar información propia y versionada sobre propósito, participación, confidencialidad, destinatarios, retención y derechos." },
    { id: "retencion", title: "Retención y derechos", summary: "La conservación, el borrado, la exportación, los derechos y las posibles excepciones deben responder a reglas conocidas y quedar trazables cuando corresponda." },
    { id: "cookies", title: "Cookies y preferencias", summary: "Lo estrictamente necesario para operar la web se separa de analítica, personalización o marketing no esenciales, con preferencias claras y modificables." },
  ] : [
    { id: "privacy", title: "Privacy notice", summary: "Explains in understandable terms who processes data, why it is used, which information is involved, who may receive it and which rights people have." },
    { id: "contracts", title: "Terms & DPA", summary: "Organises the contractual and processing relationship between Proofline, the organization and partners where relevant, with versioned documents and distinct responsibilities." },
    { id: "consents", title: "Specific consents", summary: "Requested only for a specific purpose where consent is genuinely the appropriate permission, separate from notices and contractual obligations." },
    { id: "participants", title: "Participant information", summary: "Each assessment may need its own versioned information covering purpose, participation, confidentiality, recipients, retention and rights." },
    { id: "retention", title: "Retention & rights", summary: "Retention, deletion, export, rights and possible exceptions should follow known rules and remain traceable where appropriate." },
    { id: "cookies", title: "Cookies & preferences", summary: "Strictly necessary functionality is separated from non-essential analytics, personalisation or marketing, with clear and changeable preferences." },
  ];

  const details: LegalDetail[] = es ? [
    {
      id: "privacidad",
      title: "Aviso de privacidad",
      intro: "El aviso de privacidad permite que una persona entienda el tratamiento antes de facilitar información o participar. Debe explicar el contexto de forma accesible y específica: quién interviene, qué datos se necesitan, para qué se utilizarán, durante cuánto tiempo y cómo ejercer derechos. Informar no equivale a pedir consentimiento.",
      points: [
        { title: "Quién interviene", text: "Identificación del responsable, del encargado cuando corresponda y de los contactos relevantes para privacidad." },
        { title: "Qué se trata y para qué", text: "Categorías de datos, finalidad concreta del tratamiento y relación con el assessment o servicio que origina la recogida." },
        { title: "Base jurídica y destinatarios", text: "La organización declara la base jurídica aplicable y debe conocer qué terceros o categorías de destinatarios pueden recibir información." },
        { title: "Retención y derechos", text: "Plazos o criterios de conservación, derechos aplicables y un canal comprensible para ejercerlos o plantear consultas." },
      ],
    },
    {
      id: "contratos",
      title: "Términos, acuerdos y DPA",
      intro: "La relación comercial con Proofline y la relación de tratamiento de datos requieren documentos distintos, responsabilidades claras y versiones trazables. El objetivo es que cada organización pueda saber qué aceptó, bajo qué condiciones y qué acuerdos regulan el servicio y el encargo de tratamiento.",
      points: [
        { title: "Relación comercial", text: "Términos de servicio, órdenes de servicio y condiciones particulares deben reflejar alcance, plan, responsabilidades y condiciones económicas aplicables." },
        { title: "Encargo de tratamiento", text: "Cuando Proofline actúe como encargado, el DPA debe describir objeto, duración, categorías de datos, obligaciones, seguridad y condiciones de subcontratación." },
        { title: "Versionado y aceptación", text: "Cada interacción relevante debe conservar versión, fecha, idioma, actor y contexto para saber exactamente qué documento estaba vigente." },
        { title: "Cambios materiales", text: "Las modificaciones relevantes de términos o acuerdos deben poder comunicarse, revisarse y registrar su aceptación cuando jurídicamente corresponda." },
      ],
    },
    {
      id: "consentimientos",
      title: "Consentimientos específicos",
      intro: "Proofline no utiliza el consentimiento como etiqueta genérica para cualquier interacción legal. Cuando el consentimiento sea realmente la base o permiso adecuado, debe presentarse separado, para una finalidad concreta, sin casillas premarcadas y con capacidad de registrar rechazo o retirada cuando proceda.",
      points: [
        { title: "Finalidad independiente", text: "Un consentimiento debe responder a una finalidad específica y distinguible de la mera prestación del servicio o de obligaciones contractuales." },
        { title: "Elección real", text: "La persona debe poder aceptar o rechazar sin confundir la decisión con la lectura de un aviso de privacidad o con la aceptación de términos necesarios." },
        { title: "Evidencia de la decisión", text: "La plataforma debe conservar qué se solicitó, qué versión se mostró, qué acción realizó la persona y cuándo ocurrió." },
        { title: "Retirada trazable", text: "Cuando el consentimiento pueda retirarse, la retirada debe registrarse y propagarse al tratamiento afectado sin borrar la evidencia histórica necesaria." },
      ],
    },
    {
      id: "participantes",
      title: "Información específica al participante",
      intro: "Dos assessments de la misma organización pueden tener finalidades, poblaciones, campos, reglas de confidencialidad y destinatarios diferentes. Por eso la información presentada al participante debe adaptarse al estudio concreto y quedar versionada junto con la experiencia que vio antes de responder.",
      points: [
        { title: "Propósito y promotor", text: "Debe quedar claro quién impulsa el assessment, qué quiere conocer y para qué se utilizarán los resultados." },
        { title: "Condiciones de participación", text: "La experiencia debe indicar si la participación es voluntaria u obligatoria y qué consecuencias existen, si las hubiera." },
        { title: "Confidencialidad comprensible", text: "Hay que explicar de forma concreta si la respuesta es identificada, pseudónima o anónima y qué límites tiene cada modalidad." },
        { title: "Versión e idioma", text: "La plataforma debe conservar qué notice específico se mostró, en qué idioma y bajo qué versión antes de iniciar el cuestionario." },
      ],
    },
    {
      id: "retencion",
      title: "Retención, derechos y conservación legal",
      intro: "La conservación no debería quedar librada a una política única para todos los datos. Proofline contempla reglas diferenciadas según el tipo de información, el assessment y las obligaciones aplicables, además de flujos para derechos y situaciones excepcionales en las que determinada evidencia deba preservarse.",
      points: [
        { title: "Políticas diferenciadas", text: "Respuestas, identidad, evidencias legales, informes y logs pueden requerir criterios de conservación distintos según su finalidad." },
        { title: "Derechos de las personas", text: "Acceso, rectificación, supresión, oposición u otros derechos aplicables necesitan un flujo identificable, verificable y con resolución trazable." },
        { title: "Borrado controlado", text: "Las eliminaciones deben ejecutarse de forma coherente entre sistemas y dejar la evidencia mínima necesaria para demostrar que el proceso ocurrió." },
        { title: "Conservación legal separada", text: "Cuando exista una obligación legítima de conservar determinada evidencia, esa excepción debe documentarse y mantenerse separada de la retención ordinaria." },
      ],
    },
    {
      id: "cookies",
      title: "Cookies y preferencias",
      intro: "La web pública distingue lo necesario para prestar el servicio de cualquier analítica, personalización o marketing no esencial. La preferencia debe poder comprenderse y modificarse fácilmente, sin convertir la aceptación de categorías opcionales en una condición para navegar o solicitar información.",
      points: [
        { title: "Necesario frente a opcional", text: "Las funciones técnicas imprescindibles se separan de categorías no esenciales y no se presentan como si todas fueran equivalentes." },
        { title: "Decisiones simétricas", text: "Aceptar, rechazar y configurar deben ofrecerse con una jerarquía visual comparable y sin categorías opcionales activadas por defecto." },
        { title: "Preferencias técnicas", text: "Idioma, tema u otras preferencias puramente funcionales pueden gestionarse de forma separada de analítica y marketing." },
        { title: "Cambio posterior", text: "La persona debe poder volver a abrir sus preferencias y modificarlas sin fricción cuando lo necesite." },
      ],
    },
  ] : [
    {
      id: "privacy",
      title: "Privacy notice",
      intro: "A privacy notice allows a person to understand processing before providing information or participating. It should explain the context accessibly and specifically: who is involved, what data is needed, why it will be used, how long it is retained and how rights can be exercised. Information is not the same as consent.",
      points: [
        { title: "Who is involved", text: "Identify the controller, processor where applicable and relevant privacy contacts." },
        { title: "What is processed and why", text: "Data categories, the concrete processing purpose and its relationship to the assessment or service that triggered collection." },
        { title: "Legal basis and recipients", text: "The organization declares the applicable legal basis and should know which third parties or recipient categories may receive information." },
        { title: "Retention and rights", text: "Retention periods or criteria, applicable rights and a clear channel through which people can exercise them or ask questions." },
      ],
    },
    {
      id: "contracts",
      title: "Terms, agreements & DPA",
      intro: "The commercial relationship with Proofline and the data-processing relationship require distinct documents, clear responsibilities and traceable versions. Each organization should be able to know what it accepted, under which conditions and which agreements govern service delivery and processing.",
      points: [
        { title: "Commercial relationship", text: "Terms of service, order forms and specific conditions should reflect scope, plan, responsibilities and applicable commercial conditions." },
        { title: "Data processing", text: "Where Proofline acts as processor, the DPA should describe subject matter, duration, data categories, obligations, security and subprocessor conditions." },
        { title: "Versioning and acceptance", text: "Relevant interactions should retain version, date, language, actor and context so the governing document can be identified precisely." },
        { title: "Material changes", text: "Relevant changes to terms or agreements should be communicable, reviewable and record acceptance where legally required." },
      ],
    },
    {
      id: "consents",
      title: "Specific consents",
      intro: "Proofline does not use consent as a generic label for every legal interaction. Where consent is genuinely the appropriate basis or permission, it should be separate, purpose-specific, unbundled and able to record rejection or withdrawal where applicable.",
      points: [
        { title: "Independent purpose", text: "Consent should relate to a specific purpose distinguishable from service delivery or contractual obligations." },
        { title: "Genuine choice", text: "People should be able to accept or reject without confusing that choice with reading a privacy notice or accepting necessary terms." },
        { title: "Evidence of the choice", text: "The platform should retain what was requested, which version was shown, what action the person took and when it occurred." },
        { title: "Traceable withdrawal", text: "Where consent can be withdrawn, the withdrawal should be recorded and propagated to affected processing while preserving necessary historical evidence." },
      ],
    },
    {
      id: "participants",
      title: "Assessment-specific participant information",
      intro: "Two assessments from the same organization can have different purposes, populations, fields, confidentiality rules and recipients. Participant information should therefore adapt to the specific study and remain versioned alongside the experience shown before responding.",
      points: [
        { title: "Purpose and sponsor", text: "It should be clear who sponsors the assessment, what it seeks to understand and how results will be used." },
        { title: "Participation conditions", text: "The experience should state whether participation is voluntary or mandatory and any relevant consequences." },
        { title: "Understandable confidentiality", text: "Explain concretely whether responses are identified, pseudonymous or anonymous and the limits of each mode." },
        { title: "Version and language", text: "The platform should retain which assessment-specific notice was shown, in which language and under which version before the questionnaire began." },
      ],
    },
    {
      id: "retention",
      title: "Retention, rights & legal hold",
      intro: "Retention should not depend on one policy for every data type. Proofline supports differentiated rules by information type, assessment and applicable obligations, alongside rights workflows and exceptional situations where specific evidence must be preserved.",
      points: [
        { title: "Differentiated policies", text: "Responses, identity, legal evidence, reports and logs can require different retention criteria according to purpose." },
        { title: "Individual rights", text: "Access, rectification, deletion, objection and other applicable rights need an identifiable, verifiable and traceable workflow." },
        { title: "Controlled deletion", text: "Deletion should execute coherently across systems and retain only the minimum evidence needed to demonstrate the process occurred." },
        { title: "Separate legal hold", text: "Where a legitimate obligation requires evidence to be preserved, that exception should be documented and kept distinct from ordinary retention." },
      ],
    },
    {
      id: "cookies",
      title: "Cookies & preferences",
      intro: "The public site distinguishes what is necessary to provide the service from non-essential analytics, personalisation or marketing. Preferences should remain understandable and easy to change without making optional categories a condition for browsing or requesting information.",
      points: [
        { title: "Necessary versus optional", text: "Essential technical functions are separated from non-essential categories and are not presented as though every category were equivalent." },
        { title: "Symmetric choices", text: "Accept, reject and configure should have comparable visual hierarchy with no optional categories enabled by default." },
        { title: "Technical preferences", text: "Language, theme and other purely functional preferences can be handled separately from analytics and marketing." },
        { title: "Later changes", text: "People should be able to reopen preferences and change them without friction whenever needed." },
      ],
    },
  ];

  return <>
    <section className="page-hero">
      <div className="container">
        <PageIntro
          title={es ? "Información, contrato y consentimiento no son lo mismo." : "Information, contract and consent are not the same thing."}
          text={es
            ? "Proofline modela las interacciones legales como eventos distintos y versionados. Informar a una persona, aceptar unos términos, formalizar un acuerdo de tratamiento o dar un consentimiento específico son acciones diferentes, con finalidades distintas y evidencias distintas."
            : "Proofline models legal interactions as distinct, versioned events. Informing a person, accepting terms, formalising a processing agreement or giving a specific consent are different actions, with different purposes and different evidence."}
          aside={<div className="page-intro-note"><strong>{es ? "Centro legal de producto" : "Product legal center"}</strong><span>{es ? "La arquitectura funcional ya separa documentos, avisos, acuerdos y consentimientos. La redacción jurídica definitiva se valida antes de producción." : "The functional architecture already separates documents, notices, agreements and consents. Final legal wording is validated before production."}</span></div>}
        />
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container legal-nav-grid">
        {sections.map((item) => <a href={`#${item.id}`} className="legal-nav-card" key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
          <strong>{es ? "Abrir sección" : "Open section"} →</strong>
        </a>)}
      </div>
    </section>

    <section className="section">
      <div className="container legal-principle-grid">
        <div>
          <h2>{es ? "Cada interacción deja una evidencia distinta." : "Each interaction leaves different evidence."}</h2>
          <p className="legal-principle-copy">{es ? "La evidencia no consiste únicamente en guardar un PDF. También importa saber qué versión se mostró, a quién, en qué contexto y qué acción ocurrió sobre ese documento o aviso." : "Evidence is not only about storing a PDF. It also matters which version was shown, to whom, in which context and which action occurred around that document or notice."}</p>
        </div>
        <div className="legal-evidence-fields">
          {(es ? [
            ["Documento y versión", "Qué texto o acuerdo estaba vigente."],
            ["Idioma y jurisdicción", "Qué versión se presentó en ese contexto."],
            ["Actor", "Quién realizó la acción o qué referencia pseudónima lo representa."],
            ["Acción", "Informado, aceptado, consentido, rechazado o retirado, según corresponda."],
            ["Momento", "Cuándo ocurrió la interacción."],
            ["Contexto", "Assessment, organización, canal y propósito relacionado."],
          ] : [
            ["Document & version", "Which text or agreement was in force."],
            ["Language & jurisdiction", "Which version was presented in that context."],
            ["Actor", "Who performed the action or which pseudonymous reference represents them."],
            ["Action", "Informed, accepted, consented, rejected or withdrawn, as appropriate."],
            ["Time", "When the interaction occurred."],
            ["Context", "Related assessment, organization, channel and purpose."],
          ]).map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}
        </div>
      </div>
    </section>

    <section className="section legal-detail-section">
      <div className="container legal-detail-list">
        {details.map((item) => <article id={item.id} className="legal-detail-card" key={item.id}>
          <div className="legal-detail-heading">
            <h2>{item.title}</h2>
            <p>{item.intro}</p>
          </div>
          <div className="legal-detail-points">
            {item.points.map((point) => <div className="legal-detail-point" key={point.title}>
              <strong>{point.title}</strong>
              <p>{point.text}</p>
            </div>)}
          </div>
        </article>)}
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container legal-status-grid">
        <div>
          <h2>{es ? "De arquitectura legal a documentación de producción." : "From legal architecture to production documentation."}</h2>
          <p>{es
            ? "Proofline ya contempla documentos, versiones e interacciones legales como parte del producto. Antes de comercializar el servicio, esa arquitectura debe completarse con textos jurídicos revisados, mapa responsable/encargado, DPA, revisión de cookies, subencargados, transferencias y cualquier tratamiento especial aplicable al caso de uso."
            : "Proofline already supports documents, versions and legal interactions as product capabilities. Before commercial launch, that architecture needs reviewed legal wording, controller/processor mapping, DPA, cookie review, subprocessors, transfers and any special processing applicable to the use case."}</p>
        </div>
        <a className="btn" href={`/${locale}/trust`}>{es ? "Revisar arquitectura de confianza" : "Review trust architecture"}</a>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "Legal debe acompañar al producto desde el primer assessment." : "Legal should evolve with the product from the first assessment."}
      text={es ? "Si tu organización tiene requisitos jurídicos o de privacidad concretos, podemos revisarlos dentro del flujo del assessment desde el principio." : "If your organization has specific legal or privacy requirements, we can review them within the assessment flow from the start."}
      secondaryHref={`/${locale}/trust`}
      secondaryLabel={es ? "Ir al Trust Center" : "Go to Trust Center"}
    />
  </>;
}
