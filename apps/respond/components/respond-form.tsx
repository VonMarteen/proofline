"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brand, Icon } from "@proofline/ui";
import { ThemeToggle, LocaleSwitch } from "@proofline/ui/client";

function visible(q: any, answers: Record<string, any>) {
  const show = q.config?.logic?.showIf;
  if (!show?.questionId) return true;
  const actual = answers[show.questionId], expected = show.value;
  if (show.operator === "not_equals") return String(actual) !== String(expected);
  if (show.operator === "contains") return Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? "").includes(String(expected));
  if (show.operator === "gte") return Number(actual) >= Number(expected);
  if (show.operator === "lte") return Number(actual) <= Number(expected);
  return String(actual) === String(expected);
}
function empty(v: any) { return v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length); }
function brandingStyle(b: any) {
  if (!b?.enabled) return undefined;
  return { "--assessment-brand": b.primaryColor, "--assessment-selection": b.backgroundColor, "--assessment-selection-soft": b.surfaceColor, "--assessment-selection-text": b.textColor, "--assessment-brand-on": b.onPrimaryColor } as any;
}

function apiFailure(status: number, body: any, es: boolean) {
  const raw = Array.isArray(body?.message) ? body.message.join(" · ") : typeof body?.message === "string" ? body.message : `API ${status}`;
  if (status === 410) return { message: es ? "La invitación ha caducado y ya no permite guardar ni enviar respuestas." : "The invitation has expired and can no longer save or submit responses.", block: "expired" as const };
  if (status === 404) return { message: es ? "La invitación ya no está disponible." : "The invitation is no longer available.", block: "revoked" as const };
  if (status === 409 && raw.includes("no longer accepting")) return { message: es ? "El assessment se ha cerrado y ya no acepta respuestas." : "The assessment has closed and no longer accepts responses.", block: "closed" as const };
  if (status === 409 && raw.includes("Notice version mismatch")) return { message: es ? "La información del participante cambió. Recarga la página antes de continuar." : "Participant information changed. Reload the page before continuing." };
  return { message: raw };
}

function ParticipantBrand({ data }: { data: any }) {
  const b = data.branding;
  return <div className="participant-brand"><Brand/><span className="participant-brand-divider"/>{b?.logo?.dataUrl ? <img src={b.logo.dataUrl} alt={b.logoAltText || data.organization.name}/> : null}<span className="participant-brand-name">{data.organization.name}</span></div>;
}

