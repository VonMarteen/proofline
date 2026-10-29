import Link from "next/link";
import { Fragment } from "react";
import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { Metric, PageIntro, Panel, Status, date, dateTime } from "../../../components/control-ui";
import { createLegalHold, executeRetentionLifecycle, releaseLegalHold, updateRetentionPolicy, createLegalDocumentDraft, publishLegalDocumentVersion } from "../../actions";
import { controlIdentity } from "../../../lib/session";
import { RecordsTable } from "../../../components/records-table";

const retentionActions = ["DELETE", "ANONYMIZE", "BLOCK", "RETAIN"];
const holdScopes = ["ALL", "ASSESSMENT", "PARTICIPANT_IDENTITY", "RAW_RESPONSE", "PSEUDONYMIZED_DATASET", "APPROVED_REPORT", "ACCOUNTING_INVOICE"];

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ evidencePage?:string; evidencePageSize?:string; evidenceQ?:string; evidenceAction?:string; retentionOrganization?:string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  const es = locale === "es";
  const sp=await searchParams;
  const retentionOrganization = sp.retentionOrganization?.trim() ?? "";
  const evidenceQuery=new URLSearchParams({page:sp.evidencePage??"1",pageSize:sp.evidencePageSize??"25",...(sp.evidenceQ?{q:sp.evidenceQ}:{}),...(sp.evidenceAction?{action:sp.evidenceAction}:{})});
  const [d, lifecycle, organizationPage, evidence] = await Promise.all([
    controlGet("/v1/control/legal?view=ui"),
    controlGet(`/v1/control/retention/preview?limit=50${retentionOrganization ? `&organizationId=${encodeURIComponent(retentionOrganization)}` : ""}`),
    controlGet("/v1/control/tables/organizations?page=1&pageSize=100"),
    controlGet(`/v1/control/tables/legal/interactions?${evidenceQuery}`),
  ]);
  const identity=await controlIdentity();
  const canPublish=identity.role==="INTERNAL_PLATFORM_OWNER";
  const canDraft=canPublish||identity.role==="INTERNAL_TRUST";
  const organizations = organizationPage.items ?? [];
  const approved = d.profiles.filter((p: any) => p.approvedAt).length;
  const eligible = Number(lifecycle?.summary?.eligible ?? 0);
  const held = Number(lifecycle?.summary?.held ?? 0);
  const candidates = Array.isArray(lifecycle?.candidates) ? lifecycle.candidates : [];
  const completePreview = lifecycle?.coverage?.complete === true;

  return <div className="control-stack">
    <PageIntro title="Legal & Trust" text={es ? "Versiones legales, retención verificable, legal holds y evidencias de interacción." : "Legal versions, verifiable retention, legal holds and interaction evidence."}/>

    <div className="control-metrics control-metrics-3">
      <Metric label={es ? "Políticas de retención" : "Retention policies"} value={d.retentionPolicies.length}/>
      <Metric label={es ? "Vencidos detectados en vista previa" : "Eligible in preview"} value={eligible} note={held ? `${held} ${es ? "protegidos por hold" : "protected by hold"}` : undefined}/>
      <Metric label={es ? "Perfiles aprobados" : "Approved profiles"} value={`${approved}/${d.profiles.length}`}/>
    </div>

    <Panel title={es ? "Lifecycle de datos · dry run" : "Data lifecycle · dry run"} action={eligible && completePreview && retentionOrganization ? <form action={executeRetentionLifecycle} data-confirm-title={es ? "Ejecutar retención" : "Execute retention"} data-confirm-message={es ? `Se aplicarán acciones irreversibles sobre ${eligible} registros vencidos elegibles. Los registros bajo legal hold no se tocarán.` : `Irreversible lifecycle actions will be applied to ${eligible} eligible due records. Records under legal hold will not be touched.`} data-confirm-label={es ? "Ejecutar retención" : "Execute retention"} data-confirm-tone="danger"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="organizationId" value={retentionOrganization}/><button className="control-button danger" type="submit">{es ? "Ejecutar vencidos" : "Execute due records"}</button></form> : undefined}>
      <p className="control-note">{es ? "La tabla es una simulación de solo lectura. DELETE/ANONYMIZE/BLOCK sólo se aplican al confirmar. RETAIN nunca destruye datos. Los legal holds tienen prioridad sobre cualquier política." : "The table is a read-only dry run. DELETE/ANONYMIZE/BLOCK are only applied after confirmation. RETAIN never destroys data. Legal holds override all policies."}</p>
      <form className="bo-filter-form" method="get" data-proofline-no-confirm="true">
        <label htmlFor="retention-org">{es ? "Alcance de la vista previa" : "Preview scope"}</label>
        <select id="retention-org" className="control-select" name="retentionOrganization" defaultValue={retentionOrganization}>
          <option value="">{es ? "Todas las organizaciones (solo lectura)" : "All organizations (read only)"}</option>
          {organizations.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="control-button small" type="submit">{es ? "Consultar" : "Preview"}</button>
      </form>
      <p role="status" className="control-note">{completePreview
        ? (es ? "Vista previa completa para el alcance consultado. Solo se permite ejecutar por organización; el servidor vuelve a validar los legal holds." : "Preview complete for the selected scope. Execution requires an organization and rechecks legal holds on the server.")
        : (es ? "Vista previa PARCIAL: los recuentos solo incluyen registros explorados, no el histórico completo. Por seguridad, no se permite ejecutar hasta obtener cobertura completa seleccionando una organización." : "PARTIAL preview: counts reflect scanned records only, not the complete history. Execution is disabled until the selected organization returns a complete preview.")}</p>
      <div className="control-retention-summary">
        <span>{es ? "Generado" : "Generated"}: {dateTime(lifecycle.generatedAt, locale)}</span>
        <span>{es ? "Vencidos" : "Due"}: <strong>{lifecycle.summary.due}</strong></span>
        <span>{es ? "Elegibles" : "Eligible"}: <strong>{eligible}</strong></span>
        <span>HOLD: <strong>{held}</strong></span>
        <span>{es ? "Sin acción" : "No action"}: <strong>{lifecycle.summary.noAction}</strong></span>
      </div>
      <RecordsTable locale={locale} columns={[es?"Organización":"Organization",es?"Clase":"Class",es?"Objeto":"Target",es?"Vencimiento":"Due",es?"Acción":"Action",es?"Estado":"State",es?"Base / protección":"Basis / protection"]} records={candidates.map((c:any)=>({id:c.key,search:[c.organizationName,c.assessmentTitle,c.recordClass,c.targetType,c.action,c.state,c.legalBasis].filter(Boolean).join(" "),status:c.state,tone:c.state==="HELD"?"control-row-held":c.state==="ELIGIBLE"&&["DELETE","ANONYMIZE"].includes(c.action)?"control-row-danger":undefined,cells:[<Fragment key="org"><strong key="org">{c.organizationName}</strong><span key="asmt" className="control-cell-secondary">{c.assessmentTitle??"—"}</span></Fragment>,c.recordClass,<Fragment key="target">{c.targetType}<span key="target" className="control-cell-secondary">{String(c.targetId).slice(0,10)}…</span></Fragment>,date(c.dueAt,locale),<Status key="action" value={c.action}/>,<Status key="state" value={c.state}/>,c.hold?<Fragment key="hold"><strong key="hold">{c.hold.scope}</strong><span key="reason" className="control-cell-secondary">{c.hold.reason}</span></Fragment>:c.legalBasis]}))} limitedNote={es?"Vista previa de hasta 50 candidatos. No representa todo el histórico salvo que la cobertura indique completa.":"Preview of up to 50 candidates. This is not the full history unless coverage is complete."}/>
    </Panel>

    <div className="control-grid-2">
      <Panel title={es ? "Políticas de conservación" : "Retention policies"}>
        <div className="control-retention-policy-list">{d.retentionPolicies.map((p: any) => <form key={p.id} className="control-retention-policy" action={updateRetentionPolicy} data-confirm-title={es ? "Actualizar política" : "Update policy"} data-confirm-message={es ? `Se actualizará ${p.recordClass}. El siguiente dry run utilizará la nueva política.` : `${p.recordClass} will be updated. The next dry run will use the new policy.`}>
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={p.id}/>
          <div><strong>{p.recordClass}</strong><span>{p.organization?.name ?? p.organizationId}{p.assessment?.title ? ` · ${p.assessment.title}` : ""}</span>{p.locked ? <small>{es ? "Política bloqueada" : "Locked policy"}</small> : null}</div>
          <label><span>{es ? "Días" : "Days"}</span><input className="control-input" name="durationDays" type="number" min="1" max="3650" defaultValue={p.durationDays} disabled={p.locked}/></label>
          <label><span>{es ? "Acción" : "Action"}</span><select className="control-select" name="action" defaultValue={p.action} disabled={p.locked}>{retentionActions.map(a => <option key={a}>{a}</option>)}</select></label>
          <label className="control-retention-basis"><span>{es ? "Base" : "Basis"}</span><input className="control-input" name="legalBasis" defaultValue={p.legalBasis} disabled={p.locked}/></label>
          {!p.locked ? <button className="control-button secondary" type="submit">{es ? "Guardar" : "Save"}</button> : <Status value="LOCKED"/>}
        </form>)}</div>
      </Panel>

      <Panel title="Legal holds">
        <form className="control-hold-form" action={createLegalHold} data-confirm-title={es ? "Crear legal hold" : "Create legal hold"} data-confirm-message={es ? "El hold bloqueará cualquier acción de retención que coincida con su alcance hasta que se libere explícitamente." : "The hold will block matching retention actions until it is explicitly released."}>
          <input type="hidden" name="locale" value={locale}/>
          <label><span>{es ? "Organización" : "Organization"}</span><select className="control-select" name="organizationId" required>{organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label><span>{es ? "Assessment ID (opcional)" : "Assessment ID (optional)"}</span><input className="control-input" name="assessmentId" placeholder="cuid…"/></label>
          <label><span>{es ? "Alcance" : "Scope"}</span><select className="control-select" name="scope" defaultValue="ALL">{holdScopes.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="control-hold-reason"><span>{es ? "Motivo" : "Reason"}</span><input className="control-input" name="reason" minLength={5} required placeholder={es ? "Obligación, investigación, disputa…" : "Obligation, investigation, dispute…"}/></label>
          <button className="control-button" type="submit">{es ? "Crear hold" : "Create hold"}</button>
        </form>
        <div className="control-list">{d.legalHolds.length ? d.legalHolds.map((h: any) => <div key={h.id}><div><strong>{h.organization.name}</strong><span>{h.scope}{h.assessment?.title ? ` · ${h.assessment.title}` : ""}</span><small>{h.reason}</small></div><div className="control-compact-actions"><Status value={h.status}/>{h.status === "ACTIVE" ? <form action={releaseLegalHold} data-confirm-title={es ? "Liberar legal hold" : "Release legal hold"} data-confirm-message={es ? "Al liberar el hold, los registros vencidos volverán a ser elegibles para retención." : "After release, due records become eligible for retention again."} data-confirm-tone="danger"><input type="hidden" name="id" value={h.id}/><input type="hidden" name="locale" value={locale}/><button className="control-button secondary small" type="submit">{es ? "Liberar" : "Release"}</button></form> : null}</div></div>) : <p className="control-empty">{es ? "No hay legal holds." : "No legal holds."}</p>}</div>
      </Panel>
    </div>

    <div className="control-grid-2 control-legal-compliance-layout"><Panel title={es ? "Registro legal y publicación controlada" : "Legal registry and controlled publication"}>
      <p className="control-note">{es?"Flujo: crear borrador → abrir y leer contenido → publicar mediante Owner. La publicación actual no incorpora un estado de aprobación independiente. Publicar exige autorización Owner, un motivo verificable y conserva la evidencia SHA-256 de la versión. Una versión publicada reemplaza únicamente a la anterior del mismo documento e idioma.":"Workflow: create draft → open and read content → publish as Owner. Publication does not yet include an independent approval state. Publication requires Owner authorization, a documented reason and SHA-256 evidence. A published version replaces the previous one only for the same document and locale."}</p>
      <div className="control-legal-documents">{d.legalDocuments.map((doc:any)=><section key={doc.id} className="control-legal-document"><div><strong>{doc.description}</strong><span className="control-cell-secondary">{doc.key} · {doc.scope}</span></div>
        <div className="control-table-wrap"><table className="control-table"><thead><tr><th>{es?"Versión":"Version"}</th><th>{es?"Idioma":"Locale"}</th><th>{es?"Estado":"Status"}</th><th>SHA-256</th><th>{es?"Vigente desde":"Effective since"}</th><th>{es?"Acción":"Action"}</th></tr></thead><tbody>{doc.versions.map((v:any)=><tr key={v.id}><td><strong>{v.version}</strong><span className="control-cell-secondary">{v.title}</span><Link className="control-link-strong control-version-link" href={`/${locale}/legal/versions/${encodeURIComponent(v.id)}`}>{es?"Abrir y revisar":"Open and review"}</Link></td><td>{v.locale.toUpperCase()}</td><td><Status value={v.active?"ACTIVE":"DRAFT"}/></td><td><code title={v.contentHash}>{String(v.contentHash).slice(0,16)}…</code></td><td>{v.active?dateTime(v.effectiveAt,locale):"—"}</td><td>{!v.active&&canPublish?<form action={publishLegalDocumentVersion} data-confirm-title={es?"Publicar versión legal":"Publish legal version"} data-confirm-message={es?"La versión actual dejará de estar publicada para este documento e idioma. Esta operación se auditará.":"The current version will be unpublished for this document and locale. The operation is audited."}><input type="hidden" name="versionId" value={v.id}/><input type="hidden" name="locale" value={locale}/><label className="control-sr-only" htmlFor={`publish-${v.id}`}>{es?"Motivo de publicación":"Publication reason"}</label><input id={`publish-${v.id}`} className="control-input" name="reason" minLength={12} maxLength={500} required placeholder={es?"Motivo (mín. 12 caracteres)":"Reason (min. 12 characters)"}/><button className="control-button small" type="submit">{es?"Publicar":"Publish"}</button></form>:<span>—</span>}</td></tr>)}</tbody></table></div>
        {canDraft?<details className="control-legal-draft"><summary>{es?"Crear versión como borrador":"Create draft version"}</summary><form action={createLegalDocumentDraft} className="control-legal-draft-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="documentId" value={doc.id}/><label>{es?"Versión":"Version"}<input className="control-input" name="version" maxLength={40} required placeholder="v2.1"/></label><label>{es?"Idioma":"Locale"}<select className="control-select" name="documentLocale" defaultValue={locale}><option value="es">Español</option><option value="en">English</option></select></label><label>{es?"Título":"Title"}<input className="control-input" name="title" minLength={5} maxLength={180} required/></label><label className="control-legal-content">{es?"Contenido legal":"Legal content"}<textarea className="control-input" name="content" minLength={30} maxLength={100000} rows={7} required/></label><button className="control-button" type="submit">{es?"Guardar borrador":"Save draft"}</button></form></details>:null}
      </section>)}</div>
    </Panel><Panel className="control-legal-profiles" title={es ? "Perfiles de assessment" : "Assessment legal profiles"}><div className="control-list">{d.profiles.map((p: any) => <div key={p.id}><div><strong>{p.assessment.title}</strong><span>{p.assessment.organization.name} · {p.legalBasis}</span></div>{p.approvedAt ? <span className="control-ok">{es ? "Aprobado" : "Approved"}</span> : <span className="control-risk">{es ? "Pendiente" : "Pending"}</span>}</div>)}</div></Panel></div>
    <Panel title={es ? "Evidencias legales" : "Legal evidence"}>
      <form className="bo-filter-form control-uxa3-filters" method="get" role="search" data-proofline-no-confirm="true">
        <input type="search" name="evidenceQ" maxLength={100} aria-label={es?"Buscar evidencias":"Search evidence"} defaultValue={sp.evidenceQ??""} placeholder={es?"Documento, actor o idioma":"Document, actor or locale"}/>
        <select name="evidenceAction" defaultValue={sp.evidenceAction??""} aria-label={es?"Acción":"Action"}><option value="">{es?"Todas las acciones":"All actions"}</option>{["ACCEPT","ACKNOWLEDGE","CONSENT","EXPLICIT_CONSENT","REJECT","WITHDRAW"].map(x=><option key={x} value={x}>{x}</option>)}</select>
        <input type="hidden" name="evidencePage" value="1"/><input type="hidden" name="evidencePageSize" value={evidence.pagination.pageSize}/>
        <button type="submit">{es?"Filtrar":"Filter"}</button><a className="control-button secondary" href={`/${locale}/legal`}>{es?"Limpiar":"Clear"}</a>
      </form>
      <div className="control-table-wrap"><table className="control-table"><thead><tr>{[es?"Documento":"Document",es?"Actor":"Actor",es?"Acción":"Action",es?"Idioma":"Locale",es?"Fecha":"Date"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
        {evidence.items.map((x:any)=><tr key={x.id}><td>{x.documentVersion.document.description}</td><td>{x.actorType}</td><td><Status value={x.action}/></td><td>{x.locale}</td><td>{date(x.createdAt,locale)}</td></tr>)}
        {!evidence.items.length?<tr><td colSpan={5} className="control-table-empty">{es?"Sin evidencias para los filtros.":"No evidence matches the filters."}</td></tr>:null}
      </tbody></table><PaginationBar pagination={evidence.pagination} basePath={`/${locale}/legal`} pageParam="evidencePage" pageSizeParam="evidencePageSize" query={{evidenceQ:sp.evidenceQ,evidenceAction:sp.evidenceAction}} locale={locale}/></div>
    </Panel>
  </div>;
}
