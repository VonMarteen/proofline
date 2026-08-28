"use client";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { requestProoflineConfirmation } from "@proofline/ui/client";

export function FrameworkLibrary({locale,frameworks}:{locale:"es"|"en";frameworks:any[]}){
  const es=locale==="es";
  const router=useRouter();
  const[q,setQ]=useState("");
  const[cat,setCat]=useState("ALL");
  const[limit,setLimit]=useState(12);
  const[suggestions,setSuggestions]=useState<any[]>([]);
  const[busy,setBusy]=useState("");
  const[error,setError]=useState<string|null>(null);
  const cats=useMemo(()=>[...new Set(frameworks.map(f=>f.category))].sort(),[frameworks]);
  const filtered=useMemo(()=>frameworks.filter(f=>(cat==="ALL"||f.category===cat)&&`${f.name} ${f.description} ${f.category} ${(f.tags??[]).join(" ")} ${f.latestVersion?.objective??""}`.toLowerCase().includes(q.toLowerCase())),[frameworks,q,cat]);
  useEffect(()=>setLimit(12),[q,cat]);

  async function rec(){
    setBusy("rec");setError(null);
    try{
      const x=await fetch(`/api/proxy/v1/workspace/frameworks/recommend?q=${encodeURIComponent(q)}`,{cache:"no-store"});
      const b=await x.json().catch(()=>({}));
      if(!x.ok)throw new Error(Array.isArray(b?.message)?b.message.join(" · "):b?.message??`API ${x.status}`);
      setSuggestions(b.results??[]);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy("");}
  }

  async function start(id:string){
    const ok=await requestProoflineConfirmation({title:es?"Crear assessment desde framework":"Create assessment from framework",message:es?"Se creará un nuevo assessment editable a partir de este framework.":"A new editable assessment will be created from this framework.",confirmLabel:es?"Crear assessment":"Create assessment"});if(!ok)return;
    setBusy(id);setError(null);
    try{
      const x=await fetch(`/api/proxy/v1/workspace/frameworks/${id}/start`,{method:"POST",headers:{"content-type":"application/json"},body:"{}",cache:"no-store"});
      const b=await x.json().catch(()=>({}));
      if(!x.ok)throw new Error(Array.isArray(b?.message)?b.message.join(" · "):b?.message??`API ${x.status}`);
      if(!b?.assessmentId)throw new Error(es?"Proofline no devolvió el assessment creado.":"Proofline did not return the created assessment.");
      router.push(`/${locale}/assessments/${b.assessmentId}`);
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy("");}
  }

  return <>
    <section className="library-assistant"><div><h2>{es?"¿Qué necesitas entender o decidir?":"What do you need to understand or decide?"}</h2><p>{es?"Descríbelo con tus palabras. Proofline busca afinidad dentro del catálogo y prioriza marcos cercanos al objetivo; tú decides cuál usar o adaptar.":"Describe it in your own words. Proofline finds affinity within the catalog and prioritizes relevant frameworks; you decide what to use or adapt."}</p></div><div className="library-query"><input className="input" value={q} onChange={e=>{setQ(e.target.value);setSuggestions([])}} placeholder={es?"Ej.: quiero entender por qué el equipo comercial tiene tanta rotación":"E.g. understand why sales turnover is high"}/><button className="btn btn-accent" onClick={rec} disabled={q.trim().length<3||busy==="rec"}>{busy==="rec"?(es?"Buscando…":"Searching…"):(es?"Encontrar los más adecuados":"Find best matches")}</button></div>{suggestions.length?<div className="library-suggestions">{suggestions.slice(0,3).map((f:any,i:number)=><a href={`/${locale}/library/${f.id}`} key={f.id}><span>{i===0?(es?"Mejor coincidencia":"Best match"):(es?"También puede encajar":"Also relevant")}</span><strong>{f.name}</strong><p>{f.reason}</p></a>)}</div>:null}</section>
    {error?<div className="workspace-alert danger" role="alert"><strong>{es?"No se pudo crear el assessment.":"The assessment could not be created."}</strong><span>{error}</span></div>:null}
    <div className="workspace-library-tools"><input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder={es?"Buscar por nombre, objetivo o tema…":"Search by name, objective or topic…"}/><select className="select" value={cat} onChange={e=>setCat(e.target.value)}><option value="ALL">{es?"Todas las categorías":"All categories"}</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    <div className="library-results-summary"><strong>{filtered.length}</strong><span>{es?"frameworks coinciden con la selección":"frameworks match the selection"}</span></div>
    <div className="workspace-framework-grid">{filtered.slice(0,limit).map(f=><article className="workspace-framework-card" key={f.id}><div className="framework-card-meta"><span>{f.category}</span><span>{f.durationMin} min</span></div><h2>{f.name}</h2><p>{f.description}</p><div className="workspace-framework-objective"><strong>{f.latestVersion?.objective}</strong></div><div className="workspace-framework-dimensions">{(f.latestVersion?.dimensions??[]).slice(0,4).map((d:string)=><span key={d}>{d}</span>)}</div><div className="workspace-card-actions"><a className="btn" href={`/${locale}/library/${f.id}`}>{es?"Ver y revisar":"Review"}</a><button className="btn btn-accent" disabled={Boolean(busy)} onClick={()=>start(f.id)}>{busy===f.id?(es?"Creando assessment…":"Creating assessment…"):(es?"Usar como base":"Use as base")}</button></div></article>)}</div>
    {filtered.length>limit?<div className="library-load-more"><button className="btn" onClick={()=>setLimit(x=>x+12)}>{es?"Mostrar más":"Show more"}</button></div>:null}
  </>;
}
