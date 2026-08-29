"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@proofline/ui";
import { requestProoflineConfirmation } from "@proofline/ui/client";

export function AssessmentDeleteButton({id,locale,enabled}:{id:string;locale:"es"|"en";enabled:boolean}){
  const es=locale==="es",router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  if(!enabled)return null;
  async function remove(){
    const confirmed=await requestProoflineConfirmation({title:es?"Eliminar assessment":"Delete assessment",message:es?"Se borrarán configuración, preguntas y población preparada. Esta acción no se puede deshacer; los registros de auditoría o uso que deban conservarse permanecerán.":"Configuration, questions and prepared population will be removed. This cannot be undone; audit or usage records that must be retained will remain.",confirmLabel:es?"Eliminar assessment":"Delete assessment",tone:"danger"});
    if(!confirmed)return;
    setBusy(true);setError("");
    try{
      const response=await fetch(`/api/proxy/v1/assessments/${id}`,{method:"DELETE"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(Array.isArray(body?.message)?body.message.join(" · "):body?.message??`API ${response.status}`);
      router.push(`/${locale}/assessments`);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false)}
  }
  return <div className="assessment-delete-control"><button type="button" className="btn btn-danger-quiet" disabled={busy} onClick={remove}><Icon name="delete" size={15}/>{busy?(es?"Eliminando…":"Deleting…"):(es?"Eliminar assessment":"Delete assessment")}</button>{error?<div className="workspace-alert danger">{error}</div>:null}</div>;
}
