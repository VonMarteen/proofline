"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";

export function FrameworkStartButton({locale,frameworkId}:{locale:"es"|"en";frameworkId:string}){
  const es=locale==="es";
  const router=useRouter();
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);
  async function start(){
    const ok=await requestProoflineConfirmation({title:es?"Crear assessment desde framework":"Create assessment from framework",message:es?"Se creará un nuevo assessment editable a partir de este framework.":"A new editable assessment will be created from this framework.",confirmLabel:es?"Crear assessment":"Create assessment"});if(!ok)return;
    setBusy(true);setError(null);
    try{
      const x=await fetch(`/api/proxy/v1/workspace/frameworks/${frameworkId}/start`,{method:"POST",headers:{"content-type":"application/json"},body:"{}",cache:"no-store"});
      const b=await x.json().catch(()=>({}));
      if(!x.ok)throw new Error(Array.isArray(b?.message)?b.message.join(" · "):b?.message??`API ${x.status}`);
      if(!b?.assessmentId)throw new Error(es?"Proofline no devolvió el assessment creado.":"Proofline did not return the created assessment.");
      router.push(`/${locale}/assessments/${b.assessmentId}`);
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);}
  }
  return <div className="framework-start-action"><button className="btn btn-accent" disabled={busy} onClick={start}>{busy?(es?"Preparando assessment…":"Preparing assessment…"):(es?"Usar como base editable":"Use as editable base")}</button>{error?<div className="workspace-alert danger" role="alert">{error}</div>:null}</div>;
}
