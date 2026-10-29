import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { LeadForm } from "../../../components/lead-form";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const expectations = es ? [
    ["Objetivo", "Qué pregunta debe responder el assessment y qué decisión quieres apoyar."],
    ["Punto de partida", "Si partes de un framework, un cuestionario propio o una metodología que debe conservar comparabilidad y propiedad intelectual."],
    ["Operación y salida", "Población, privacidad, roles y el nivel de evidencia que necesitan dirección y analistas."],
  ] : [
    ["Objective", "Which question the assessment must answer and which decision you want to support."],
    ["Starting point", "Whether you start from a framework, your own questionnaire or a methodology that must preserve comparability and intellectual property."],
    ["Operation and output", "Population, privacy, roles and the level of evidence leadership and analysts need."],
  ];
  return <section className="contact-page"><div className="container">
    <PageIntro
      title={es ? "Cuéntanos qué necesitas resolver." : "Tell us what you need to solve."}
      text={es ? "La demo se prepara alrededor de tu caso, no como un recorrido genérico por menús. Con contexto suficiente podemos enseñarte un flujo mucho más cercano a una operación real." : "The demo is prepared around your case rather than as a generic menu tour. With enough context we can show a flow much closer to a real operation."}
    />
    <div className="contact-grid"><LeadForm locale={locale}/><aside className="contact-expectations"><h2>{es ? "Qué revisaremos" : "What we will review"}</h2>{expectations.map(([title,text])=><div key={title}><strong>{title}</strong><p>{text}</p></div>)}</aside></div>
  </div></section>;
}
