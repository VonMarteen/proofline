"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";

type Branding = {
  enabled: boolean;
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  onPrimaryColor: string;
  logoAltText?: string | null;
  logo?: { dataUrl: string; fileName: string; mimeType: string } | null;
};

function hex(v: string) { return /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : null; }
function ch(n: number) { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }
function lum(c: string) { const h = hex(c); if (!h) return null; return .2126 * ch(parseInt(h.slice(1, 3), 16)) + .7152 * ch(parseInt(h.slice(3, 5), 16)) + .0722 * ch(parseInt(h.slice(5, 7), 16)); }
function ratio(a: string, b: string) { const x = lum(a), y = lum(b); if (x === null || y === null) return 0; const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + .05) / (lo + .05); }
function readableOn(bg: string) { return ratio("#FFFFFF", bg) >= ratio("#000000", bg) ? "#FFFFFF" : "#000000"; }
function readFile(file: File) { return new Promise<{ base64: string; dataUrl: string }>((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error("read")); r.onload = () => { const dataUrl = String(r.result ?? ""); resolve({ dataUrl, base64: dataUrl.split(",")[1] ?? "" }); }; r.readAsDataURL(file); }); }

export function BrandingEditor({ locale, initial, organizationName }: { locale: "es" | "en"; initial: Branding; organizationName: string }) {
  const es = locale === "es", router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [primaryColor, setPrimary] = useState(initial.primaryColor);
  const [backgroundColor, setBackground] = useState(initial.backgroundColor);
  const [surfaceColor, setSurface] = useState(initial.surfaceColor);
  const [textColor, setText] = useState(initial.textColor);
  const [logoAltText, setAlt] = useState(initial.logoAltText ?? organizationName);
  const [logo, setLogo] = useState(initial.logo?.dataUrl ?? "");
  const [logoUpload, setLogoUpload] = useState<{ fileName: string; mimeType: string; base64: string } | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");

  const checks = useMemo(() => [
    { label: es ? "Texto sobre selección principal" : "Text on primary selection", value: ratio(textColor, backgroundColor), min: 4.5 },
    { label: es ? "Texto sobre selección secundaria" : "Text on secondary selection", value: ratio(textColor, surfaceColor), min: 4.5 },
    { label: es ? "Texto automático sobre acento" : "Automatic text on accent", value: ratio(readableOn(primaryColor), primaryColor), min: 4.5 },
  ], [es, textColor, backgroundColor, surfaceColor, primaryColor]);

  const valid = [primaryColor, backgroundColor, surfaceColor, textColor].every(v => Boolean(hex(v))) && checks.every(x => x.value >= x.min);
  const previewOnPrimary = readableOn(primaryColor);

  async function pick(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError(es ? "El logo debe ser PNG, JPG o WebP." : "Logo must be PNG, JPG or WebP."); return; }
    if (file.size > 1024 * 1024) { setError(es ? "El logo no puede superar 1 MB." : "Logo cannot exceed 1 MB."); return; }
    const r = await readFile(file);
    setLogo(r.dataUrl);
    setLogoUpload({ fileName: file.name, mimeType: file.type, base64: r.base64 });
    setRemoveLogo(false);
  }

  async function save() {
    if (!valid) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/proxy/v1/workspace/branding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, primaryColor, backgroundColor, surfaceColor, textColor, logoAltText, logo: logoUpload, removeLogo }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(b?.message) ? b.message.join(" · ") : b?.message ?? `API ${r.status}`);
      setMessage(es ? "Identidad guardada. El logo identifica a la organización y los colores se aplican sólo a los controles de respuesta del assessment." : "Identity saved. The logo identifies the organization and colors apply only to assessment response controls.");
      setLogoUpload(null); setRemoveLogo(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const style = {
    "--preview-brand": primaryColor,
    "--preview-selection": backgroundColor,
    "--preview-selection-soft": surfaceColor,
    "--preview-selection-text": textColor,
    "--preview-on-brand": previewOnPrimary,
  } as CSSProperties;

  return <div className="branding-layout">
    <section className="branding-editor-panel">
      <div className="branding-section-head">
        <div>
          <h2>{es ? "Identidad corporativa" : "Corporate identity"}</h2>
          <p>{es
            ? "PROOFLINE conserva siempre su interfaz. El logo identifica a la organización; los colores sólo aparecen en selecciones, escalas, checks, progreso y acciones del assessment cuando una persona lo está respondiendo."
            : "PROOFLINE always keeps its own interface. The logo identifies the organization; colors only appear in selections, scales, checks, progress and assessment actions while a participant is answering."}</p>
        </div>
        <label className="branding-toggle"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /><span>{es ? "Aplicar colores a respuestas" : "Apply colors to responses"}</span></label>
      </div>

      <div className="branding-logo-row">
        <div className="branding-logo-preview">{logo ? <img src={logo} alt={logoAltText || organizationName} /> : <span>{organizationName.slice(0, 2).toUpperCase()}</span>}</div>
        <div>
          <strong>{es ? "Logo de la organización" : "Organization logo"}</strong>
          <p>{es ? "PNG, JPG o WebP · máximo 1 MB. Se usa como identificador en el Workspace y en la cabecera del assessment, sin recolorear la interfaz de PROOFLINE." : "PNG, JPG or WebP · maximum 1 MB. It identifies the organization in Workspace and the assessment header without recoloring the PROOFLINE interface."}</p>
          <div className="workspace-card-actions">
            <label className="btn branding-file-button">{es ? "Subir logo" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => pick(e.target.files?.[0])} /></label>
            {logo ? <button type="button" className="btn" onClick={() => { setLogo(""); setLogoUpload(null); setRemoveLogo(true); }}>{es ? "Quitar logo" : "Remove logo"}</button> : null}
          </div>
        </div>
      </div>

      <label className="label">{es ? "Texto alternativo del logo" : "Logo alt text"}<input className="input" value={logoAltText} maxLength={180} onChange={e => setAlt(e.target.value)} /></label>

      <h3 className="ws-r3-color-title">{es ? "Colores corporativos" : "Corporate colors"}</h3><div className="branding-colors">
        <ColorField label={es ? "Acento corporativo" : "Corporate accent"} hint={es ? "Radio, check, foco, progreso y botón de envío" : "Radio, check, focus, progress and submit button"} value={primaryColor} set={setPrimary} />
        <ColorField label={es ? "Selección principal" : "Primary selection"} hint={es ? "Fondo de una opción seleccionada" : "Background of a selected option"} value={backgroundColor} set={setBackground} />
        <ColorField label={es ? "Selección secundaria" : "Secondary selection"} hint={es ? "Estado alternativo o selección suave" : "Alternate or softer selected state"} value={surfaceColor} set={setSurface} />
        <ColorField label={es ? "Texto sobre selección" : "Text on selection"} hint={es ? "Sólo dentro de estados seleccionados" : "Only inside selected states"} value={textColor} set={setText} />
      </div>

      <div className="branding-boundary-note">
        <strong>{es ? "Límite de aplicación" : "Application boundary"}</strong>
        <span>{es ? "Estos colores no cambian navegación, fondos generales, cabeceras de PROOFLINE, bienvenida, aviso legal ni Workspace." : "These colors do not change PROOFLINE navigation, general backgrounds, headers, welcome content, legal notice or Workspace."}</span>
      </div>

      <div className="branding-accessibility">
        <div><h3>{es ? "Legibilidad obligatoria" : "Required readability"}</h3><p>{es ? "Las combinaciones que impidan leer una opción seleccionada se bloquean antes de guardar." : "Combinations that make a selected option hard to read are blocked before saving."}</p></div>
        {checks.map(x => <div className={x.value >= x.min ? "ok" : "bad"} key={x.label}><span>{x.label}</span><strong>{x.value.toFixed(2)}:1</strong><small>{es ? "mín." : "min."} {x.min}:1</small></div>)}
      </div>

      {!valid ? <div className="workspace-alert danger">{es ? "Hay una combinación que no cumple el contraste mínimo. Corrígela antes de guardar." : "A combination does not meet minimum contrast. Fix it before saving."}</div> : null}
      {error ? <div className="workspace-alert danger">{error}</div> : null}
      {message ? <div className="workspace-alert">{message}</div> : null}
      <div className="branding-save"><button type="button" className="btn btn-accent" disabled={!valid || busy} onClick={save}>{busy ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar identidad" : "Save identity")}</button><span>{es ? "Sólo el Owner / Super Admin puede modificar esta configuración." : "Only the Owner / Super Admin can change this configuration."}</span></div>
    </section>

    <aside className="branding-preview-wrap">
      <div className="branding-preview-label"><strong>{es ? "Vista previa" : "Preview"}</strong><span>{es ? "PROOFLINE + controles corporativos" : "PROOFLINE + corporate controls"}</span></div>
      <div className={enabled ? "branding-preview branding-preview-controls" : "branding-preview"} style={style}>
        <header><strong>PROOFLINE</strong><span className="branding-preview-divider" />{logo ? <img src={logo} alt="" /> : null}<span>{organizationName}</span></header>
        <main>
          <h2>{es ? "Diagnóstico de coordinación" : "Coordination diagnostic"}</h2>
          <p>{es ? "La introducción y el resto de la pantalla mantienen el diseño de PROOFLINE." : "The introduction and the rest of the screen keep the PROOFLINE design."}</p>
          <article><b>1</b><div><strong>{es ? "La información que necesito llega a tiempo para realizar mi trabajo." : "The information I need arrives in time to do my work."}</strong><div className="branding-preview-scale"><i>1</i><i>2</i><i className="is-selected">3</i><i>4</i><i>5</i></div></div></article>
          <button>{es ? "Enviar respuesta" : "Submit response"}</button>
        </main>
      </div>
    </aside>
  </div>;
}

function ColorField({ label, hint, value, set }: { label: string; hint: string; value: string; set: (v: string) => void }) {
  return <label className="branding-color-field"><span>{label}</span><small>{hint}</small><div className="ws-r3-color-control"><input type="color" aria-label={`${label} – ${hint}`} value={hex(value) ?? "#000000"} onChange={e => set(e.target.value.toUpperCase())} /><input className="input" aria-label={`${label} hexadecimal`} value={value} maxLength={7} onChange={e => set(e.target.value.toUpperCase())} /></div></label>;
}
