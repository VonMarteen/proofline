"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Preference = "light" | "dark" | "system";
const key = "proofline-theme";
function apply(pref: Preference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = pref;
  localStorage.setItem(key, pref);
}
export function ThemeToggle({ labels = {light:"Light", dark:"Dark", system:"System"} }: { labels?: Record<Preference,string> }) {
  const [pref, setPref] = useState<Preference>("system");
  useEffect(() => { const current = (localStorage.getItem(key) as Preference | null) ?? "system"; setPref(current); apply(current); }, []);
  const cycle: Preference = pref === "system" ? "light" : pref === "light" ? "dark" : "system";
  return <button className="btn btn-small btn-ghost" type="button" onClick={() => { setPref(cycle); apply(cycle); }} aria-label="Theme">◐ {labels[pref]}</button>;
}

export function CookiePreferences({ locale }: { locale: "es"|"en" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!localStorage.getItem("proofline-cookie-pref")); }, []);
  if (!open) return null;
  const es = locale === "es";
  const choose = (value: string) => { localStorage.setItem("proofline-cookie-pref", value); setOpen(false); };
  return <div className="cookie"><strong>{es ? "Tus preferencias, sin trampas" : "Your preferences, without tricks"}</strong><p className="muted" style={{marginBottom:12}}>{es ? "Este entorno local no carga analítica ni publicidad. Dejamos el centro de preferencias preparado para producción." : "This local environment loads no analytics or advertising. The preference center is already wired for production."}</p><div className="hero-actions" style={{marginTop:0}}><button className="btn btn-small" onClick={()=>choose("necessary")}>{es?"Rechazar no esenciales":"Reject non-essential"}</button><button className="btn btn-small" onClick={()=>choose("configured")}>{es?"Configurar":"Configure"}</button><button className="btn btn-small btn-primary" onClick={()=>choose("all")}>{es?"Aceptar todo":"Accept all"}</button></div></div>;
}

export function LocaleSwitch({ locale }: { locale: "es"|"en" }) {
  const pathname = usePathname();
  const next = locale === "es" ? "en" : "es";
  const parts = pathname.split("/");
  if (parts.length > 1) parts[1] = next;
  const href = parts.join("/") || `/${next}`;
  return <a className="btn btn-small btn-ghost" href={href} aria-label="Language">{next.toUpperCase()}</a>;
}


type ConfirmOptions = { title?: string; message?: string; confirmLabel?: string; cancelLabel?: string; tone?: "default" | "danger"; };
type ConfirmRequestDetail = ConfirmOptions & { resolve: (value: boolean) => void };
const CONFIRM_EVENT = "proofline:confirm-action";
export function requestProoflineConfirmation(options: ConfirmOptions = {}) {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise<boolean>((resolve) => window.dispatchEvent(new CustomEvent<ConfirmRequestDetail>(CONFIRM_EVENT,{detail:{...options,resolve}})));
}
function inferSubmitLabel(submitter: HTMLElement | null, locale: "es" | "en") { return submitter?.textContent?.trim() || (locale === "es" ? "Continuar" : "Continue"); }
function inferDanger(label:string){const x=label.toLowerCase();return ["eliminar","borrar","cerrar","rechazar","revocar","delete","remove","close","reject","revoke"].some(w=>x.includes(w));}
export function ConfirmActionProvider({locale,children}:{locale:"es"|"en";children:React.ReactNode}){
  const es=locale==="es",[pending,setPending]=useState<(ConfirmRequestDetail&{form?:HTMLFormElement;submitter?:HTMLElement|null})|null>(null),bypass=React.useRef<WeakSet<HTMLFormElement>>(new WeakSet());
  useEffect(()=>{const onExternal=(event:Event)=>{const detail=(event as CustomEvent<ConfirmRequestDetail>).detail;if(detail)setPending(detail)};const onSubmit=(event:SubmitEvent)=>{const form=event.target instanceof HTMLFormElement?event.target:null;if(!form||form.dataset.prooflineNoConfirm==="true")return;if(bypass.current.has(form)){bypass.current.delete(form);return}event.preventDefault();event.stopPropagation();const submitter=event.submitter instanceof HTMLElement?event.submitter:null,label=inferSubmitLabel(submitter,locale),formData=new FormData(form),nextStatus=String(formData.get("status")??"").trim(),inferredMessage=nextStatus?(es?`¿Confirmas cambiar el estado a ${nextStatus.replaceAll("_"," ")}?`:`Confirm changing the status to ${nextStatus.replaceAll("_"," ")}?`):(es?`¿Quieres continuar con “${label}”? Los cambios se aplicarán al confirmar.`:`Do you want to continue with “${label}”? Changes will be applied after confirmation.`);setPending({title:form.dataset.confirmTitle||(es?"Confirmar acción":"Confirm action"),message:form.dataset.confirmMessage||inferredMessage,confirmLabel:form.dataset.confirmLabel||label,cancelLabel:es?"Cancelar":"Cancel",tone:form.dataset.confirmTone==="danger"||inferDanger(label)?"danger":"default",resolve:(ok)=>{if(!ok)return;bypass.current.add(form);form.requestSubmit(submitter instanceof HTMLButtonElement||submitter instanceof HTMLInputElement?submitter:undefined)},form,submitter})};window.addEventListener(CONFIRM_EVENT,onExternal as EventListener);document.addEventListener("submit",onSubmit,true);return()=>{window.removeEventListener(CONFIRM_EVENT,onExternal as EventListener);document.removeEventListener("submit",onSubmit,true)}},[es,locale]);
  const settle=(value:boolean)=>{const current=pending;setPending(null);current?.resolve(value)};
  return <>{children}{pending?<div className="proofline-confirm-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)settle(false)}}><section className="proofline-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="proofline-confirm-title"><div className="proofline-confirm-icon" aria-hidden="true">{pending.tone==="danger"?"!":"✓"}</div><div className="proofline-confirm-copy"><h2 id="proofline-confirm-title">{pending.title||(es?"Confirmar acción":"Confirm action")}</h2><p>{pending.message||(es?"¿Quieres continuar?":"Do you want to continue?")}</p></div><div className="proofline-confirm-actions"><button type="button" className="proofline-confirm-cancel" onClick={()=>settle(false)} autoFocus>{pending.cancelLabel||(es?"Cancelar":"Cancel")}</button><button type="button" className={`proofline-confirm-submit${pending.tone==="danger"?" danger":""}`} onClick={()=>settle(true)}>{pending.confirmLabel||(es?"Confirmar":"Confirm")}</button></div></section></div>:null}</>;
}
