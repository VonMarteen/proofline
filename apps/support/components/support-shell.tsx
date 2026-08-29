import { Brand, Icon } from "@proofline/ui";
import { ConfirmActionProvider } from "@proofline/ui/client";
import type { Locale } from "@proofline/i18n";
import { SupportLogoutButton } from "./support-logout-button";
import { SupportRealtime } from "./support-realtime";

export function SupportShell({locale,identity,children}:{locale:Locale;identity:{email:string;role:string;name:string};children:React.ReactNode}){
  const es=locale==="es",roleLabel=identity.role==="INTERNAL_SUPPORT"?(es?"Agente de soporte":"Support agent"):identity.role.replace(/^INTERNAL_/,"").replaceAll("_"," ");
  return <ConfirmActionProvider locale={locale}><div className="support-shell"><aside className="support-sidebar"><div className="support-brand"><Brand/><span>Support</span></div><div className="support-agent"><span className="support-agent-avatar"><Icon name="support" size={17}/></span><div><strong>{identity.name}</strong><span>{identity.email}</span><small>{roleLabel}</small></div></div><nav><a href={`/${locale}`}><Icon name="support" size={15}/><span>{es?"Cola de tickets":"Ticket queue"}</span></a><a href={`/${locale}?view=mine`}><Icon name="user-settings" size={15}/><span>{es?"Mis tickets":"My tickets"}</span></a><a href={`/${locale}?view=unassigned`}><Icon name="clock" size={15}/><span>{es?"Sin adjudicar":"Unassigned"}</span></a><a href={`/${locale}/history`}><Icon name="history" size={15}/><span>{es?"Histórico":"History"}</span></a></nav><div className="support-sidebar-bottom"><span>{es?"Acceso interno limitado":"Restricted internal access"}</span><SupportLogoutButton locale={locale}/></div></aside><main className="support-main"><header className="support-header"><span className="support-header-label"><Icon name="security" size={14}/>{es?"Operación interna":"Internal operations"}</span><SupportRealtime locale={locale}/></header><div className="support-content">{children}</div></main></div></ConfirmActionProvider>;
}
