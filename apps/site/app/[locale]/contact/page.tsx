import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { LeadForm } from "../../../components/lead-form";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";

  const expectations = es ? [
    { title: "El objetivo", text: "Partimos de la pregunta que el assessment necesita poder responder y de la decisión que esperas apoyar. Así la demo se construye alrededor de tu problema y no alrededor de una lista de funciones." },
    { title: "El punto de partida", text: "Revisamos si ya tienes cuestionario, una metodología propia, un framework existente o si conviene partir de la Library. También vemos qué debe conservarse para mantener comparabilidad y propiedad intelectual." },
    { title: "La operación", text: "Definimos quién gestionará el estudio, qué población participa, qué roles necesitan acceso, qué grado de confidencialidad aplica y cómo debería funcionar el seguimiento de respuestas." },
    { title: "La salida esperada", text: "Acordamos qué necesita ver dirección, qué detalle necesitan los analistas y qué evidencia debe quedar detrás de cada conclusión para que el resultado sea útil y revisable." },
  ] : [
    { title: "The objective", text: "We start from the question the assessment needs to answer and the decision you expect to support. The demo is therefore built around your problem rather than a feature list." },
    { title: "The starting point", text: "We review whether you already have a questionnaire, proprietary methodology, an existing framework or whether the Library is the right starting point. We also look at what must be preserved for comparability and intellectual property." },
    { title: "The operation", text: "We define who will manage the study, which population participates, which roles need access, what level of confidentiality applies and how response follow-up should work." },
    { title: "Expected output", text: "We agree what leadership needs to see, what detail analysts need and which evidence should sit behind every conclusion so the result remains useful and reviewable." },
  ];

  return <section className="contact-page">
    <div className="container">
      <PageIntro
        title={es ? "Cuéntanos qué necesitas poder responder." : "Tell us what you need to answer."}
        text={es
          ? "Una buena demo de Proofline no empieza recorriendo menús. Empieza por tu objetivo, el tipo de assessment que utilizas y la decisión que necesitas apoyar. Con ese contexto podemos enseñarte una experiencia mucho más cercana a tu caso real."
          : "A useful Proofline demo does not start with a menu tour. It starts with your objective, the type of assessment you use and the decision you need to support. With that context we can show an experience much closer to your real use case."}
      />
      <div className="contact-grid">
        <LeadForm locale={locale} />
        <aside className="contact-expectations">
          <h2>{es ? "Qué revisaremos contigo" : "What we will review with you"}</h2>
          {expectations.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.text}</p></div>)}
        </aside>
      </div>
    </div>
  </section>;
}
