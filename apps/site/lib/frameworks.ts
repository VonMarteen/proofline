import type { Locale } from "@proofline/i18n";

type Localized = { es: string; en: string };

export type PublicFramework = {
  slug: string;
  title: Localized;
  origin: "ORIGINAL" | "TEMPLATE" | "PARTNER_READY";
  objective: Localized;
  summary: Localized;
  audience: Localized;
  duration: Localized;
  dimensions: Localized[];
  useCases: Localized[];
  governance: Localized[];
  version: string;
};

export const publicFrameworks: PublicFramework[] = [
  {
    slug: "leadership-clarity",
    title: { es: "Claridad de liderazgo", en: "Leadership Clarity" },
    origin: "ORIGINAL",
    objective: {
      es: "Entender cómo se perciben la dirección, la comunicación, la confianza y el reconocimiento del liderazgo entre áreas o colectivos.",
      en: "Understand how leadership direction, communication, trust and recognition are perceived across teams or cohorts.",
    },
    summary: {
      es: "Un marco para identificar dónde existe una señal de liderazgo consistente y dónde aparecen brechas que merecen investigación o acción.",
      en: "A framework to identify where leadership signals are consistent and where gaps deserve further investigation or action.",
    },
    audience: { es: "Dirección, People, transformación", en: "Leadership, People, transformation" },
    duration: { es: "8–12 min", en: "8–12 min" },
    dimensions: [
      { es: "Dirección y prioridades", en: "Direction and priorities" },
      { es: "Comunicación", en: "Communication" },
      { es: "Confianza", en: "Trust" },
      { es: "Reconocimiento", en: "Recognition" },
    ],
    useCases: [
      { es: "Comparar percepciones entre departamentos sin convertir la comparación en una clasificación simplista.", en: "Compare perceptions across departments without turning the comparison into a simplistic ranking." },
      { es: "Detectar dimensiones con brechas sostenidas y preparar preguntas de seguimiento.", en: "Detect sustained gaps and prepare follow-up questions." },
      { es: "Repetir el assessment por oleadas y analizar evolución.", en: "Repeat the assessment in waves and analyse change over time." },
    ],
    governance: [
      { es: "Versionado del cuestionario y del scoring.", en: "Questionnaire and scoring versioning." },
      { es: "Umbrales de cohortes para proteger grupos pequeños.", en: "Cohort thresholds to protect small groups." },
      { es: "Separación entre identidad y respuesta cuando el modo de confidencialidad lo exige.", en: "Separation of identity and response when confidentiality mode requires it." },
    ],
    version: "1.0",
  },
  {
    slug: "organizational-climate",
    title: { es: "Clima organizacional", en: "Organizational Climate" },
    origin: "TEMPLATE",
    objective: {
      es: "Obtener una lectura estructurada del entorno de trabajo y localizar diferencias relevantes entre colectivos, dimensiones y momentos.",
      en: "Build a structured view of the work environment and locate meaningful differences across cohorts, dimensions and time.",
    },
    summary: {
      es: "Plantilla configurable para estudios de clima que prioriza comparabilidad, claridad de dimensiones y trazabilidad de cambios.",
      en: "A configurable climate-study template that prioritises comparability, dimension clarity and traceable changes.",
    },
    audience: { es: "People, dirección, consultoría", en: "People, leadership, consulting" },
    duration: { es: "10–15 min", en: "10–15 min" },
    dimensions: [
      { es: "Entorno de trabajo", en: "Work environment" },
      { es: "Colaboración", en: "Collaboration" },
      { es: "Desarrollo", en: "Development" },
      { es: "Confianza y comunicación", en: "Trust and communication" },
    ],
    useCases: [
      { es: "Estudios anuales o semestrales de clima.", en: "Annual or semi-annual climate studies." },
      { es: "Comparación de tendencias por colectivos elegibles.", en: "Trend comparison across eligible cohorts." },
      { es: "Preparación de un brief ejecutivo con evidencia detrás de cada hallazgo.", en: "Preparation of an executive brief with evidence behind every finding." },
    ],
    governance: [
      { es: "Dimensiones y escalas editables con control de versión.", en: "Editable dimensions and scales with version control." },
      { es: "Registro de cambios que puedan romper comparabilidad longitudinal.", en: "Record of changes that may break longitudinal comparability." },
      { es: "Reglas de privacidad por segmentación.", en: "Privacy rules by segmentation." },
    ],
    version: "1.0",
  },
  {
    slug: "change-readiness",
    title: { es: "Preparación para el cambio", en: "Change Readiness" },
    origin: "TEMPLATE",
    objective: {
      es: "Evaluar si una organización dispone de comprensión, capacidad, confianza y condiciones suficientes para afrontar una transformación concreta.",
      en: "Assess whether an organization has sufficient understanding, capability, confidence and conditions to face a specific transformation.",
    },
    summary: {
      es: "Pensado para programas de transformación donde interesa saber qué colectivos están preparados, qué barreras aparecen y qué necesita atención antes del despliegue.",
      en: "Designed for transformation programmes where teams need to know who is ready, which barriers emerge and what needs attention before rollout.",
    },
    audience: { es: "Transformación, PMO, dirección", en: "Transformation, PMO, leadership" },
    duration: { es: "7–10 min", en: "7–10 min" },
    dimensions: [
      { es: "Comprensión", en: "Understanding" },
      { es: "Capacidad", en: "Capability" },
      { es: "Confianza", en: "Confidence" },
      { es: "Barreras", en: "Barriers" },
    ],
    useCases: [
      { es: "Preparación previa a un cambio operativo, tecnológico o cultural.", en: "Readiness before an operational, technological or cultural change." },
      { es: "Seguimiento de evolución durante una transformación.", en: "Track change over the course of a transformation." },
      { es: "Priorización de intervenciones por dimensión, no por intuición.", en: "Prioritise interventions by dimension rather than intuition." },
    ],
    governance: [
      { es: "Objetivo de cambio declarado en cada versión.", en: "Declared change objective in every version." },
      { es: "Comparaciones condicionadas por cohortes válidas.", en: "Comparisons conditioned by valid cohorts." },
      { es: "Recomendaciones separadas de observaciones e hipótesis.", en: "Recommendations separated from observations and hypotheses." },
    ],
    version: "1.0",
  },
  {
    slug: "communication-health",
    title: { es: "Salud de la comunicación", en: "Communication Health" },
    origin: "ORIGINAL",
    objective: {
      es: "Identificar dónde la información llega con claridad, oportunidad y credibilidad, y dónde se pierde o distorsiona entre niveles y áreas.",
      en: "Identify where information arrives with clarity, timing and credibility, and where it is lost or distorted across levels and teams.",
    },
    summary: {
      es: "Un assessment enfocado en canales, claridad, confianza y capacidad de actuar con la información recibida.",
      en: "An assessment focused on channels, clarity, trust and the ability to act on received information.",
    },
    audience: { es: "Comunicación interna, People, dirección", en: "Internal comms, People, leadership" },
    duration: { es: "6–9 min", en: "6–9 min" },
    dimensions: [
      { es: "Claridad", en: "Clarity" },
      { es: "Oportunidad", en: "Timeliness" },
      { es: "Credibilidad", en: "Credibility" },
      { es: "Accionabilidad", en: "Actionability" },
    ],
    useCases: [
      { es: "Diagnóstico de comunicación durante cambios relevantes.", en: "Communication diagnosis during major changes." },
      { es: "Contraste entre canales formales y percepción real.", en: "Contrast formal channels with actual perception." },
      { es: "Seguimiento después de intervenciones de comunicación.", en: "Follow-up after communication interventions." },
    ],
    governance: [
      { es: "Segmentación limitada a colectivos con tamaño suficiente.", en: "Segmentation limited to cohorts with sufficient size." },
      { es: "Comentarios abiertos sujetos a minimización y redacción de PII.", en: "Open comments subject to minimisation and PII redaction." },
      { es: "Trazabilidad de la versión enviada a cada oleada.", en: "Traceability of the version sent to each wave." },
    ],
    version: "1.0",
  },
  {
    slug: "team-effectiveness",
    title: { es: "Efectividad de equipos", en: "Team Effectiveness" },
    origin: "TEMPLATE",
    objective: {
      es: "Comprender qué condiciones ayudan o frenan a un equipo para coordinarse, decidir, ejecutar y aprender de forma consistente.",
      en: "Understand which conditions help or hinder a team in coordinating, deciding, executing and learning consistently.",
    },
    summary: {
      es: "Una base para revisar foco, coordinación, autonomía, confianza y aprendizaje sin convertir el assessment en evaluación individual de desempeño.",
      en: "A basis for reviewing focus, coordination, autonomy, trust and learning without turning the assessment into individual performance evaluation.",
    },
    audience: { es: "Equipos, managers, consultoría", en: "Teams, managers, consulting" },
    duration: { es: "8–11 min", en: "8–11 min" },
    dimensions: [
      { es: "Foco", en: "Focus" },
      { es: "Coordinación", en: "Coordination" },
      { es: "Autonomía", en: "Autonomy" },
      { es: "Aprendizaje", en: "Learning" },
    ],
    useCases: [
      { es: "Retrospectivas estructuradas de equipo.", en: "Structured team retrospectives." },
      { es: "Comparación antes y después de un cambio de modelo operativo.", en: "Compare before and after an operating model change." },
      { es: "Identificación de bloqueos sistémicos frente a problemas individuales.", en: "Identify systemic blockers versus individual issues." },
    ],
    governance: [
      { es: "No diseñado para ranking individual.", en: "Not designed for individual ranking." },
      { es: "Controles de disclosure por tamaño de equipo.", en: "Disclosure controls by team size." },
      { es: "Evidencia vinculada a cada insight mostrado.", en: "Evidence linked to every displayed insight." },
    ],
    version: "1.0",
  },
  {
    slug: "organizational-swot",
    title: { es: "FODA organizacional", en: "Organizational SWOT" },
    origin: "TEMPLATE",
    objective: {
      es: "Estructurar percepciones internas sobre fortalezas, debilidades, oportunidades y amenazas y contrastarlas entre grupos relevantes.",
      en: "Structure internal perceptions of strengths, weaknesses, opportunities and threats and compare them across relevant groups.",
    },
    summary: {
      es: "Una adaptación del FODA para recoger señal distribuida, ordenar temas recurrentes y separar evidencia, asociación e hipótesis.",
      en: "An adaptation of SWOT to collect distributed signals, organise recurring themes and separate evidence, association and hypothesis.",
    },
    audience: { es: "Estrategia, dirección, consultoría", en: "Strategy, leadership, consulting" },
    duration: { es: "10–14 min", en: "10–14 min" },
    dimensions: [
      { es: "Fortalezas", en: "Strengths" },
      { es: "Debilidades", en: "Weaknesses" },
      { es: "Oportunidades", en: "Opportunities" },
      { es: "Amenazas", en: "Threats" },
    ],
    useCases: [
      { es: "Procesos de planificación estratégica participativa.", en: "Participatory strategic planning." },
      { es: "Contraste entre dirección y otros colectivos.", en: "Contrast leadership with other cohorts." },
      { es: "Síntesis de comentarios cualitativos por temas.", en: "Synthesis of qualitative comments by theme." },
    ],
    governance: [
      { es: "Temas generados con revisión humana antes de publicación.", en: "Generated themes require human review before publication." },
      { es: "Las asociaciones no se presentan como causalidad.", en: "Associations are not presented as causality." },
      { es: "Versionado de categorías y reglas de codificación.", en: "Versioning of categories and coding rules." },
    ],
    version: "1.0",
  },
  {
    slug: "leadership-360",
    title: { es: "360° de liderazgo", en: "360° Leadership" },
    origin: "PARTNER_READY",
    objective: {
      es: "Recoger perspectivas estructuradas desde distintos grupos de relación para construir una lectura de desarrollo, no una sentencia automática sobre una persona.",
      en: "Collect structured perspectives from different relationship groups to build a development view rather than an automated judgement about an individual.",
    },
    summary: {
      es: "Base preparada para metodologías 360° que requieren segmentación por relación, confidencialidad y reglas estrictas de disclosure.",
      en: "A base for 360° methodologies requiring relationship segmentation, confidentiality and strict disclosure rules.",
    },
    audience: { es: "Desarrollo de liderazgo, consultoría", en: "Leadership development, consulting" },
    duration: { es: "12–18 min", en: "12–18 min" },
    dimensions: [
      { es: "Dirección", en: "Direction" },
      { es: "Colaboración", en: "Collaboration" },
      { es: "Desarrollo", en: "Development" },
      { es: "Influencia", en: "Influence" },
    ],
    useCases: [
      { es: "Programas de desarrollo con facilitación profesional.", en: "Development programmes with professional facilitation." },
      { es: "Contraste de auto-percepción frente a grupos elegibles.", en: "Contrast self-perception with eligible groups." },
      { es: "Seguimiento de objetivos de desarrollo en nuevas oleadas.", en: "Track development objectives in later waves." },
    ],
    governance: [
      { es: "Umbrales reforzados para grupos de evaluadores.", en: "Stronger thresholds for rater groups." },
      { es: "No revelar respuestas individuales bajo modo confidencial.", en: "Do not reveal individual responses in confidential mode." },
      { es: "Acceso al informe definido por audiencia y propósito.", en: "Report access defined by audience and purpose." },
    ],
    version: "1.0",
  },
  {
    slug: "customer-perception",
    title: { es: "Percepción de clientes", en: "Customer Perception" },
    origin: "TEMPLATE",
    objective: {
      es: "Comprender cómo clientes o usuarios perciben valor, experiencia, confianza y fricciones, y localizar diferencias que requieran investigación adicional.",
      en: "Understand how customers or users perceive value, experience, trust and friction, and locate differences requiring further investigation.",
    },
    summary: {
      es: "Plantilla para estudios de percepción con escalas, preguntas abiertas y segmentación controlada por perfiles relevantes.",
      en: "A template for perception studies combining scales, open questions and controlled segmentation by relevant profiles.",
    },
    audience: { es: "CX, producto, investigación", en: "CX, product, research" },
    duration: { es: "5–9 min", en: "5–9 min" },
    dimensions: [
      { es: "Valor percibido", en: "Perceived value" },
      { es: "Experiencia", en: "Experience" },
      { es: "Confianza", en: "Trust" },
      { es: "Fricciones", en: "Friction" },
    ],
    useCases: [
      { es: "Estudios de relación o experiencia.", en: "Relationship or experience studies." },
      { es: "Contraste entre segmentos relevantes de clientes.", en: "Compare relevant customer segments." },
      { es: "Identificación de temas cualitativos recurrentes.", en: "Identify recurring qualitative themes." },
    ],
    governance: [
      { es: "Propósito de cada dato declarado antes de recogerlo.", en: "Purpose for each data point declared before collection." },
      { es: "Campos de perfil configurables con minimización.", en: "Configurable profile fields with minimisation." },
      { es: "Evidencia de versión y aviso presentado.", en: "Evidence of version and presented notice." },
    ],
    version: "1.0",
  },
];

export function localizedFramework(framework: PublicFramework, locale: Locale) {
  return {
    ...framework,
    title: framework.title[locale],
    objective: framework.objective[locale],
    summary: framework.summary[locale],
    audience: framework.audience[locale],
    duration: framework.duration[locale],
    dimensions: framework.dimensions.map((item) => item[locale]),
    useCases: framework.useCases.map((item) => item[locale]),
    governance: framework.governance.map((item) => item[locale]),
  };
}
