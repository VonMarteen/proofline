"use client";
import { useEffect, useMemo, useState } from "react";
import { requestProoflineConfirmation } from "@proofline/ui/client";
import { AppBackgroundLoading, LoadingButton } from "@proofline/ui";

export function AnalysisRunner({assessmentId,locale,initial,canRun=true,questions=[]}:{assessmentId:string;locale:"es"|"en";initial:any;canRun?:boolean;questions?:any[]}){
 const es=locale==="es",[run,setRun]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState("");const byId=useMemo(()=>new Map(questions.map(q=>[q.id,q])),[questions]);
 // Run one poll at a time; a failed network request must not leave an unhandled rejection.
 useEffect(()=>{
  if(!["PENDING","RUNNING"].includes(run?.status))return;
  let stopped=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const poll=async()=>{
   try{
    const response=await fetch(`/api/proxy/v1/assessments/${encodeURIComponent(assessmentId)}/analysis-runs/latest`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const latest=await response.json();
    if(!stopped){setRun(latest);setError("");}
   }catch{
    if(!stopped)setError(es?"No se pudo actualizar el análisis. Volveremos a consultar automáticamente.":"Could not refresh the analysis. We will retry automatically.");
   }finally{
    if(!stopped)timer=setTimeout(poll,1500);
   }
  };
  timer=setTimeout(poll,1500);
  return()=>{stopped=true;if(timer)clearTimeout(timer)};
 },[assessmentId,run?.status,es]);
 async function start(){
  if(busy)return;
  const confirmed=await requestProoflineConfirmation({title:es?"Recalcular análisis":"Run analysis again",message:es?"Se generará una nueva ejecución de análisis y quedará registrada como evidencia operativa.":"A new analysis run will be generated and recorded as operational evidence.",confirmLabel:es?"Recalcular":"Run analysis"});
  if(!confirmed)return;
  setBusy(true);setError("");
  try{
   const response=await fetch(`/api/proxy/v1/assessments/${encodeURIComponent(assessmentId)}/analysis-runs`,{method:"POST"});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok){setError(Array.isArray(payload?.message)?payload.message.join(" · "):payload?.message??`HTTP ${response.status}`);return;}
   setRun(payload);
  }catch{
   setError(es?"No se pudo conectar. Comprueba el estado del análisis antes de volver a solicitarlo.":"Connection failed. Check the analysis state before requesting it again.");
  }finally{setBusy(false)}
 }
 const result=run?.result;const dims=Object.entries(result?.dimensionScores??{}),choices=Object.entries(result?.choiceDistributions??{}),rankings=Object.entries(result?.rankingResults??{}),allocations=Object.entries(result?.allocationResults??{}),matrices=Object.entries(result?.matrixDistributions??{}),cohorts=Object.entries(result?.cohorts??{}),themes=result?.qualitativeThemes??[];
 return <section className="workspace-analysis"><div className="workspace-analysis-head"><div><h2>{es?"Resultados y evidencia":"Results and evidence"}</h2><p>{es?"La lectura combina puntuaciones, distribuciones, preguntas no escalares, cohortes permitidas y evidencia cualitativa. Cada tipo de pregunta conserva una interpretación coherente con su configuración.":"The reading combines scores, distributions, non-scale questions, allowed cohorts and qualitative evidence. Each question type keeps an interpretation consistent with its configuration."}</p></div><div className="workspace-card-actions"><AppBackgroundLoading active={run?.status==="PENDING"||run?.status==="RUNNING"} label={es?"Actualizando resultados…":"Updating results…"}/>{canRun?<LoadingButton className="btn btn-accent" type="button" onClick={start} loading={busy} disabled={run?.status==="PENDING"||run?.status==="RUNNING"} loadingLabel={es?"Solicitando…":"Starting…"}>{es?"Recalcular análisis":"Run analysis"}</LoadingButton>:null}</div></div>{error?<div className="workspace-alert danger">{error}</div>:null}{result?<div className="workspace-analysis-body"><div className="workspace-analysis-primary"><strong>{result.highlights?.[0]??(es?"El análisis está disponible para revisión.":"The analysis is ready for review.")}</strong><p>{es?"Revisa evidencia, participación, cohortes y limitaciones antes de aprobar o distribuir una conclusión.":"Review evidence, participation, cohorts and limitations before approving or distributing a conclusion."}</p></div><div className="workspace-analysis-stats"><div><span>{es?"Respuestas":"Responses"}</span><strong>{result.completedResponses}</strong></div><div><span>{es?"Índice global":"Overall"}</span><strong>{result.overallScore??"—"}</strong></div><div><span>{es?"Motor":"Engine"}</span><strong>{result.engine?.aiUsed?(es?"IA acotada":"Bounded AI"):(es?"Determinista":"Deterministic")}</strong></div></div>{dims.length?<ResultSection title={es?"Dimensiones":"Dimensions"}><div className="workspace-dimension-bars">{dims.map(([k,v])=><div key={k}><div><span>{k}</span><strong>{String(v)}</strong></div><div className="workspace-mini-bar"><i style={{width:`${Math.max(0,Math.min(100,Number(v)))}%`}}/></div></div>)}</div></ResultSection>:null}{choices.length?<ResultSection title={es?"Distribuciones de respuesta":"Response distributions"}><div className="analysis-distribution-grid">{choices.map(([qid,raw])=><Distribution key={qid} q={byId.get(qid)} raw={raw as any} es={es}/>)}</div></ResultSection>:null}{rankings.length?<ResultSection title={es?"Rankings":"Rankings"}><div className="analysis-special-grid">{rankings.map(([qid,rows])=><article key={qid}><h4>{byId.get(qid)?.prompt??qid}</h4>{(rows as any[]).slice(0,6).map((x:any)=><div className="analysis-rank-row" key={x.option}><strong>{optionLabel(byId.get(qid),x.option)}</strong><span>{es?"posición media":"average rank"} {x.averageRank}</span></div>)}</article>)}</div></ResultSection>:null}{allocations.length?<ResultSection title={es?"Repartos / allocation":"Allocations"}><div className="analysis-special-grid">{allocations.map(([qid,vals])=><article key={qid}><h4>{byId.get(qid)?.prompt??qid}</h4>{Object.entries(vals as any).sort((a:any,b:any)=>Number(b[1])-Number(a[1])).map(([k,v])=><div className="analysis-allocation-row" key={k}><span>{optionLabel(byId.get(qid),k)}</span><strong>{String(v)}</strong></div>)}</article>)}</div></ResultSection>:null}{matrices.length?<ResultSection title={es?"Matrices":"Matrices"}><div className="analysis-special-grid">{matrices.map(([qid,rows])=><article key={qid}><h4>{byId.get(qid)?.prompt??qid}</h4>{Object.entries(rows as any).map(([row,dist])=><div className="analysis-matrix-row" key={row}><strong>{matrixRowLabel(byId.get(qid),row)}</strong><span>{Object.entries(dist as any).map(([k,v])=>`${matrixColumnLabel(byId.get(qid),k)}: ${v}`).join(" · ")}</span></div>)}</article>)}</div></ResultSection>:null}{cohorts.length?<ResultSection title={es?"Cohortes permitidas":"Allowed cohorts"}><div className="analysis-cohorts">{cohorts.map(([name,val]:any)=><div key={name}><span>{name.replace(":"," · ")}</span>{val.suppressed?<strong>{es?`Oculto · n=${val.n}`:`Suppressed · n=${val.n}`}</strong>:<strong>{val.score??"—"} · n={val.n}</strong>}</div>)}</div></ResultSection>:null}{themes.length?<ResultSection title={es?"Evidencia cualitativa":"Qualitative evidence"}><div className="analysis-themes">{themes.map((t:any)=><article key={t.theme}><strong>{t.theme}</strong><span>{t.mentions} {es?"menciones":"mentions"}</span>{t.example?<p>“{t.example}”</p>:null}</article>)}</div></ResultSection>:null}</div>:<div className="workspace-analysis-empty">{es?"Todavía no hay resultado analítico. Cuando existan respuestas completas podrás generar una lectura reproducible y convertirla en informe.":"No analytical result yet. Once completed responses exist you can generate a reproducible reading and turn it into a report."}</div>}</section>
}
function ResultSection({title,children}:{title:string;children:React.ReactNode}){return <section className="analysis-result-section"><h3>{title}</h3>{children}</section>}
function optionLabel(q:any,value:string){const o=q?.config?.options?.find((x:any)=>String(typeof x==="string"?x:x.value)===String(value));return typeof o==="string"?o:o?.label??value}
function matrixRowLabel(q:any,value:string){const o=q?.config?.rows?.find((x:any)=>String(typeof x==="string"?x:x.value)===String(value));return typeof o==="string"?o:o?.label??value}
function matrixColumnLabel(q:any,value:string){const o=q?.config?.columns?.find((x:any)=>String(typeof x==="string"?x:x.value)===String(value));return typeof o==="string"?o:o?.label??value}
function Distribution({q,raw,es}:{q:any;raw:Record<string,number>;es:boolean}){const entries=Object.entries(raw).sort((a,b)=>b[1]-a[1]),total=entries.reduce((s,[,v])=>s+Number(v),0)||1;return <article><h4>{q?.prompt??(es?"Pregunta":"Question")}</h4>{entries.map(([k,v])=><div className="analysis-dist-row" key={k}><div><span>{q?.type==="YES_NO"?(k==="yes"?(es?"Sí":"Yes"):k==="no"?"No":(es?"No aplica":"N/A")):optionLabel(q,k)}</span><strong>{Math.round(Number(v)/total*100)}%</strong></div><i><b style={{width:`${Math.round(Number(v)/total*100)}%`}}/></i><small>n={v}</small></div>)}</article>}
