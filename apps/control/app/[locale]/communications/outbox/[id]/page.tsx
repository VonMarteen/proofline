import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";
import { PageIntro, Panel, Status, dateTime } from "../../../../../components/control-ui";

export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const d=await controlGet(`/v1/control/communications/outbox/${encodeURIComponent(id)}`);
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link href={`/${locale}/communications`} className="control-button secondary">{es?"← Volver a Comunicaciones":"← Back to Communications"}</Link></div>
  <PageIntro title={es?"Evento de salida":"Outbound event"} text={es?"Estado e intentos registrados en la cola. Sin credenciales, payloads ni contenido de OTP.":"Recorded queue state and attempts. Credentials, raw payloads and OTP content are hidden."}/>
  <Panel title={d.category??d.type}>
   <div className="control-framework-detail-grid">
    <div><strong>{es?"Estado":"Status"}</strong><Status value={d.status}/></div>
    <div><strong>{es?"Tipo":"Type"}</strong><span>{d.type}</span></div>
    <div><strong>{es?"Intentos":"Attempts"}</strong><span>{d.attempts}</span></div>
    <div><strong>{es?"Plantilla":"Template"}</strong><span>{d.templateId?`${d.templateId} · v${d.templateVersion??"?"}`:"—"}</span></div>
    <div><strong>{es?"Creado":"Created"}</strong><span>{dateTime(d.createdAt,locale)}</span></div>
    <div><strong>{es?"Última actualización":"Updated"}</strong><span>{dateTime(d.updatedAt,locale)}</span></div>
    <div><strong>{es?"Disponible desde":"Available since"}</strong><span>{dateTime(d.availableAt,locale)}</span></div>
    <div><strong>{es?"Error registrado":"Error recorded"}</strong><span>{d.errorRecorded?(es?"Sí":"Yes"):(es?"No":"No")}</span></div>
    <div><strong>{es?"Resultado registrado":"Result recorded"}</strong><span>{d.resultRecorded?(es?"Sí":"Yes"):(es?"No":"No")}</span></div>
    <div><strong>ID</strong><span>{d.id}</span></div>
   </div>
   <p className="control-note">{es?"La cola realiza sus propios reintentos. No se ofrece un botón de reenvío hasta disponer de una operación idempotente y autorizada; cambiar manualmente este estado sería una simulación peligrosa.":"The queue manages its own retries. Manual resends require an idempotent, authorized operation and are not simulated by changing a status."}</p>
  </Panel>
 </div>;
}
