"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@proofline/i18n";

type Prefs = { analytics: boolean; marketing: boolean };
const storageKey = "proofline-public-cookie-preferences";

export function SiteCookiePreferences({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ analytics: false, marketing: false });

  useEffect(() => {
    setOpen(!localStorage.getItem(storageKey));
  }, []);

  function save(next: Prefs) {
    localStorage.setItem(storageKey, JSON.stringify({ necessary: true, ...next, savedAt: new Date().toISOString() }));
    setPrefs(next);
    setOpen(false);
  }

  if (!open) return null;

  return <div className="site-cookie" role="dialog" aria-modal="true" aria-label={es ? "Preferencias de privacidad" : "Privacy preferences"}>
    {!configure ? <>
      <div>
        <strong>{es ? "Preferencias de privacidad" : "Privacy preferences"}</strong>
        <p>{es
          ? "Proofline separa las funciones necesarias de cualquier analítica o marketing no esencial. En esta demo local no cargamos analítica ni publicidad; el control queda preparado para una configuración de producción."
          : "Proofline separates necessary functionality from any non-essential analytics or marketing. This local demo loads no analytics or advertising; the control is prepared for production configuration."}</p>
      </div>
      <div className="site-cookie-actions">
        <button className="btn btn-small" type="button" onClick={() => save({ analytics: false, marketing: false })}>{es ? "Rechazar no esenciales" : "Reject non-essential"}</button>
        <button className="btn btn-small" type="button" onClick={() => setConfigure(true)}>{es ? "Configurar" : "Configure"}</button>
        <button className="btn btn-small btn-primary" type="button" onClick={() => save({ analytics: true, marketing: true })}>{es ? "Aceptar todo" : "Accept all"}</button>
      </div>
    </> : <>
      <div>
        <strong>{es ? "Configura por categoría" : "Configure by category"}</strong>
        <p>{es ? "Las funciones estrictamente necesarias permanecen activas porque permiten operar la web y recordar preferencias técnicas." : "Strictly necessary functions remain active because they operate the site and remember technical preferences."}</p>
      </div>
      <div className="site-cookie-options">
        <label><span><strong>{es ? "Necesarias" : "Necessary"}</strong><small>{es ? "Siempre activas" : "Always on"}</small></span><input type="checkbox" checked disabled /></label>
        <label><span><strong>{es ? "Analítica" : "Analytics"}</strong><small>{es ? "Medición no esencial" : "Non-essential measurement"}</small></span><input type="checkbox" checked={prefs.analytics} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, analytics: event.target.checked })} /></label>
        <label><span><strong>Marketing</strong><small>{es ? "Personalización o campañas" : "Personalisation or campaigns"}</small></span><input type="checkbox" checked={prefs.marketing} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, marketing: event.target.checked })} /></label>
      </div>
      <div className="site-cookie-actions">
        <button className="btn btn-small" type="button" onClick={() => setConfigure(false)}>{es ? "Volver" : "Back"}</button>
        <button className="btn btn-small btn-primary" type="button" onClick={() => save(prefs)}>{es ? "Guardar preferencias" : "Save preferences"}</button>
      </div>
    </>}
    <a className="site-cookie-legal" href={`/${locale}/legal#cookies`}>{es ? "Más información en el Centro legal" : "More information in the Legal Center"} →</a>
  </div>;
}
