import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../lib/api";
import { controlIdentity } from "../../../../lib/session";
import { PageIntro, Panel, Status, dateTime } from "../../../../components/control-ui";
import { updateFrameworkMetadata } from "../../../actions";

export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const [framework,identity]=await Promise.all([
  controlGet(`/v1/control/marketplace/${encodeURIComponent(id)}`),controlIdentity()
 ]);
 if(!framework?.id)notFound();
 const canEdit=identity.role==="INTERNAL_PLATFORM_OWNER"&&framework.origin==="PROOFLINE";
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/marketplace`}>{es?"← Volver al catálogo":"← Back to catalog"}</Link></div>
  <PageIntro title={framework.name} text={es?"Ficha del framework, versiones publicadas y uso real. Las versiones vinculadas a assessments permanecen inmutables.":"Framework record, published versions and real usage. Versions referenced by assessments remain immutable."}/>
  <Panel title={es?"Información del catálogo":"Catalog information"}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Origen":"Origin"}</strong><Status value={framework.origin}/></div>
    <div><strong>{es?"Visibilidad":"Visibility"}</strong><Status value={framework.visibility}/></div>
    <div><strong>{es?"Categoría":"Category"}</strong><span>{framework.category}</span></div>
    <div><strong>{es?"Editor":"Publisher"}</strong><span>{framework.publisher}</span></div>
    <div><strong>Slug</strong><span>{framework.slug}</span></div>
    <div><strong>{es?"Duración estimada":"Estimated duration"}</strong><span>{framework.durationMin} min</span></div>
   </div>
   <p className="control-note">{framework.description}</p>
   {canEdit?<details className="control-sales-disclosure"><summary>{es?"Editar descripción y categoría":"Edit description and category"}</summary>
     <form className="control-framework-edit" action={updateFrameworkMetadata}
      data-confirm-title={es?"Guardar cambios del catálogo":"Save catalog changes"}
      data-confirm-message={es?"Se modificará la ficha del catálogo y se registrará la operación. No cambia versiones ni puntuación.":"Catalog metadata will change and the action will be audited. Versions and scoring will not change."}>
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={framework.id}/>
      <label>{es?"Categoría":"Category"}<input className="control-input" name="category" defaultValue={framework.category} required minLength={2} maxLength={100}/></label>
      <label className="control-framework-edit-description">{es?"Descripción":"Description"}<textarea className="control-textarea" name="description" defaultValue={framework.description} required minLength={10} maxLength={3000}/></label>
      <button className="control-button" type="submit">{es?"Guardar cambios":"Save changes"}</button>
     </form>
    </details>:<p className="control-note">{es?"Solo el Owner puede modificar los metadatos de frameworks propios de Proofline. Los de terceros y sus versiones son de solo lectura.":"Only the Owner may edit Proofline-owned catalogue metadata. Third-party frameworks and published versions are read-only."}</p>}
  </Panel>
  <Panel title={es?"Versiones y uso verificado":"Versions and verified usage"}>
   <div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Versión":"Version"}</th><th>{es?"Objetivo":"Objective"}</th><th>{es?"Licencia":"License"}</th><th>{es?"Publicación":"Published"}</th><th>{es?"Assessments vinculados":"Linked assessments"}</th></tr></thead><tbody>
    {framework.versions.map((v:any)=><tr key={v.id}><td><strong>{v.version}</strong><span className="control-cell-secondary">{v.editable?es?"Editable en Workspace al crear":"Editable in Workspace when created":es?"Plantilla protegida":"Protected template"}</span></td><td>{v.objective}</td><td>{v.license}</td><td>{dateTime(v.publishedAt,locale)}</td><td><strong>{v._count.assessments}</strong>{v.assessments.length?<a className="control-link-strong" href={`#uses-${v.id}`}>{es?"Ver referencias":"See references"}</a>:null}</td></tr>)}
    {!framework.versions.length?<tr><td colSpan={5} className="control-table-empty">{es?"Este framework aún no tiene versiones.":"This framework has no versions yet."}</td></tr>:null}
   </tbody></table></div>
  </Panel>
  {framework.versions.some((v:any)=>v.assessments.length>0)?<Panel title={es?"Referencias en assessments":"Assessment references"}>
   <div className="control-framework-references">{framework.versions.filter((v:any)=>v.assessments.length>0).map((v:any)=><section id={`uses-${v.id}`} key={v.id}><h3>{es?"Versión":"Version"} {v.version} · {v._count.assessments} {es?"referencias":"references"}</h3><div className="control-list compact">{v.assessments.map((a:any)=><div key={a.id}><div><strong>{a.title}</strong><span>{a.organization.name} · {a.status}</span></div><Link className="control-link-strong" href={`/${locale}/organizations/${a.organization.id}`}>{es?"Ver organización":"View organization"}</Link></div>)}</div>{v._count.assessments>20?<p className="control-note">{es?"Mostrando 20 referencias. El contador refleja el total de la base de datos.":"Showing 20 references. The count reflects the full database total."}</p>:null}</section>)}</div>
  </Panel>:null}
 </div>;
}
