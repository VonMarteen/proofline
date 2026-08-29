import { normalizeLocale } from "@proofline/i18n";
import { Icon } from "@proofline/ui";

export default async function Page({params}:{params:Promise<{locale:string}>}){
  const {locale:r}=await params,l=normalizeLocale(r),es=l==="es";
  const choices=[
    {href:`/${l}/library`,icon:"library" as const,title:es?"Usar un framework":"Use a framework",text:es?"Parte de un marco de Library y adapta su composición al objetivo del estudio.":"Start from a Library framework and adapt its composition to the study objective.",action:es?"Explorar Library":"Explore Library"},
    {href:`/${l}/assessments/import`,icon:"upload" as const,title:es?"Importar y analizar":"Import and analyze",text:es?"Sube PDF, DOCX, XLSX, CSV o TXT y convierte el contenido en una estructura revisable.":"Upload PDF, DOCX, XLSX, CSV or TXT and turn the content into a reviewable structure.",action:es?"Analizar documento":"Analyze document"},
    {href:`/${l}/assessments/manual`,icon:"plus" as const,title:es?"Crear manualmente":"Build manually",text:es?"Construye el cuestionario pregunta a pregunta con los tipos de respuesta disponibles.":"Build the questionnaire question by question with the available response types.",action:es?"Abrir constructor":"Open builder"},
  ];
  return <div className="workspace-page">
    <a className="workspace-back" href={`/${l}/assessments`}>← {es?"Volver a assessments":"Back to assessments"}</a>
    <section className="workspace-page-head"><div><h1>{es?"Crear un assessment":"Create an assessment"}</h1><p>{es?"Elige el punto de partida. Los tres caminos terminan en el mismo modelo editable y revisable antes del lanzamiento.":"Choose a starting point. All three paths end in the same editable model before launch."}</p></div></section>
    <section className="assessment-entry-grid">{choices.map(choice=><a href={choice.href} key={choice.href}><div className="entry-icon"><Icon name={choice.icon} size={22}/></div><h2>{choice.title}</h2><p>{choice.text}</p><strong>{choice.action}<Icon name="arrow-right" size={15}/></strong></a>)}</section>
  </div>;
}
