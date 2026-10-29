import Link from "next/link";
import { Fragment } from "react";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../components/control-ui";
import { RecordsTable } from "../../../components/records-table";

export default async function Page({params}:{params:Promise<{locale:string}>}) {
  const {locale:raw}=await params,locale=normalizeLocale(raw),es=locale==="es";
  const d=await controlGet("/v1/control/communications");
  return <div className="control-stack">
    <PageIntro title={es?"Comunicaciones":"Communications"} text={es?"Distribución de informes y eventos de salida. Nunca se muestra un token completo de participante.":"Report distribution and outbound events. Full participant tokens are never displayed."}/>
    <div className="control-communications-grid control-align-start">
      <Panel title={es?"Entregas de informes":"Report deliveries"}>
        <RecordsTable locale={locale} columns={[es?"Informe":"Report",es?"Destinatario":"Recipient",es?"Estado":"Status",es?"Fecha":"Date",es?"Detalle":"Detail"]} records={d.deliveries.map((x:any)=>({id:x.id,search:[x.report.assessment.title,x.report.assessment.organization.name,x.recipient.displayName,x.status].join(" "),status:x.status,cells:[<Fragment key="report"><strong key="report">{x.report.assessment.title}</strong><span key="org" className="control-cell-secondary">{x.report.assessment.organization.name}</span></Fragment>,x.recipient.displayName,<Status key="status" value={x.status}/>,dateTime(x.sentAt??x.createdAt,locale),<Link key="detail" className="control-link-strong" href={`/${locale}/communications/deliveries/${encodeURIComponent(x.id)}`}>{es?"Ver entrega":"View delivery"}</Link>]}))} limitedNote={es?"Resultados de las entregas cargadas, no del histórico completo.":"Results from loaded deliveries, not the full history."}/>
      </Panel>
      <Panel title="Outbox"><RecordsTable locale={locale} columns={[es?"Tipo":"Type",es?"Plantilla":"Template",es?"Estado":"Status",es?"Fecha":"Date",es?"Detalle":"Detail"]} records={d.outbox.map((x:any)=>{const p=(x.payload??{}) as any,r=(x.result??{}) as any,category=p.category??r.category??"email",templateId=p.templateId??r.templateId,templateVersion=p.templateVersion??r.templateVersion;return {id:x.id,search:[category,templateId,x.type,x.status].filter(Boolean).join(" "),status:x.status,cells:[<strong key="category">{category}</strong>,templateId?`${templateId} · v${templateVersion??"?"}`:x.type,<Status key="status" value={x.status}/>,dateTime(x.createdAt,locale),<Link key="detail" className="control-link-strong" href={`/${locale}/communications/outbox/${encodeURIComponent(x.id)}`}>{es?"Ver evento":"View event"}</Link>]};})} limitedNote={es?"Consulta sobre los eventos cargados del Outbox.":"Filters the loaded Outbox events."}/></Panel>
    </div>
  </div>;
}
