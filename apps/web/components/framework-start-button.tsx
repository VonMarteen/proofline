"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";
import {AssessmentLevelSelect} from "./assessment-level-select";

export function FrameworkStartButton({locale,frameworkId}:{locale:"es"|"en";frameworkId:string}){
  const es=locale==="es";
  const router=useRouter();
  const[level,setLevel]=useState("L2");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);
  async function start(){
    const ok=await requestProoflineConfirmation({title:es?"Crear assessment desde framework":"Create assessment from framework",message:es?`Se creará una versión editable como ${level}. Podrás cambiar el nivel mientras siga en preparación.`:`An editable ${level} assessment will be created. You can change the level while it remains in preparation.`,confirmLabel:es?"Crear assessment":"Create assessment"});if(!ok)return;
    setBusy(true);setError(null);
    try{
      const x=await fetch(`/api/proxy/v1/workspace/frameworks/${frameworkId}/start`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({level}),cache:"no-store"});
      const b=await x.json().catch(()=>({}));
      if(!x.ok)throw new Error(Array.isArray(b?.message)?b.message.join(" · "):b?.message??`API ${x.status}`);
      if(!b?.assessmentId)throw new Error(es?"Proofline no devolvió el assessment creado.":"Proofline did not return the created assessment.");
      router.push(`/${locale}/assessments/${b.assessmentId}`);
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);}
  }
  return <div className="framework-start-action"><AssessmentLevelSelect locale={locale} value={level} onChange={setLevel} disabled={busy}/><button className="btn btn-accent" disabled={busy} onClick={start}>{busy?(es?"Preparando assessment…":"Preparing assessment…"):(es?"Usar como base editable":"Use as editable base")}</button>{error?<div className="workspace-alert danger" role="alert">{error}</div>:null}</div>;
}
