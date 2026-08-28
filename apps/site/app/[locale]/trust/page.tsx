import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { CtaBand } from "../../../components/cta-band";

type TrustDetail = {
  id: string;
  title: string;
  intro: string;
  controls: Array<{ title: string; text: string }>;
  evidence: string;
};

export default async function TrustPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const principles = es ? [
    { id: "minimizacion", title: "Minimización con propósito", short: "Recoger sólo lo que el assessment necesita, con una finalidad comprensible y una conservación proporcionada." },
    { id: "separacion", title: "Identidad y respuesta separadas", short: "Reducir exposición evitando que identidad, respuesta y análisis circulen juntos cuando no es necesario." },
    { id: "confidencialidad", title: "Confidencialidad gobernada", short: "Aplicar reglas sobre cohortes, filtros y cruces para proteger a las personas incluso cuando el análisis es agregado." },
    { id: "ia", title: "IA acotada y trazable", short: "Usar IA donde aporta valor, manteniendo cálculos, decisiones y evidencia bajo controles explícitos y revisables." },
    { id: "auditoria", title: "Trazabilidad y auditoría", short: "Conservar contexto sobre cambios, accesos, aprobaciones y distribución para poder reconstruir qué ocurrió." },
    { id: "control", title: "Control visible para el cliente", short: "Hacer comprensibles las reglas de acceso, retención, tratamiento y distribución sin depender de promesas genéricas." },
  ] : [
    { id: "minimisation", title: "Purpose-bound minimisation", short: "Collect only what the assessment needs, with an understandable purpose and proportionate retention." },
    { id: "separation", title: "Separated identity and response", short: "Reduce exposure by avoiding unnecessary movement of identity, response and analytics together." },
    { id: "confidentiality", title: "Governed confidentiality", short: "Apply rules to cohorts, filters and cross-tabs to protect people even when analysis is aggregated." },
    { id: "ai", title: "Bounded, traceable AI", short: "Use AI where it adds value while keeping calculations, decisions and evidence under explicit, reviewable controls." },
    { id: "audit", title: "Traceability and audit", short: "Retain context around changes, access, approvals and distribution so relevant actions can be reconstructed." },
    { id: "control", title: "Visible client control", short: "Make access, retention, processing and distribution rules understandable without relying on generic promises." },
  ];

  const details: TrustDetail[] = es ? [
    {
      id: "minimizacion",
      title: "Minimización con propósito",
      intro: "Proofline vincula la recogida de datos al objetivo del assessment. La idea no es pedir información ‘por si acaso’, sino poder explicar por qué existe cada campo, durante cuánto tiempo se necesita y qué parte del proceso depende realmente de él.",
      controls: [
        { title: "Datos con una razón", text: "Los campos relevantes pueden asociarse a una finalidad concreta del assessment, evitando ampliar el formulario por inercia." },
        { title: "Retención proporcionada", text: "La conservación debe responder al caso de uso, diferenciando operación, análisis, evidencia y obligaciones que puedan requerir plazos distintos." },
        { title: "Sensibilidad bajo revisión", text: "Campos sensibles, segmentaciones de alto riesgo y metadata innecesaria se identifican antes del lanzamiento, no después de recoger respuestas." },
      ],
      evidence: "El cliente debería poder revisar qué información se recoge, qué finalidad la justifica, durante cuánto tiempo se conserva y qué configuración gobierna esa decisión.",
    },
    {
      id: "separacion",
      title: "Identidad y respuesta separadas",
      intro: "Confidencial no significa anónimo. Proofline modela identidad y contenido de respuesta como dominios distintos para que conocer quién es una persona no sea un requisito implícito de cada proceso analítico u operativo.",
      controls: [
        { title: "Identity Vault", text: "La identidad puede mantenerse en una capa específica, separada del almacén de respuestas y de la ejecución analítica." },
        { title: "Enlace controlado", text: "Cuando ambos dominios deben relacionarse, se utilizan referencias pseudónimas y accesos acotados en lugar de trasladar PII a todas las capas." },
        { title: "Menor superficie de exposición", text: "Workers, análisis y reporting pueden operar sin acceso directo a identidad siempre que el flujo no la necesite." },
      ],
      evidence: "La separación debe poder entenderse a través de la arquitectura, los permisos y los flujos de acceso, no únicamente mediante una declaración de confidencialidad.",
    },
    {
      id: "confidencialidad",
      title: "Confidencialidad gobernada",
      intro: "La confidencialidad útil no termina en un umbral mínimo. Filtros sucesivos, cruces de variables y comparaciones entre grupos pueden volver identificable una señal que parecía agregada, por lo que las reglas deben acompañar todo el análisis.",
      controls: [
        { title: "Protección de cohortes", text: "Los resultados pueden condicionarse a tamaños mínimos y a reglas que eviten mostrar segmentos excesivamente pequeños." },
        { title: "Control de inferencias", text: "Los cruces y filtros se evalúan también por su capacidad de revelar indirectamente información sobre personas o colectivos muy reducidos." },
        { title: "Distribución por audiencia", text: "No todas las personas necesitan el mismo nivel de detalle; el contenido puede ajustarse al alcance autorizado de cada audiencia." },
      ],
      evidence: "El assessment debería declarar cómo protege la confidencialidad y qué reglas condicionan filtros, cohortes y distribución antes de publicar resultados.",
    },
    {
      id: "ia",
      title: "IA acotada y explicable",
      intro: "Proofline utiliza IA como una capacidad especializada para revisar, sintetizar y ayudar a interpretar. La estadística autoritativa, las reglas de privacidad y las decisiones de negocio no se delegan a un modelo opaco.",
      controls: [
        { title: "Cálculo reproducible", text: "Scores, distribuciones, comparaciones y métricas autoritativas permanecen en motores deterministas y verificables." },
        { title: "Datos minimizados", text: "Antes de utilizar un modelo se reduce o redacta información personal cuando la función no necesita conocerla." },
        { title: "Salida con contexto", text: "La experiencia diferencia observación, asociación, hipótesis y recomendación para evitar presentar una interpretación como un hecho calculado." },
      ],
      evidence: "El cliente debería poder distinguir qué parte fue calculada estadísticamente, qué parte recibió asistencia de IA y qué revisión humana precedió a una salida sensible.",
    },
    {
      id: "auditoria",
      title: "Trazabilidad y auditoría",
      intro: "Una plataforma de evidencia necesita poder reconstruir decisiones relevantes. Cambiar una regla, acceder a información restringida o distribuir un informe son acciones distintas y deberían conservar contexto suficiente para ser revisadas después.",
      controls: [
        { title: "Cambios con contexto", text: "Versiones, configuraciones y aprobaciones relevantes pueden generar eventos que expliquen quién hizo qué y sobre qué alcance." },
        { title: "Acceso sensible justificado", text: "El soporte privilegiado está pensado para utilizar sesiones temporales, motivo explícito, step-up y auditoría reforzada en producción." },
        { title: "Distribución trazable", text: "La generación, revisión, aprobación y envío de informes pueden quedar vinculados a la versión y audiencia correspondientes." },
      ],
      evidence: "La trazabilidad debe servir a soporte, seguridad, privacidad y metodología; no limitarse a acumular eventos sin capacidad de interpretación.",
    },
    {
      id: "control",
      title: "Control visible para el cliente",
      intro: "La confianza aumenta cuando una organización puede ver y gobernar las reglas que afectan a sus estudios. Proofline busca exponer el contexto importante sin convertir cada assessment en una configuración imposible de operar.",
      controls: [
        { title: "Acceso por alcance", text: "Roles y permisos se plantean por organización, assessment y ámbito de datos, evitando que un cargo implique acceso universal." },
        { title: "Reglas antes del lanzamiento", text: "Finalidad, destinatarios, retención y perfil legal del assessment se preparan antes de invitar participantes." },
        { title: "Estado operativo visible", text: "Análisis, informes, aprobaciones y distribución deben mostrar un estado comprensible para quien gestiona el estudio." },
      ],
      evidence: "El cliente debería poder explicar quién accede, qué se trata, con qué reglas y qué evidencia queda, sin recurrir a una frase genérica de cumplimiento.",
    },
  ] : [
    {
      id: "minimisation",
      title: "Purpose-bound minimisation",
      intro: "Proofline links data collection to the assessment objective. The aim is not to request information ‘just in case’, but to explain why each field exists, how long it is needed and which part of the process genuinely depends on it.",
      controls: [
        { title: "Data with a reason", text: "Relevant fields can be tied to a concrete assessment purpose instead of expanding forms by default." },
        { title: "Proportionate retention", text: "Retention follows the use case, distinguishing operational, analytical, evidence and legal needs where different periods apply." },
        { title: "Sensitive data under review", text: "Sensitive fields, high-risk segmentation and unnecessary metadata are identified before launch, not after responses are collected." },
      ],
      evidence: "Clients should be able to review what is collected, why it is justified, how long it is retained and which configuration governs that decision.",
    },
    {
      id: "separation",
      title: "Separated identity and response",
      intro: "Confidential does not mean anonymous. Proofline models identity and response content as separate domains so knowing who a person is does not become an implicit requirement for every analytical or operational process.",
      controls: [
        { title: "Identity Vault", text: "Identity can remain in a dedicated layer, separated from response storage and analytical execution." },
        { title: "Controlled linkage", text: "Where both domains must relate, pseudonymous references and scoped access are used instead of moving PII through every layer." },
        { title: "Smaller exposure surface", text: "Workers, analytics and reporting can operate without direct identity access whenever the flow does not require it." },
      ],
      evidence: "The separation should be understandable through architecture, permissions and access flows rather than through a confidentiality statement alone.",
    },
    {
      id: "confidentiality",
      title: "Governed confidentiality",
      intro: "Useful confidentiality does not end with a minimum threshold. Repeated filters, cross-tabs and group comparisons can make an apparently aggregated signal identifiable, so safeguards need to accompany the entire analysis.",
      controls: [
        { title: "Cohort protection", text: "Results can be conditioned on minimum sizes and rules that avoid exposing excessively small segments." },
        { title: "Inference controls", text: "Cross-tabs and filters are also evaluated for their ability to indirectly reveal information about individuals or very small groups." },
        { title: "Audience-based distribution", text: "Not every audience needs the same level of detail; content can be adjusted to each authorised scope." },
      ],
      evidence: "The assessment should state how confidentiality is protected and which rules govern filters, cohorts and distribution before results are published.",
    },
    {
      id: "ai",
      title: "Bounded, explainable AI",
      intro: "Proofline uses AI as a specialised capability for review, synthesis and interpretation support. Authoritative statistics, privacy rules and business decisions are not delegated to an opaque model.",
      controls: [
        { title: "Reproducible calculation", text: "Scores, distributions, comparisons and authoritative metrics remain in deterministic, reviewable engines." },
        { title: "Minimised data", text: "Before a model is used, personal information is reduced or redacted when the function does not need to know it." },
        { title: "Contextual output", text: "The experience distinguishes observation, association, hypothesis and recommendation to avoid presenting interpretation as calculated fact." },
      ],
      evidence: "Clients should be able to distinguish what was statistically calculated, what received AI assistance and which human review preceded sensitive output.",
    },
    {
      id: "audit",
      title: "Traceability and audit",
      intro: "An evidence platform needs to reconstruct relevant decisions. Changing a rule, accessing restricted information and distributing a report are distinct actions and should retain enough context to be reviewed later.",
      controls: [
        { title: "Contextual changes", text: "Relevant versions, configurations and approvals can generate events explaining who changed what and within which scope." },
        { title: "Justified sensitive access", text: "Privileged support is designed around temporary sessions, explicit reason, step-up and stronger audit in production." },
        { title: "Traceable distribution", text: "Report generation, review, approval and delivery can remain linked to the corresponding version and audience." },
      ],
      evidence: "Traceability should serve support, security, privacy and methodology rather than merely accumulate events without meaning.",
    },
    {
      id: "control",
      title: "Visible client control",
      intro: "Trust improves when an organization can see and govern the rules affecting its studies. Proofline aims to expose important context without turning every assessment into an impossible configuration exercise.",
      controls: [
        { title: "Scoped access", text: "Roles and permissions are designed around organization, assessment and data scope rather than universal access by title." },
        { title: "Rules before launch", text: "Purpose, recipients, retention and the assessment legal profile are prepared before participants are invited." },
        { title: "Visible operational state", text: "Analytics, reports, approvals and distribution should expose a clear state to the people managing the study." },
      ],
      evidence: "Clients should be able to explain who accesses what, under which rules and with which evidence without relying on a generic compliance claim.",
    },
  ];

  return <>
    <section className="page-hero">
      <div className="container">
        <PageIntro
          title={es ? "La confianza se diseña antes de recoger la primera respuesta." : "Trust is designed before the first response is collected."}
          text={es
            ? "Proofline integra privacidad, confidencialidad, seguridad, IA y trazabilidad en la propia operación del assessment. El objetivo es que una organización pueda entender qué ocurre con sus datos, gobernar las reglas relevantes y explicarlas con claridad a quienes participan."
            : "Proofline integrates privacy, confidentiality, security, AI and traceability into assessment operations themselves. The aim is for an organization to understand what happens to its data, govern relevant rules and explain them clearly to participants."}
          aside={<div className="page-intro-note"><strong>{es ? "Transparencia verificable" : "Verifiable transparency"}</strong><span>{es ? "Esta página describe principios de arquitectura y controles previstos. La validación jurídica y técnica definitiva forma parte del paso a producción." : "This page describes architecture principles and planned controls. Final legal and technical validation is part of the production-readiness process."}</span></div>}
        />
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container trust-nav-grid">
        {principles.map((item) => <a href={`#${item.id}`} className="trust-nav-card" key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.short}</p>
          <strong>{es ? "Explorar control" : "Explore control"} →</strong>
        </a>)}
      </div>
    </section>

    <section className="section">
      <div className="container architecture-panel">
        <div>
          <h2>{es ? "Separar para reducir exposición." : "Separate to reduce exposure."}</h2>
          <p>{es ? "La arquitectura conceptual evita que cada proceso tenga acceso a todo. La identidad puede permanecer en una capa distinta de la respuesta y del análisis, manteniendo la relación sólo cuando el caso de uso la necesita." : "The conceptual architecture avoids giving every process access to everything. Identity can remain in a different layer from response and analytics, with linkage preserved only when the use case requires it."}</p>
        </div>
        <div className="architecture-flow" aria-label={es ? "Flujo conceptual de datos" : "Conceptual data flow"}>
          <div><strong>{es ? "Identidad" : "Identity"}</strong><span>Identity Vault</span></div>
          <i>→</i>
          <div><strong>{es ? "ID pseudónimo" : "Pseudonymous ID"}</strong><span>{es ? "Enlace controlado" : "Controlled link"}</span></div>
          <i>→</i>
          <div><strong>{es ? "Respuestas" : "Responses"}</strong><span>Response Store</span></div>
          <i>→</i>
          <div><strong>{es ? "Análisis" : "Analytics"}</strong><span>{es ? "Sin identidad directa" : "No direct identity"}</span></div>
        </div>
      </div>
    </section>

    <section className="section trust-detail-section">
      <div className="container trust-detail-list">
        {details.map((item) => <article id={item.id} className="trust-detail" key={item.id}>
          <div className="trust-detail-main">
            <h2>{item.title}</h2>
            <p className="trust-detail-intro">{item.intro}</p>
            <div className="trust-control-grid">
              {item.controls.map((control) => <div className="trust-control" key={control.title}>
                <strong>{control.title}</strong>
                <p>{control.text}</p>
              </div>)}
            </div>
          </div>
          <aside className="trust-verification">
            <span>{es ? "Control verificable" : "Verifiable control"}</span>
            <strong>{es ? "Lo que el cliente debería poder revisar" : "What the client should be able to review"}</strong>
            <p>{item.evidence}</p>
          </aside>
        </article>)}
      </div>
    </section>

    <section className="section section-tinted">
      <div className="container production-readiness-grid">
        <div>
          <h2>{es ? "De una buena arquitectura a una operación demostrable." : "From sound architecture to demonstrable operations."}</h2>
          <p>{es
            ? "La salida a producción debe convertir estos principios en evidencias concretas: revisión jurídica, pruebas técnicas, controles operativos y documentación que pueda revisarse cuando sea necesario."
            : "Production readiness should turn these principles into concrete evidence: legal review, technical testing, operational controls and documentation that can be reviewed when needed."}</p>
        </div>
        <ul className="production-checklist">
          <li>{es ? "Revisión legal y DPO de documentos, roles y bases jurídicas." : "Legal and DPO review of documents, roles and legal bases."}</li>
          <li>{es ? "DPIA/EIPD cuando el tratamiento concreto lo exija." : "DPIA where the specific processing requires it."}</li>
          <li>{es ? "Pentest, gestión de vulnerabilidades y restauración verificada." : "Penetration testing, vulnerability management and verified restore."}</li>
          <li>{es ? "Revisión de subprocessors, transferencias y contratos." : "Review of subprocessors, transfers and contracts."}</li>
          <li>{es ? "Pruebas de privacidad: cohortes, inferencias, retención y borrado." : "Privacy tests: cohorts, inference, retention and deletion."}</li>
          <li>{es ? "Registro y clasificación de funciones de IA aplicables." : "Register and classification of applicable AI functions."}</li>
        </ul>
      </div>
    </section>

    <CtaBand
      locale={locale}
      title={es ? "La confianza mejora cuando las reglas se pueden enseñar." : "Trust improves when the rules can be shown."}
      text={es ? "Si quieres revisar cómo Proofline separaría identidad, respuesta, análisis y acceso en tu caso, lo vemos sobre un assessment concreto." : "If you want to review how Proofline would separate identity, response, analysis and access in your case, we can walk through a concrete assessment."}
      secondaryHref={`/${locale}/legal`}
      secondaryLabel={es ? "Ir al Centro legal" : "Go to Legal Center"}
    />
  </>;
}
