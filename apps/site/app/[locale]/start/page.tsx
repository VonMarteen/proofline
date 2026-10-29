import { normalizeLocale } from "@proofline/i18n";
import { PageIntro } from "../../../components/page-intro";
import { StartForm } from "../../../components/start-form";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const steps = es ? [
    ["Solicitud", "Registramos organización, contacto y uso previsto en un expediente comercial trazable."],
    ["Evaluación", "Si encaja, se prepara un workspace de evaluación con alcance y duración definidos."],
    ["Condiciones", "Plan, contratación y método de pago se confirman según la modalidad realmente disponible; las integraciones externas no se presentan como activas hasta estar conectadas."],
    ["Activación", "Con las condiciones listas, se provisiona la organización y el Owner completa activación y OTP."],
  ] : [
    ["Request", "We register the organization, contact and intended use in a traceable commercial record."],
    ["Evaluation", "When appropriate, an evaluation workspace is prepared with a defined scope and duration."],
    ["Terms", "Plan, contracting and payment method are confirmed according to the mode that is actually available; external integrations are not presented as active until connected."],
    ["Activation", "Once terms are ready, the organization is provisioned and the Owner completes activation and OTP."],
  ];
  return <section className="start-page"><div className="container">
    <PageIntro
      title={es ? "Prepara tu espacio de evaluación." : "Prepare your evaluation workspace."}
      text={es ? "Comparte los datos mínimos de tu organización y el uso previsto. El alta entra en un flujo trazable de evaluación, contratación y provisión; no simulamos activaciones ni cobros." : "Share the minimum organization details and intended use. The request enters a traceable evaluation, contracting and provisioning flow; no activation or payment is simulated."}
    />
    <div className="start-grid"><StartForm locale={locale}/><aside className="start-explainer"><h2>{es ? "Después de enviar" : "After submission"}</h2>{steps.map(([title,text])=><div key={title}><strong>{title}</strong><p>{text}</p></div>)}</aside></div>
  </div></section>;
}
