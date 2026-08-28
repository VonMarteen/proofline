import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { decryptBytes, encryptBytes } from "../security/crypto.js";

export type ImportQuestionProposal = {
  prompt: string;
  type: string;
  dimension: string | null;
  required: boolean;
  weight: number;
  config: Record<string, unknown> | null;
  confidence: number;
  source: "detected" | "suggested";
};
export type ImportAnalysis = {
  classification: "QUESTIONNAIRE" | "CONTEXT_DOCUMENT" | "MIXED" | "UNKNOWN";
  confidence: number;
  detectedLanguage: "es" | "en" | "unknown";
  title: string;
  objective: string;
  dimensions: string[];
  questions: ImportQuestionProposal[];
  issues: Array<{ severity: "info" | "warning" | "critical"; kind: string; message: string; questionIndex?: number }>;
  estimatedMinutes: number;
  frameworkMatches: Array<{ id: string; name: string; score: number; reason: string }>;
  engine: { name: string; aiUsed: boolean; model?: string };
};

const STOP = new Set(["para","como","desde","sobre","entre","esta","este","esto","that","with","from","this","what","when","where","have","para","una","uno","unos","unas","the","and","los","las","del","que","por","con","sin","sus","son"]);
const DIMENSIONS: Array<[string,string[]]> = [
  ["Liderazgo",["liderazgo","líder","leader","manager","responsable","dirección"]],
  ["Comunicación",["comunicación","comunica","información","claridad","communication","inform"]],
  ["Confianza",["confianza","trust","seguridad psicológica","speak up"]],
  ["Reconocimiento",["reconocimiento","recognition","feedback"]],
  ["Carga y bienestar",["carga","workload","bienestar","wellbeing","estrés","stress"]],
  ["Cambio",["cambio","transformación","adopción","change","transformation","adoption"]],
  ["Colaboración",["colaboración","coordinación","equipo","collaboration","team"]],
  ["Estrategia",["estrategia","prioridades","objetivos","strategy","priorities","goals"]],
  ["Experiencia",["experiencia","experience","onboarding","cliente","customer"]],
  ["Procesos",["proceso","fricción","herramienta","process","friction","tool"]],
];

