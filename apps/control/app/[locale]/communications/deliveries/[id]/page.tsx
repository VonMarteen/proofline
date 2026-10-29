import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../../../components/control-ui";

export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const d=await controlGet(`/v1/control/communications/deliveries/${encodeURIComponent(id)}`);
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link href={`/${locale}/communications`} className="control-button secondary">{es?"← Volver a Comunicaciones":"← Back to Communications"}</Link></div>
  <PageIntro title={es?"Detalle de entrega":"Delivery details"} text={es?"Datos reales de entrega, sin tokens ni información sensible del envío.":"Persisted delivery data, without delivery tokens or sensitive message content."}/>
  <Panel title={d.report.assessment.title}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Organización":"Organization"}</strong><span>{d.report.assessment.organization.name}</span></div>
    <div><strong>{es?"Destinatario":"Recipient"}</strong><span>{d.recipient.displayName}</span></div>
    <div><strong>{es?"Perfil de recepción":"Recipient role"}</strong><span>{d.recipient.roleLabel??"—"}</span></div>
    <div><strong>{es?"Estado":"Status"}</strong><Status value={d.status}/></div>
    <div><strong>{es?"Canal":"Channel"}</strong><span>{d.channel}</span></div>
    <div><strong>{es?"Creada":"Created"}</strong><span>{dateTime(d.createdAt,locale)}</span></div>
    <div><strong>{es?"Enviada":"Sent"}</strong><span>{d.sentAt?dateTime(d.sentAt,locale):"—"}</span></div>
    <div><strong>{es?"Error registrado":"Error recorded"}</strong><span>{d.errorRecorded?(es?"Sí":"Yes"):(es?"No":"No")}</span></div>
    <div><strong>{es?"Versión de informe":"Report version"}</strong><span>{String(d.report.version??"—")}</span></div>
    <div><strong>ID</strong><span>{d.id}</span></div>
   </div>
   <p className="control-note">{es?"Enviado no garantiza recepción. Esta vista no modifica el estado ni reenvía mensajes; esos procesos requieren evidencia técnica propia.":"Sent does not guarantee delivery. This page does not change status or resend messages; such operations require separate technical evidence."}</p>
  </Panel>
 </div>;
}
