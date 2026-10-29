"use client";

export const assessmentLevels = [
  { value: "L1", es: "L1 · Pulse", en: "L1 · Pulse", range: "10–20", timeEs: "3–6 min", timeEn: "3–6 min" },
  { value: "L2", es: "L2 · Diagnostic", en: "L2 · Diagnostic", range: "21–40", timeEs: "7–12 min", timeEn: "7–12 min" },
  { value: "L3", es: "L3 · Deep Diagnostic", en: "L3 · Deep Diagnostic", range: "41–70", timeEs: "12–20 min", timeEn: "12–20 min" },
  { value: "L4", es: "L4 · Strategic", en: "L4 · Strategic", range: "71–100", timeEs: "20–30 min", timeEn: "20–30 min" },
] as const;

export function AssessmentLevelSelect({locale,value,onChange,disabled=false}:{locale:"es"|"en";value:string;onChange:(value:string)=>void;disabled?:boolean}){
  const es=locale==="es",selected=assessmentLevels.find(x=>x.value===value)??assessmentLevels[1];
  return <div className="assessment-level-control"><label className="label">{es?"Nivel del assessment":"Assessment level"}<select className="select" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{assessmentLevels.map(level=><option key={level.value} value={level.value}>{es?level.es:level.en}</option>)}</select></label><p className="muted">{es?`Referencia: ${selected.range} preguntas · ${selected.timeEs}. El nivel define profundidad y reporting, no el plan comercial.`:`Reference: ${selected.range} questions · ${selected.timeEn}. The level defines depth and reporting, not the commercial plan.`}</p></div>
}