function normalize(s:string){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function tokens(s:string){return normalize(s).split(/[^a-z0-9]+/).filter(x=>x.length>2&&!STOP.has(x));}
function titleFrom(fileName:string,text:string){
  const first=text.split(/\r?\n/).map(x=>x.trim()).find(x=>x.length>=4&&x.length<=100&&!/[?.]$/.test(x));
  return first??fileName.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");
}
function language(text:string):"es"|"en"|"unknown"{const s=` ${normalize(text)} `;const es=[" que "," para "," como "," empresa "," equipo "," trabajo "," cual "].filter(x=>s.includes(x)).length;const en=[" the "," and "," with "," team "," work "," which "," organization "].filter(x=>s.includes(x)).length;return es===en?"unknown":es>en?"es":"en"}
function dimensionFor(prompt:string){const n=normalize(prompt);let best:string|null=null,score=0;for(const [d,words] of DIMENSIONS){const s=words.filter(w=>n.includes(normalize(w))).length;if(s>score){score=s;best=d}}return best;}
function inferType(line:string){const n=normalize(line),upper=line.toUpperCase();if(upper.includes("CHECKBOX"))return{type:"CHECKBOX",config:{options:[],minSelections:0}};if(upper.includes("MULTI"))return{type:"MULTI",config:{options:[]}};if(upper.includes("SINGLE")||upper.includes("RADIO"))return{type:"SINGLE",config:{options:[]}};if(upper.includes("LONG_TEXT"))return{type:"LONG_TEXT",config:{maxLength:1200}};if(upper.includes("SHORT_TEXT"))return{type:"SHORT_TEXT",config:{maxLength:500}};if(upper.includes("LIKERT"))return{type:"LIKERT",config:{min:1,max:5,minLabel:"Nada de acuerdo",maxLabel:"Totalmente de acuerdo"}};if(upper.includes("PERCENTAGE"))return{type:"PERCENTAGE",config:{min:0,max:100,step:1,unit:"%"}};if(upper.includes("RANKING"))return{type:"RANKING",config:{options:[]}};if(upper.includes("ALLOCATION"))return{type:"ALLOCATION",config:{options:[],total:100}};if(upper.includes("MATRIX"))return{type:"MATRIX",config:{rows:[],columns:[]}};if(upper.includes("DUAL"))return{type:"DUAL",config:{min:1,max:5,leftLabel:"Importancia",rightLabel:"Situación actual"}};if(upper.includes("YES_NO"))return{type:"YES_NO",config:{allowNA:false}};if(upper.includes("NUMERIC"))return{type:"NUMERIC",config:{min:0,max:100,step:1}};if(/\b0\s*(?:a|-)\s*10\b/.test(n)||n.includes("0-10"))return {type:"NPS",config:{min:0,max:10,minLabel:"Nada probable",maxLabel:"Totalmente probable"}};if(n.includes("porcentaje")||n.includes("%"))return {type:"PERCENTAGE",config:{min:0,max:100,step:1,unit:"%"}};if(n.includes("ordena")||n.includes("ranking"))return {type:"RANKING",config:{options:[]}};if(n.includes("distribuye")&&n.includes("100"))return {type:"ALLOCATION",config:{options:[],total:100}};if(n.includes("selecciona todas")||n.includes("marca todas")||n.includes("varias opciones"))return {type:"CHECKBOX",config:{options:[],minSelections:0}};if(n.includes("si/no")||n.includes("sí/no")||n.includes("yes/no"))return {type:"YES_NO",config:{allowNA:false}};if(n.includes("escala")||n.includes("acuerdo")||n.includes("agree"))return {type:"LIKERT",config:{min:1,max:5,minLabel:"Nada de acuerdo",maxLabel:"Totalmente de acuerdo"}};if(line.trim().endsWith("?"))return {type:"SHORT_TEXT",config:{maxLength:500}};return {type:"LIKERT",config:{min:1,max:5,minLabel:"Nada de acuerdo",maxLabel:"Totalmente de acuerdo"}};}
function lineQuestions(text:string){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const out:Array<{prompt:string;raw:string;dimension:string|null}>=[];
  for(const raw of lines){const clean=raw.replace(/^\s*(?:[-*•]|\d+[.)-])\s*/,"").trim();if(clean.length<8||clean.length>700)continue;const cells=clean.includes("\t")?clean.split("\t").map(x=>x.trim()).filter(Boolean):clean.split(/\s*[;|]\s*/).map(x=>x.trim()).filter(Boolean);let prompt=cells.find(c=>c.endsWith("?")||/^(¿|how |what |which |do |does |is |are |can |could |rate |indica |valora |evalua |evalúa |selecciona |marca |ordena |distribuye )/i.test(c)||/\b(de acuerdo|agree|valora|evalua|evalúa)\b/i.test(c));if(!prompt&&cells.length>1&&cells[0]!.length>=8&&cells[0]!.length<500)prompt=cells[0];if(!prompt)continue;const dimension=cells.slice(1).find(c=>/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ /&-]{2,60}$/.test(c)&&!TYPES_FOR_IMPORT.has(c.toUpperCase()))??null;out.push({prompt,raw:clean,dimension});}
  const seen=new Set<string>();return out.filter(x=>{const k=normalize(x.prompt);if(seen.has(k))return false;seen.add(k);return true}).slice(0,100);
}
const TYPES_FOR_IMPORT=new Set(["SINGLE","MULTI","CHECKBOX","YES_NO","LIKERT","NPS","NUMERIC","RANGE","PERCENTAGE","SLIDER","MATRIX","DUAL","RANKING","ALLOCATION","SHORT_TEXT","LONG_TEXT","INFO"]);
function contextQuestions(text:string,lang:"es"|"en"|"unknown"){
  const n=normalize(text);const dims=DIMENSIONS.filter(([,words])=>words.some(w=>n.includes(normalize(w)))).map(([d])=>d).slice(0,6);
  const chosen=dims.length?dims:["Claridad","Confianza","Capacidad","Coordinación"];
  return chosen.flatMap((d,i)=>{
    const es=lang!=="en";
    return [
      {prompt:es?`La situación actual en ${d.toLowerCase()} permite avanzar con claridad y eficacia.`:`The current situation in ${d.toLowerCase()} supports clear and effective progress.`,type:"LIKERT",dimension:d,required:true,weight:1,config:{min:1,max:5,minLabel:es?"Nada de acuerdo":"Strongly disagree",maxLabel:es?"Totalmente de acuerdo":"Strongly agree"},confidence:68,source:"suggested" as const},
      ...(i===0?[{prompt:es?`¿Qué aspecto relacionado con ${d.toLowerCase()} debería recibir atención prioritaria y por qué?`:`What related to ${d.toLowerCase()} should receive priority attention, and why?`,type:"LONG_TEXT",dimension:d,required:false,weight:1,config:{maxLength:1200},confidence:62,source:"suggested" as const}]:[]),
    ];
  }).slice(0,14);
}
function redundancyIssues(qs:ImportQuestionProposal[]){const issues:ImportAnalysis["issues"]=[];for(let i=0;i<qs.length;i++)for(let j=i+1;j<qs.length;j++){const a=new Set(tokens(qs[i]!.prompt)),b=new Set(tokens(qs[j]!.prompt));const overlap=[...a].filter(x=>b.has(x)).length/Math.max(1,Math.min(a.size,b.size));if(overlap>=0.72)issues.push({severity:"warning",kind:"possible_redundancy",message:`Las preguntas ${i+1} y ${j+1} parecen medir prácticamente lo mismo.`,questionIndex:j})}return issues.slice(0,8)}
function sensitiveIssues(qs:ImportQuestionProposal[]){const sensitive=["salud","diagnostico","diagnóstico","religion","religión","sindicato","union membership","orientacion sexual","orientación sexual","etnia","ethnicity","politica","política"];const issues:ImportAnalysis["issues"]=[];qs.forEach((q,i)=>{if(sensitive.some(x=>normalize(q.prompt).includes(normalize(x))))issues.push({severity:"critical",kind:"sensitive_data",message:`La pregunta ${i+1} podría implicar categorías de datos especialmente protegidas. Requiere revisión de necesidad, base jurídica y minimización.`,questionIndex:i})});return issues}

