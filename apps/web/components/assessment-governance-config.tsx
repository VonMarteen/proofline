"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssessmentGovernanceConfig({assessmentId,locale,privacyMode,minCohortSize,participantLocale,editable}:{assessmentId:string;locale:"es"|"en";privacyMode:string;minCohortSize:number;participantLocale:"es"|"en";editable:boolean}){
  const es=locale==="es",router=useRouter();
  const [privacy,setPrivacy]=useState(privacyMode||"CONFIDENTIAL");
  const [cohort,setCohort]=useState(Number(minCohortSize||7));
  const [language,setLanguage]=useState<"es"|"en">(participantLocale||"es");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const dirty=privacy!==privacyMode||cohort!==Number(minCohortSize)||language!==participantLocale;

  async function save(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch(`/api/proxy/v1/assessments/${assessmentId}/governance`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({privacyMode:privacy,minCohortSize:cohort,locale:language})});
      const body=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(Array.isArray(body?.message)?body.message.join(" · "):body?.message??`API ${r.status}`);
      setMessage(es?"Gobernanza guardada. La próxima versión y el aviso al participante usarán esta configuración.":"Governance saved. The next frozen version and participant notice will use this configuration.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}
  }

  return <section className="workspace-section assessment-governance-card">
    <div className="workspace-section-head clean"><div><h2>{es?"Privacidad, cohorte e idioma":"Privacy, cohort and language"}</h2><p>{es?"Define cómo se identifican los participantes, el umbral mínimo para mostrar cohortes y el idioma de la experiencia participante. Se congela al lanzar.":"Define participant identification, the minimum cohort threshold and the participant experience language. It is frozen at launch."}</p></div></div>
    <div className="assessment-governance-grid">
      <label className="label">{es?"Modo de privacidad":"Privacy mode"}<select className="select" value={privacy} disabled={!editable||busy} onChange={e=>setPrivacy(e.target.value)}><option value="IDENTIFIED">IDENTIFIED</option><option value="CONFIDENTIAL">CONFIDENTIAL</option><option value="ANONYMOUS">ANONYMOUS</option></select></label>
      <label className="label">{es?"Umbral mínimo de cohorte":"Minimum cohort threshold"}<input className="input" type="number" min={5} max={50} value={cohort} disabled={!editable||busy} onChange={e=>setCohort(Math.max(5,Math.min(50,Number(e.target.value)||5)))}/></label>
      <label className="label">{es?"Idioma del participante":"Participant language"}<select className="select" value={language} disabled={!editable||busy} onChange={e=>setLanguage(e.target.value as "es"|"en")}><option value="es">Español</option><option value="en">English</option></select></label>
    </div>
    {editable?<div className="workspace-card-actions"><button className="btn btn-accent" type="button" disabled={busy||!dirty} onClick={save}>{busy?(es?"Guardando…":"Saving…"):(es?"Guardar gobernanza":"Save governance")}</button></div>:null}
    {message?<div className={`workspace-alert ${/API|Error|error|locked/i.test(message)?"danger":""}`}>{message}</div>:null}
  </section>;
}
