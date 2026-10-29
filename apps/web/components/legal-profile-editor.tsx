"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";
export function LegalProfileEditor({assessmentId,locale,noticeLocale,initial}:{assessmentId:string;locale:"es"|"en";noticeLocale?:"es"|"en";initial:any}){const es=locale==="es",participantLocale=noticeLocale??locale;const router=useRouter();const api="/api/proxy";const [open,setOpen]=useState(!initial);const [controllerName,setControllerName]=useState(initial?.controllerName??"ACME Europe");const [purpose,setPurpose]=useState(initial?.purpose??"");const [legalBasis,setLegalBasis]=useState(initial?.legalBasis??"");const [participationMode,setParticipationMode]=useState(initial?.participationMode??"VOLUNTARY");const [confidentiality,setConfidentiality]=useState(initial?.confidentiality??"PSEUDONYMOUS_CONFIDENTIAL");const [retentionDays,setRetentionDays]=useState(initial?.retentionDays??365);const [dpoContact,setDpoContact]=useState(initial?.dpoContact??"");const [approve,setApprove]=useState(Boolean(initial?.approvedAt));const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 const initialValues={
  controllerName:initial?.controllerName??"ACME Europe",
  purpose:initial?.purpose??"",
  legalBasis:initial?.legalBasis??"",
  participationMode:initial?.participationMode??"VOLUNTARY",
  confidentiality:initial?.confidentiality??"PSEUDONYMOUS_CONFIDENTIAL",
  retentionDays:initial?.retentionDays??365,
  dpoContact:initial?.dpoContact??"",
  approve:Boolean(initial?.approvedAt),
 };
 const isDirty=JSON.stringify({controllerName,purpose,legalBasis,participationMode,confidentiality,retentionDays,dpoContact,approve})!==JSON.stringify(initialValues);
 function resetToSaved(){
  setControllerName(initialValues.controllerName);
  setPurpose(initialValues.purpose);
  setLegalBasis(initialValues.legalBasis);
  setParticipationMode(initialValues.participationMode);
  setConfidentiality(initialValues.confidentiality);
  setRetentionDays(initialValues.retentionDays);
  setDpoContact(initialValues.dpoContact);
  setApprove(initialValues.approve);
  setError(null);
 }
 async function toggleEditor(){
  if(busy)return;
  if(!open){setOpen(true);return;}
  if(isDirty){
   const discard=await requestProoflineConfirmation({
    title:es?"Cambios sin guardar":"Unsaved changes",
    message:es?"Hay cambios pendientes en el perfil legal. Si cierras ahora, se descartarán. ¿Quieres cerrar sin guardar?":"There are unsaved changes to the legal profile. Closing now will discard them. Close without saving?",
    confirmLabel:es?"Descartar y cerrar":"Discard and close",
    cancelLabel:es?"Seguir editando":"Keep editing",
    tone:"danger",
   });
   if(!discard)return;
   resetToSaved();
  }
  setOpen(false);
 }

 return <div className="workspace-legal-editor"><div className="workspace-legal-editor-head"><div><strong>{es?"Privacidad del assessment":"Assessment privacy"}</strong><small>{initial?.approvedAt?(es?"Revisada y aprobada":"Reviewed and approved"):(es?"Pendiente de completar":"Pending completion")}</small></div><button className="workspace-text-button" type="button" disabled={busy} onClick={toggleEditor}>{open?(es?"Cerrar edición":"Close editor"):(es?"Editar perfil":"Edit profile")}</button></div>{open?<form className="assessment-legal-compact-form" onSubmit={async(e)=>{e.preventDefault();setBusy(true);setError(null);try{const r=await fetch(`${api}/v1/assessments/${assessmentId}/legal-profile`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({controllerName,purpose,legalBasis,participationMode,confidentiality,retentionDays:Number(retentionDays),dpoContact,approve,locale:participantLocale})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(Array.isArray(b?.message)?b.message.join(" · "):b?.message??`API ${r.status}`);setOpen(false);router.refresh()}catch(err){setError(err instanceof Error?err.message:String(err))}finally{setBusy(false)}}}><label className="label assessment-legal-controller">{es?"Responsable / controller":"Controller"}<input className="input" value={controllerName} onChange={e=>setControllerName(e.target.value)} required/></label><label className="label assessment-legal-purpose">{es?"Finalidad":"Purpose"}<textarea className="textarea compact-area" value={purpose} onChange={e=>setPurpose(e.target.value)} required minLength={12}/></label><label className="label assessment-legal-basis">{es?"Base jurídica declarada":"Declared legal basis"}<textarea className="textarea compact-area" value={legalBasis} onChange={e=>setLegalBasis(e.target.value)} required minLength={4}/></label><div className="form-row"><label className="label assessment-legal-participation">{es?"Participación":"Participation"}<select className="select" value={participationMode} onChange={e=>setParticipationMode(e.target.value)}><option value="VOLUNTARY">VOLUNTARY</option><option value="MANDATORY">MANDATORY</option><option value="VOLUNTARY_DEMO">VOLUNTARY_DEMO</option></select></label><label className="label assessment-legal-confidentiality">{es?"Confidencialidad":"Confidentiality"}<select className="select" value={confidentiality} onChange={e=>setConfidentiality(e.target.value)}><option value="PSEUDONYMOUS_CONFIDENTIAL">PSEUDONYMOUS_CONFIDENTIAL</option><option value="IDENTIFIED">IDENTIFIED</option><option value="ANONYMOUS">ANONYMOUS</option></select></label></div><div className="form-row"><label className="label assessment-legal-retention">{es?"Retención (días)":"Retention (days)"}<input className="input" type="number" min={1} max={3650} value={retentionDays} onChange={e=>setRetentionDays(Number(e.target.value))}/></label><label className="label assessment-legal-contact">DPO / privacy contact<input className="input" type="email" value={dpoContact} onChange={e=>setDpoContact(e.target.value)}/></label></div><label className="workspace-checkbox"><input type="checkbox" checked={approve} onChange={e=>setApprove(e.target.checked)}/><span>{es?"Marcar este perfil como revisado y aprobado. Al guardar, Proofline genera una nueva versión del aviso al participante para conservar qué información se mostró y bajo qué configuración. La aprobación está sujeta a los permisos y al proceso legal definido por la organización.":"Mark this profile as reviewed and approved. Saving creates a new participant notice version to preserve what information was shown and under which configuration. Approval is subject to the organization's permissions and legal review process."}</span></label>{error?<div className="workspace-alert danger">{error}</div>:null}<button className="btn btn-accent" type="submit" disabled={busy}>{busy?(es?"Guardando…":"Saving…"):(es?"Guardar perfil":"Save profile")}</button></form>:initial?<div className="workspace-legal-summary"><p>{initial.purpose}</p><dl><div><dt>{es?"Base declarada":"Declared basis"}</dt><dd>{initial.legalBasis}</dd></div><div><dt>{es?"Retención":"Retention"}</dt><dd>{initial.retentionDays} {es?"días":"days"}</dd></div><div><dt>{es?"Confidencialidad":"Confidentiality"}</dt><dd>{initial.confidentiality}</dd></div></dl></div>:null}</div>}