@Injectable()
export class ImportService {
  constructor(@Inject(PrismaService) private readonly db:PrismaService){}

  private async frameworkMatches(text:string){const wanted=new Set(tokens(text));const rows=await this.db.framework.findMany({include:{versions:{take:1,orderBy:{publishedAt:"desc"}}}});return rows.map(f=>{const v=f.versions[0];const hay=tokens(`${f.name} ${f.description} ${f.category} ${JSON.stringify(f.tags??[])} ${v?.objective??""}`);const overlap=hay.filter(t=>wanted.has(t)).length;return{id:f.id,name:f.name,score:Math.min(99,Math.round(overlap/Math.max(1,Math.min(10,wanted.size))*100)),reason:overlap?"Comparte temas y vocabulario con el documento.":"Puede aportar una perspectiva complementaria."}}).sort((a,b)=>b.score-a.score).slice(0,5)}

  private async heuristic(fileName:string,text:string):Promise<ImportAnalysis>{
    const lang=language(text),detected=lineQuestions(text);const classification=detected.length>=5?"QUESTIONNAIRE":detected.length>=2?"MIXED":text.trim().length>120?"CONTEXT_DOCUMENT":"UNKNOWN";
    const qs:ImportQuestionProposal[]=detected.length>=2?detected.map(item=>{const inferred=inferType(item.raw);return{prompt:item.prompt,type:inferred.type,dimension:item.dimension??dimensionFor(item.prompt),required:true,weight:1,config:inferred.config,confidence:classification==="QUESTIONNAIRE"?91:78,source:"detected"}}):contextQuestions(text,lang);
    const dims=[...new Set(qs.map(q=>q.dimension).filter((x):x is string=>Boolean(x)))];
    const objective=(lang==="en"?"Understand the main organizational signals contained in the source document and convert them into evidence that supports a defensible decision.":"Comprender las principales señales organizacionales contenidas en el documento y convertirlas en evidencia que permita sustentar una decisión defendible.");
    const issues=[...redundancyIssues(qs),...sensitiveIssues(qs)];if(qs.length>45)issues.push({severity:"warning",kind:"respondent_burden",message:"El cuestionario detectado es largo. Conviene revisar duración, redundancia y fatiga antes de lanzarlo."});if(classification==="CONTEXT_DOCUMENT")issues.unshift({severity:"info",kind:"context_document",message:"El archivo parece material de contexto más que un cuestionario. Proofline ha propuesto preguntas a partir de los temas detectados; deben revisarse antes de crear el assessment."});
    return{classification,confidence:classification==="QUESTIONNAIRE"?92:classification==="MIXED"?80:classification==="CONTEXT_DOCUMENT"?74:45,detectedLanguage:lang,title:titleFrom(fileName,text),objective,dimensions:dims,questions:qs,issues,estimatedMinutes:Math.max(2,Math.round(qs.reduce((m,q)=>m+(q.type.includes("TEXT")?1.2:q.type==="MATRIX"?1.5:.35),0))),frameworkMatches:await this.frameworkMatches(`${text.slice(0,5000)} ${objective}`),engine:{name:"proofline-import-heuristic-v1",aiUsed:false}};
  }

