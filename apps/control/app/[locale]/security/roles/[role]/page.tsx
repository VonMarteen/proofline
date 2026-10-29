import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../../../../lib/api";
import { PageIntro, Panel } from "../../../../../components/control-ui";

export default async function Page({params}:{params:Promise<{locale:string;role:string}>}){
 const {locale:raw,role:requested}=await params,locale=normalizeLocale(raw),es=locale==="es";
 const [governance,users]=await Promise.all([controlGet('/v1/control/governance/roles'),controlGet('/v1/control/security?view=ui')]);
 const role=governance.roles.find((x:any)=>x.role===requested);
 if(!role)notFound();
 const assigned=users.internalUsers.filter((x:any)=>x.role===role.role);
 return <div className="control-stack">
  <div className="control-detail-toolbar"><Link className="control-button secondary" href={`/${locale}/security`}>{es?"← Volver a Seguridad":"← Back to Security"}</Link></div>
  <PageIntro title={role.role.replace('INTERNAL_','')} text={es?"Permisos efectivos de este rol definidos por el servidor. No se pueden editar individualmente en esta pantalla.":"Effective permissions for this role, defined by the server. Individual capabilities cannot be edited here."}/>
  <Panel title={es?"Capacidades vigentes":"Effective capabilities"}>
   {role.capabilities.includes('*')?<p className="control-note">{es?"Acceso global del Platform Owner. Esta cuenta está protegida contra cambios de rol desde Control.":"Full Platform Owner access. This account is protected against role changes in Control."}</p>:<ul className="control-capability-list">{role.capabilities.map((cap:string)=><li key={cap}><code>{cap}</code></li>)}</ul>}
  </Panel>
  <Panel title={`${assigned.length} ${es?"usuarios con este rol":"users with this role"}`}>
   {assigned.length?<div className="control-list compact">{assigned.map((u:any)=><div key={u.id}><div><strong>{u.displayName}</strong><span>{u.email}</span></div><Link className="control-link-strong" href={`/${locale}/security/users/${encodeURIComponent(u.id)}`}>{es?"Abrir usuario":"Open user"}</Link></div>)}</div>:<p className="control-empty">{es?"No hay usuarios asignados a este rol.":"No users currently have this role."}</p>}
  </Panel>
 </div>;
}
