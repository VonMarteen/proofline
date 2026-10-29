import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";
import { controlIdentity } from "../../../../../lib/session";
import { PageIntro, Panel, Status, dateTime } from "../../../../../components/control-ui";
import { publishLegalDocumentVersion } from "../../../../actions";

export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const [d,identity]=await Promise.all([controlGet(`/v1/control/legal/versions/${encodeURIComponent(id)}`),controlIdentity()]);
 const v=d.version,canPublish=identity.role==="INTERNAL_PLATFORM_OWNER"&&!v.active;
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/legal`}>{es?"← Volver a Legal & Trust":"← Back to Legal & Trust"}</Link></div>
  <PageIntro title={v.title} text={`${d.document.description} · ${v.locale.toUpperCase()} · ${v.version}`}/>
  <Panel title={es?"Documento y estado":"Document and state"}>
    <div className="control-framework-detail-grid"><div><strong>{es?"Estado":"Status"}</strong><Status value={v.active?"ACTIVE":"DRAFT"}/></div><div><strong>{es?"Publicado":"Published"}</strong><span>{dateTime(v.effectiveAt,locale)}</span></div><div><strong>SHA-256</strong><span><code>{v.contentHash}</code></span></div><div><strong>{es?"Integridad de contenido":"Content integrity"}</strong><span>{d.hashVerified?es?"Verificada con SHA-256":"SHA-256 verified":es?"Error de integridad: no publicar":"Integrity error: do not publish"}</span></div></div>
    <h3 className="control-version-content-title">{es?"Contenido íntegro":"Full text"}</h3>
    <pre className="control-legal-text control-legal-detail-content">{v.content}</pre>
  </Panel>
  {canPublish&&d.hashVerified?<Panel title={es?"Publicación controlada":"Controlled publication"}>
    <p className="control-note">{es?"Se publicará esta versión para el mismo documento e idioma, desactivando únicamente la versión anterior. Se exige un motivo y quedará auditado. No existe una aprobación independiente en este flujo.":"This publishes the version for this document and locale, superseding the previous one. A reason is mandatory and the action is audited. This workflow has no independent approval step."}</p>
    <form action={publishLegalDocumentVersion} className="control-version-publish" data-confirm-title={es?"Publicar versión legal":"Publish legal version"} data-confirm-message={es?"Se sustituirá la versión actualmente vigente para este documento e idioma. Comprueba antes el contenido y el hash.":"The current effective version for this document and locale will be superseded. Review its content and hash first."}>
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="versionId" value={v.id}/>
      <label>{es?"Motivo verificable":"Auditable reason"}<textarea className="control-textarea" name="reason" minLength={12} maxLength={500} required/></label>
      <button className="control-button" type="submit">{es?"Publicar esta versión":"Publish this version"}</button>
    </form>
   </Panel>:null}
  <Panel title={es?"Historial de evidencias":"Evidence history"}>
    {d.events.length?<div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Acción":"Action"}</th><th>{es?"Responsable":"Actor"}</th><th>{es?"Fecha":"Date"}</th></tr></thead><tbody>{d.events.map((e:any)=><tr key={e.id}><td>{e.action}</td><td>{e.actorId}</td><td>{dateTime(e.createdAt,locale)}</td></tr>)}</tbody></table></div>:<p className="control-empty">{es?"Sin eventos de publicación para esta versión.":"No publication events for this version."}</p>}
  </Panel>
 </div>;
}
