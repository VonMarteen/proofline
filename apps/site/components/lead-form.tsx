"use client";

import { useState } from "react";

export function LeadForm({ locale }: { locale: "es" | "en" }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const es = locale === "es";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const f = new FormData(e.currentTarget);
    const body = {
      mode: "DEMO",
      name: f.get("name"),
      email: f.get("email"),
      company: f.get("company"),
      message: f.get("message"),
      marketingConsent: f.get("marketing") === "on",
      locale,
    };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100"}/v1/public/commercial-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      setState("ok");
      e.currentTarget.reset();
    } catch {
      setState("error");
    }
  }

  return <form className="contact-form" onSubmit={submit}>
    <div className="form-row">
      <label className="label">{es ? "Nombre" : "Name"}<input className="input" name="name" required minLength={2} autoComplete="name" /></label>
      <label className="label">{es ? "Email profesional" : "Work email"}<input className="input" type="email" name="email" required autoComplete="email" /></label>
    </div>
    <label className="label">{es ? "Organización" : "Organization"}<input className="input" name="company" required autoComplete="organization" /></label>
    <label className="label">{es ? "¿Qué necesitas analizar o qué decisión quieres apoyar?" : "What do you need to analyse or which decision do you want to support?"}<textarea className="textarea" name="message" maxLength={2000} placeholder={es ? "Por ejemplo: queremos entender si existen diferencias relevantes de liderazgo entre áreas y repetir el estudio cada seis meses…" : "For example: we need to understand whether leadership perceptions differ meaningfully across teams and repeat the study every six months…"} /></label>

    <div className="contact-legal-controls">
      <label className="contact-consent required-consent">
        <input type="checkbox" name="privacyAcknowledgement" required />
        <span>{es ? <>He leído la <a href={`/${locale}/legal#privacidad`}>información sobre privacidad</a> y entiendo que mis datos se tratarán para gestionar y responder esta solicitud.</> : <>I have read the <a href={`/${locale}/legal#privacy`}>privacy information</a> and understand that my data will be processed to manage and respond to this request.</>}</span>
      </label>
      <label className="contact-consent">
        <input type="checkbox" name="marketing" />
        <span>{es ? "Quiero recibir novedades comerciales de Proofline. Es opcional y está separado de esta solicitud." : "I want to receive commercial updates from Proofline. This is optional and separate from this request."}</span>
      </label>
    </div>

    <p className="contact-privacy-note">{es ? "Usaremos los datos de esta solicitud únicamente para gestionarla y responderte. Las comunicaciones comerciales son opcionales y se registran de forma independiente." : "We will use the data in this request only to manage it and respond to you. Marketing communications are optional and recorded separately."}</p>
    <div className="contact-submit-row">
      <button className="btn btn-accent" disabled={state === "sending"}>{state === "sending" ? (es ? "Enviando…" : "Sending…") : (es ? "Solicitar conversación" : "Request conversation")}</button>
    </div>
    {state === "ok" ? <div className="form-status success">{es ? "Solicitud recibida. Gracias; te responderemos usando los datos que has indicado." : "Request received. Thank you; we will reply using the details you provided."}</div> : null}
    {state === "error" ? <div className="form-status error">{es ? "No hemos podido registrar la solicitud. Inténtalo de nuevo en unos instantes." : "We could not register the request. Please try again in a moment."}</div> : null}
  </form>;
}