  private async externalAi(fileName:string,text:string,fallback:ImportAnalysis):Promise<ImportAnalysis>{
    const endpoint=process.env.PROOFLINE_AI_IMPORT_ENDPOINT?.trim();if(!endpoint)return fallback;
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",...(process.env.PROOFLINE_AI_IMPORT_TOKEN?{"authorization":`Bearer ${process.env.PROOFLINE_AI_IMPORT_TOKEN}`}:{})},body:JSON.stringify({task:"proofline_assessment_import",fileName,text:text.slice(0,120000),fallback,contract:{classification:["QUESTIONNAIRE","CONTEXT_DOCUMENT","MIXED","UNKNOWN"],questionTypes:["SINGLE","MULTI","CHECKBOX","YES_NO","LIKERT","NPS","NUMERIC","RANGE","PERCENTAGE","SLIDER","MATRIX","DUAL","RANKING","ALLOCATION","SHORT_TEXT","LONG_TEXT","INFO"]}})});
      if(!response.ok)return fallback;const value=await response.json() as Partial<ImportAnalysis>;if(!Array.isArray(value.questions)||!value.title||!value.objective)return fallback;
      return{...fallback,...value,questions:value.questions as ImportQuestionProposal[],frameworkMatches:fallback.frameworkMatches,engine:{name:"proofline-bounded-ai-import",aiUsed:true,model:response.headers.get("x-model")??undefined}};
    }catch{return fallback}
  }

  async analyze(organizationId:string,input:{fileName:string;mimeType:string;base64:string;extractedText:string}){
    const bytes=Buffer.from(input.base64,"base64");if(bytes.byteLength===0)throw new BadRequestException("The uploaded file is empty");if(bytes.byteLength>8*1024*1024)throw new BadRequestException("Maximum import size is 8 MB");const text=input.extractedText.trim();if(text.length<20)throw new BadRequestException("Proofline could not extract enough text. Use a text-based PDF/DOCX/XLSX/CSV/TXT file or export the scanned document to text first.");
    const contentHash=createHash("sha256").update(bytes).digest("hex");
    const encrypted=encryptBytes(bytes);
    const storedBytes=new Uint8Array(encrypted.byteLength); storedBytes.set(encrypted);
    const record=await this.db.documentRecord.create({data:{organizationId,recordClass:"ASSESSMENT_SOURCE",documentType:"ASSESSMENT_IMPORT_SOURCE",title:input.fileName,fileName:input.fileName,mimeType:input.mimeType||"application/octet-stream",contentHash,immutable:true,retentionUntil:new Date(Date.now()+365*86400000),metadata:{purpose:"assessment-import",sizeBytes:bytes.byteLength,encryption:"AES-256-GCM"}}});
    await this.db.documentBlob.create({data:{documentRecordId:record.id,bytes:storedBytes}});
    const fallback=await this.heuristic(input.fileName,text);const analysis=await this.externalAi(input.fileName,text,fallback);
    const row=await this.db.assessmentImport.create({data:{organizationId,sourceRecordId:record.id,fileName:input.fileName,mimeType:input.mimeType||"application/octet-stream",status:"ANALYZED",classification:analysis.classification,extractedText:text.slice(0,250000),analysis:analysis as any,analysisEngine:analysis.engine.name,analyzedAt:new Date()}});
    return{id:row.id,sourceRecordId:record.id,...analysis};
  }

  async get(organizationId:string,id:string){const row=await this.db.assessmentImport.findFirst({where:{id,organizationId},include:{sourceRecord:true,assessment:true}});if(!row)throw new NotFoundException("Import not found");return row;}
  async source(organizationId:string,id:string){const row=await this.db.assessmentImport.findFirst({where:{id,organizationId},include:{sourceRecord:{include:{blob:true}}}});if(!row?.sourceRecord.blob)throw new NotFoundException("Import source not found");const bytes=decryptBytes(row.sourceRecord.blob.bytes);return{fileName:row.fileName,mimeType:row.mimeType,base64:bytes.toString("base64"),contentHash:row.sourceRecord.contentHash}}

  async apply(organizationId:string,id:string,actor:string,override?:{title?:string;objective?:string;questions?:ImportQuestionProposal[]}){
    const row=await this.db.assessmentImport.findFirst({where:{id,organizationId}});if(!row)throw new NotFoundException("Import not found");if(row.status==="APPLIED"&&row.assessmentId)return{ok:true,assessmentId:row.assessmentId,reused:true};const a=(row.analysis??{}) as any;const questions=(override?.questions??a.questions??[]) as ImportQuestionProposal[];if(!questions.length)throw new BadRequestException("The import proposal has no questions to apply");const title=(override?.title??a.title??row.fileName.replace(/\.[^.]+$/,"")).trim();const objective=(override?.objective??a.objective??"").trim();if(title.length<4||objective.length<12)throw new BadRequestException("Review title and objective before creating the assessment");
    const assessment=await this.db.$transaction(async tx=>{const created=await tx.assessment.create({data:{organizationId,title,objective,status:"PREPARATION",locale:a.detectedLanguage==="en"?"en":"es"}});await tx.assessmentTranslation.create({data:{assessmentId:created.id,locale:created.locale,title,objective}});for(let i=0;i<questions.length;i++){const q=questions[i]!;const createdQ=await tx.question.create({data:{assessmentId:created.id,order:i+1,prompt:q.prompt,type:q.type as any,dimension:q.dimension??null,required:q.required!==false,weight:Number(q.weight??1),config:(q.config??undefined) as any}});await tx.questionTranslation.create({data:{questionId:createdQ.id,locale:created.locale,prompt:q.prompt}})}await tx.assessmentImport.update({where:{id:row.id},data:{assessmentId:created.id,status:"APPLIED",appliedAt:new Date()}});await tx.documentRecord.update({where:{id:row.sourceRecordId},data:{assessmentId:created.id}});return created});
    return{ok:true,assessmentId:assessment.id,questionCount:questions.length,actor};
  }
}
