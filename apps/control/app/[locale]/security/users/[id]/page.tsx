import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";
import { controlIdentity } from "../../../../../lib/session";
import { PageIntro, Panel, Status, dateTime } from "../../../../../components/control-ui";
import { updateInternalRole } from "../../../../actions";

const assignable=["INTERNAL_OPERATIONS","INTERNAL_FINANCE","INTERNAL_TRUST","INTERNAL_SUPPORT","INTERNAL_ANALYST"];
export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale:raw,id}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const [u,identity]=await Promise.all([controlGet(`/v1/control/security/users/${encodeURIComponent(id)}`),controlIdentity()]);
 const canEdit=identity.role==="INTERNAL_PLATFORM_OWNER"&&u.role!=="INTERNAL_PLATFORM_OWNER"&&u.email!==identity.email;
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/security`}>{es?"← Volver a Seguridad":"← Back to Security"}</Link></div>
  <PageIntro title={u.displayName} text={u.email}/>
  <Panel title={es?"Acceso interno actual":"Current internal access"}>
    <div className="control-framework-detail-grid"><div><strong>{es?"Rol":"Role"}</strong><Status value={u.role}/></div><div><strong>{es?"Estado":"Status"}</strong><Status value={u.status}/></div><div><strong>{es?"Sesiones activas":"Active sessions"}</strong><span>{u.activeSessions}</span></div><div><strong>{es?"Último acceso":"Last sign-in"}</strong><span>{dateTime(u.lastLoginAt,locale)}</span></div></div>
  </Panel>
  {canEdit?<Panel title={es?"Asignación de rol":"Role assignment"}>
    <p className="control-note">{es?"Se modificarán únicamente las capacidades efectivas de este usuario a través de un rol definido en el servidor. No se crean permisos individuales ni se altera la matriz RBAC. El cambio quedará auditado.":"This changes the user's effective capabilities through a server-defined role. No individual permissions are created and the RBAC matrix is unchanged. The change is audited."}</p>
    <form action={updateInternalRole} className="control-version-publish" data-confirm-title={es?"Cambiar rol interno":"Change internal role"} data-confirm-message={es?"Los permisos efectivos cambiarán al guardar. El nuevo rol reemplaza al anterior y se registrará la operación.":"Effective permissions change when saved. The new role replaces the previous one and the operation is audited."}>
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={u.id}/>
      <label>{es?"Nuevo rol":"New role"}<select className="control-select" name="role" defaultValue={u.role}>{assignable.map(role=><option key={role} value={role}>{role.replace("INTERNAL_","")}</option>)}</select></label>
      <button className="control-button" type="submit">{es?"Guardar rol":"Save role"}</button>
    </form>
  </Panel>:<p className="control-note">{u.role==="INTERNAL_PLATFORM_OWNER"?es?"La cuenta Owner está protegida y no puede modificarse aquí.":"The Owner account is protected and cannot be changed here.":es?"Solo el Owner puede reasignar roles y no puede cambiar el suyo.":"Only the Owner can reassign roles and cannot change their own."}</p>}
 </div>;
}