export function RespondForm({ data, token, locale }: { data: any; token: string; locale: "es" | "en" }) {
  const es = locale === "es";
  const initialAnswers = (data.draft?.answers ?? {}) as Record<string, any>;
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [ack, setAck] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(data.status === "COMPLETED" ? "done" : "idle");
  const [message, setMessage] = useState<string | null>(data.status === "COMPLETED" ? (es ? "Tu respuesta ya fue enviada y está registrada." : "Your response has already been submitted and recorded.") : null);
  const [saveState, setSaveState] = useState<"idle" | "waiting" | "saving" | "saved" | "error">(data.draft && data.status !== "COMPLETED" ? "saved" : "idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<"closed" | "expired" | "revoked" | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(data.draft?.savedAt ?? null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const skipInitialSave = useRef(true);
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4201";

  const visibleQuestions = useMemo(() => data.questions.filter((q: any) => visible(q, answers)), [data.questions, answers]);
  const answerable = visibleQuestions.filter((q: any) => q.type !== "INFO");
  const completed = answerable.filter((q: any) => !empty(answers[q.id])).length;
  const progress = answerable.length ? Math.round(completed / answerable.length * 100) : 100;
  const branded = Boolean(data.branding?.enabled), brandStyle = brandingStyle(data.branding);
  const resumedCount = Object.values(initialAnswers).filter((value) => !empty(value)).length;

  function set(id: string, value: any) { setAnswers((a) => ({ ...a, [id]: value })); }
  function filtered(snapshot: Record<string, any>) {
    const shown = data.questions.filter((q: any) => q.type !== "INFO" && visible(q, snapshot));
    const shownIds = new Set(shown.map((q: any) => q.id));
    return Object.fromEntries(Object.entries(snapshot).filter(([id]) => shownIds.has(id)));
  }
  function enqueueSave(snapshot: Record<string, any>) {
    const payload = filtered(snapshot);
    setSaveError(null);
    setSaveState("saving");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      const r = await fetch(`${api}/v1/respond/${encodeURIComponent(token)}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noticeVersionId: data.notice.id, locale, answers: payload }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const failure = apiFailure(r.status, b, es);
        throw Object.assign(new Error(failure.message), { block: failure.block });
      }
      if (b.alreadyCompleted) {
        setMessage(es ? "Tu respuesta ya fue enviada y está registrada." : "Your response has already been submitted and recorded.");
        setState("done");
        setSaveState("saved");
        return;
      }
      setSavedAt(b.savedAt ?? new Date().toISOString());
      setSaveState("saved");
    }).catch((error) => {
      const e = error as Error & { block?: "closed" | "expired" | "revoked" };
      if (e.block) setBlockedReason(e.block);
      setSaveError(e.message || (es ? "No se pudo guardar el progreso." : "Progress could not be saved."));
      setSaveState("error");
    });
    return saveQueue.current;
  }

  useEffect(() => {
    if (data.status === "COMPLETED" || data.assessmentStatus !== "ACTIVE") return;
    if (skipInitialSave.current) { skipInitialSave.current = false; return; }
    setSaveState("waiting");
    const timer = window.setTimeout(() => { void enqueueSave(answers); }, 800);
    return () => window.clearTimeout(timer);
  }, [answers]);

  async function submit() {
    if (!ack) return;
    if (!confirm(es ? "¿Confirmas el envío definitivo de tus respuestas? Después de enviar no podrás modificar esta respuesta." : "Confirm final submission? After submitting you will not be able to edit this response.")) return;
    setState("sending"); setMessage(null);
    try {
      const payload = filtered(answers);
      const r = await fetch(`${api}/v1/respond/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noticeVersionId: data.notice.id, locale, answers: payload }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const failure = apiFailure(r.status, b, es);
        if (failure.block) setBlockedReason(failure.block);
        throw new Error(failure.message);
      }
      setMessage(b.message);
      setSaveState("saved");
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  if (state === "done") return <div className={branded ? "respond-brand-controls" : ""} style={brandStyle}><main className="respond-complete"><ParticipantBrand data={data}/><section><div className="respond-complete-icon"><Icon name="check-circle" size={28}/></div><h1>{es ? "Gracias. Tu respuesta ha quedado registrada." : "Thank you. Your response has been recorded."}</h1><p>{message}</p><span>{es ? "Puedes cerrar esta ventana." : "You may close this window."}</span></section></main></div>;

  if (blockedReason || data.assessmentStatus !== "ACTIVE") {
    const reason = blockedReason ?? "closed";
    const title = reason === "expired" ? (es ? "Esta invitación ha caducado" : "This invitation has expired") : reason === "revoked" ? (es ? "Esta invitación ya no está disponible" : "This invitation is no longer available") : (es ? "Este assessment ya está cerrado" : "This assessment is closed");
    const detail = reason === "expired" ? (es ? "El plazo para responder ha finalizado. Contacta con la organización que te envió la invitación si necesitas una nueva." : "The response period has ended. Contact the organization that sent the invitation if you need a new one.") : reason === "revoked" ? (es ? "El enlace fue retirado o dejó de ser válido. Contacta con la organización que te lo envió." : "The link was withdrawn or is no longer valid. Contact the organization that sent it.") : (es ? "Ya no se aceptan nuevas respuestas. Si necesitas ayuda, contacta con la organización que te envió la invitación." : "New responses are no longer accepted. If you need help, contact the organization that sent the invitation.");
    return <div className={branded ? "respond-brand-controls" : ""} style={brandStyle}><main className="respond-complete"><ParticipantBrand data={data}/><section><h1>{title}</h1><p>{detail}</p></section></main></div>;
  }

  const saveLabel = saveState === "waiting" ? (es ? "Cambios pendientes…" : "Changes pending…") : saveState === "saving" ? (es ? "Guardando…" : "Saving…") : saveState === "saved" ? (es ? "Guardado automáticamente" : "Saved automatically") : saveState === "error" ? (es ? "No se pudo guardar" : "Could not save") : (es ? "El progreso se guarda automáticamente" : "Progress is saved automatically");

  return <div className={branded ? "respond-brand-controls" : ""} style={brandStyle}><header className="topbar"><div className="container nav" style={{ maxWidth: 980 }}><ParticipantBrand data={data}/><div className="nav-actions"><LocaleSwitch locale={locale}/><ThemeToggle labels={es ? { light: "Claro", dark: "Oscuro", system: "Sistema" } : { light: "Light", dark: "Dark", system: "System" }}/></div></div></header><main className="respond-shell"><section className="respond-intro"><h1>{data.title}</h1><p>{data.objective}</p></section>{resumedCount > 0 && data.status === "STARTED" ? <div className="respond-resume"><strong>{es ? "Progreso recuperado" : "Progress restored"}</strong><span>{es ? `Hemos recuperado ${resumedCount} respuesta${resumedCount === 1 ? "" : "s"} guardada${resumedCount === 1 ? "" : "s"}.` : `${resumedCount} saved answer${resumedCount === 1 ? "" : "s"} restored.`}</span></div> : null}<section className="respond-notice"><div className="respond-notice-head"><Icon name="governance" size={18}/><h2>{data.notice.title}</h2></div><p>{data.notice.content}</p><label><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}/><span><strong>{es ? "He leído esta información" : "I have read this information"}</strong><small>{es ? "Se registra la versión informativa mostrada; esto no convierte automáticamente la base jurídica en consentimiento." : "The information version shown is recorded; this does not automatically turn the legal basis into consent."}</small></span></label></section><div className="respond-progress"><i><b style={{ width: `${progress}%` }}/></i><span>{completed}/{answerable.length} {es ? "respondidas" : "answered"}</span></div><div className={`respond-save-status is-${saveState}`} role="status" aria-live="polite" aria-busy={saveState === "saving"}><span>{saveLabel}{savedAt && saveState === "saved" ? ` · ${new Date(savedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}{saveError && saveState === "error" ? ` · ${saveError}` : ""}</span>{saveState === "error" ? <button type="button" onClick={() => void enqueueSave(answers)}>{es ? "Reintentar" : "Retry"}</button> : null}</div><section className="respond-questions">{visibleQuestions.map((q: any) => <article className={q.type === "INFO" ? "respond-info" : "respond-question"} key={q.id}>{q.type === "INFO" ? <><h2>{q.prompt}</h2></> : <><div className="respond-question-head"><span>{q.order}</span><div><h2>{q.prompt}</h2>{q.dimension ? <small>{q.dimension}</small> : null}</div>{q.required ? <b>{es ? "Obligatoria" : "Required"}</b> : null}</div><Question q={q} value={answers[q.id]} onChange={(v: any) => set(q.id, v)} es={es}/></>}</article>)}</section>{message && state === "error" ? <div className="respond-error">{message}</div> : null}<div className="respond-submit"><button className="btn btn-accent proofline-loading-button" disabled={!ack || state === "sending"} aria-busy={state === "sending" || undefined} onClick={submit}><Icon name={state === "sending" ? "refresh" : "check-circle"} size={15} className={state === "sending" ? "proofline-loading-icon" : ""}/>{state === "sending" ? (es ? "Enviando…" : "Sending…") : (es ? "Revisar y enviar respuestas" : "Review and submit answers")}</button><span>{es ? "Antes del envío definitivo pediremos confirmación." : "We will ask for confirmation before final submission."}</span></div></main></div>;
}

function opts(c:any){return Array.isArray(c?.options)?c.options.map((x:any,i:number)=>typeof x==="string"?{value:x,label:x}:{value:x.value??`opt-${i}`,label:x.label??String(x.value??i+1)}):[]}
function Question({q,value,onChange,es}:{q:any;value:any;onChange:(v:any)=>void;es:boolean}){const c=q.config??{};if(q.type==="LIKERT"||q.type==="NPS"){const min=Number(c.min??(q.type==="NPS"?0:1)),max=Number(c.max??(q.type==="NPS"?10:5));return <div className="respond-scale"><small>{c.minLabel}</small><div>{Array.from({length:max-min+1},(_,i)=>min+i).map(n=><label key={n}><input type="radio" name={q.id} checked={Number(value)===n} onChange={()=>onChange(n)}/><span>{n}</span></label>)}</div><small>{c.maxLabel}</small></div>}
 if(q.type==="YES_NO")return <div className="respond-choice-grid">{[{v:"yes",l:es?"Sí":"Yes"},{v:"no",l:"No"},...(c.allowNA?[{v:"na",l:es?"No aplica":"Not applicable"}]:[])].map(x=><label key={x.v}><input type="radio" name={q.id} checked={value===x.v} onChange={()=>onChange(x.v)}/><span>{x.l}</span></label>)}</div>;
 if(q.type==="SINGLE")return <div className="respond-choice-list">{opts(c).map((o:any)=><label key={o.value}><input type="radio" name={q.id} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div>;
 if(q.type==="MULTI"||q.type==="CHECKBOX"){const arr=Array.isArray(value)?value:[];return <div className="respond-choice-list">{opts(c).map((o:any)=><label key={o.value}><input type="checkbox" checked={arr.includes(o.value)} onChange={e=>onChange(e.target.checked?[...arr,o.value]:arr.filter((x:any)=>x!==o.value))}/><span>{o.label}</span></label>)}</div>}
 if(q.type==="NUMERIC")return <input className="input" type="number" min={c.min} max={c.max} step={c.step??1} value={value??""} onChange={e=>onChange(e.target.value===""?"":Number(e.target.value))}/>;
 if(q.type==="RANGE"||q.type==="PERCENTAGE"||q.type==="SLIDER")return <div className="respond-range"><input type="range" min={c.min??0} max={c.max??(q.type==="PERCENTAGE"?100:10)} step={c.step??1} value={value??c.min??0} onChange={e=>onChange(Number(e.target.value))}/><strong>{value??c.min??0}{c.unit??(q.type==="PERCENTAGE"?"%":"")}</strong></div>;
 if(q.type==="SHORT_TEXT"||q.type==="LONG_TEXT")return q.type==="LONG_TEXT"?<textarea className="textarea" value={value??""} maxLength={c.maxLength??1200} onChange={e=>onChange(e.target.value)}/>:<input className="input" value={value??""} maxLength={c.maxLength??500} onChange={e=>onChange(e.target.value)}/>;
 if(q.type==="DUAL"){const min=Number(c.min??1),max=Number(c.max??5),values=Array.from({length:max-min+1},(_,i)=>min+i);return <div className="respond-dual"><label><span>{c.leftLabel??(es?"Importancia":"Importance")}</span><select className="select" value={value?.importance??""} onChange={e=>onChange({...value,importance:Number(e.target.value)})}><option value="">—</option>{values.map(n=><option key={n}>{n}</option>)}</select></label><label><span>{c.rightLabel??(es?"Situación actual":"Current situation")}</span><select className="select" value={value?.performance??""} onChange={e=>onChange({...value,performance:Number(e.target.value)})}><option value="">—</option>{values.map(n=><option key={n}>{n}</option>)}</select></label></div>}
 if(q.type==="MATRIX"){const rows=Array.isArray(c.rows)?c.rows:[],cols=Array.isArray(c.columns)?c.columns:[];return <div className="respond-matrix"><table><thead><tr><th></th>{cols.map((x:any,i:number)=><th key={x.value??i}>{x.label??x.value}</th>)}</tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={r.value??i}><th>{r.label??r.value}</th>{cols.map((col:any,j:number)=><td key={col.value??j}><input type="radio" name={`${q.id}-${r.value??i}`} checked={value?.[r.value??i]===col.value} onChange={()=>onChange({...value,[r.value??i]:col.value})}/></td>)}</tr>)}</tbody></table></div>}
 if(q.type==="RANKING"){const base=Array.isArray(value)?value:opts(c).map((o:any)=>o.value);const labels=Object.fromEntries(opts(c).map((o:any)=>[o.value,o.label]));function swap(i:number,d:number){const n=[...base],t=i+d;if(t<0||t>=n.length)return;[n[i],n[t]]=[n[t],n[i]];onChange(n)}return <div className="respond-ranking">{base.map((v:string,i:number)=><div key={v}><strong>{i+1}</strong><span>{labels[v]??v}</span><button type="button" onClick={()=>swap(i,-1)} disabled={i===0}>↑</button><button type="button" onClick={()=>swap(i,1)} disabled={i===base.length-1}>↓</button></div>)}</div>}
 if(q.type==="ALLOCATION"){const options=opts(c),total=Number(c.total??100),current=value??{};const used=Object.values(current).reduce((s:any,n:any)=>Number(s)+Number(n||0),0) as number;return <div className="respond-allocation"><div><strong>{used}/{total}</strong><span>{es?"asignado":"allocated"}</span></div>{options.map((o:any)=><label key={o.value}><span>{o.label}</span><input className="input" type="number" min="0" max={total} value={current[o.value]??0} onChange={e=>onChange({...current,[o.value]:Number(e.target.value)})}/></label>)}</div>}
 return <input className="input" value={value??""} onChange={e=>onChange(e.target.value)}/>}
