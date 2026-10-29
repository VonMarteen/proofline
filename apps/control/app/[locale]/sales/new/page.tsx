import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { controlIdentity } from "../../../../lib/session";
import { controlGet } from "../../../../lib/api";
import { PageIntro, Panel } from "../../../../components/control-ui";
import { createInternalOpportunity } from "../../../actions";
import styles from "./new-opportunity.module.css";

export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const identity=await controlIdentity();
 if(!["INTERNAL_PLATFORM_OWNER","INTERNAL_OPERATIONS"].includes(identity.role))notFound();
 const plans=await controlGet("/v1/control/sales/plans");
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/sales`}>{es?"← Volver a Ventas":"← Back to Sales"}</Link></div>
  <PageIntro title={es?"Registrar oportunidad":"Register opportunity"} text={es?"Alta interna auditable para contactos atendidos por el equipo. No se registra aceptación de avisos ni se activa un cobro.":"Auditable internal intake for contacts handled by the team. No legal acknowledgement or charge is recorded."}/>
  <Panel title={es?"Datos de la oportunidad":"Opportunity details"}>
   <form action={createInternalOpportunity} className={styles.form} data-confirm-title={es?"Registrar oportunidad":"Register opportunity"} data-confirm-message={es?"Se guardará una oportunidad NEW con origen interno. No se enviará correo ni se simularán consentimientos.":"Saves a NEW opportunity with internal origin. No email or simulated consent will be sent."}>
    <input type="hidden" name="locale" value={locale}/>
    <div className={styles.fields}>
     <label>{es?"Modalidad":"Mode"}<select name="mode" required defaultValue="DEMO"><option value="DEMO">Demo</option><option value="START">Start</option></select></label>
     <label>{es?"Nombre del contacto":"Contact name"}<input name="name" minLength={2} maxLength={120} required autoComplete="name"/></label>
     <label>{es?"Correo del contacto":"Contact email"}<input name="email" type="email" maxLength={254} required autoComplete="email"/></label>
     <label>{es?"Empresa":"Company"}<input name="company" minLength={2} maxLength={160} required autoComplete="organization"/></label>
     <label>{es?"País (opcional)":"Country (optional)"}<input name="country" maxLength={80}/></label>
     <label>{es?"Participantes estimados (opcional)":"Estimated participants (optional)"}<input name="estimatedParticipants" type="number" min={1} max={1000000} step={1}/></label>
     <label>{es?"Plan de interés (opcional)":"Interested plan (optional)"}<select name="planCode" defaultValue=""><option value="">{es?"Por definir":"To be decided"}</option>{plans.map((x:any)=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
     <label className={styles.full}>{es?"Necesidad comercial (opcional)":"Commercial need (optional)"}<textarea name="useCase" maxLength={3000} rows={3} placeholder={es?"Describe el contexto o el siguiente paso":"Describe the context or next action"}/></label>
    </div>
    <p className="control-note">{es?"El registro no crea un Lead público, no implica aceptación legal y no activa métodos de pago. Las acciones posteriores se gestionan desde el pipeline con los permisos vigentes.":"The record is not a public lead, does not imply legal acceptance, and does not activate payment methods. Subsequent actions use the existing pipeline permissions."}</p>
    <div className={styles.actions}><button className="control-button" type="submit">{es?"Guardar oportunidad":"Save opportunity"}</button><Link href={`/${locale}/sales`} className="control-button secondary">{es?"Cancelar":"Cancel"}</Link></div>
   </form>
  </Panel>
 </div>;
}
