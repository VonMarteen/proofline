import Link from "next/link";
import { Brand } from "@proofline/ui";
import { ConfirmActionProvider, LocaleSwitch, ThemeToggle } from "@proofline/ui/client";
import type { Locale } from "@proofline/i18n";
import { WorkspaceNav } from "./workspace-nav";
import { LogoutButton } from "./logout-button";
import { WorkspaceSupportAlertBell } from "./workspace-support-alert-bell";

type OrganizationContext = { id: string; name: string; logo?: { dataUrl: string; fileName?: string; mimeType?: string } | null };

function OrganizationIdentity({ organization, compact = false }: { organization: OrganizationContext; compact?: boolean }) {
  const initials = organization.name.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={compact ? "workspace-tenant workspace-tenant-compact" : "workspace-tenant"}>
      <span className="workspace-tenant-logo">{organization.logo?.dataUrl ? <img src={organization.logo.dataUrl} alt="" /> : <strong>{initials}</strong>}</span>
      <span className="workspace-tenant-copy"><strong>{organization.name}</strong>{!compact ? <small>Workspace</small> : null}</span>
    </div>
  );
}

export function AppShell({ locale, children, identity, organization }: { locale: Locale; children: React.ReactNode; identity: { email: string; role: string; name: string }; organization: OrganizationContext }) {
  const es = locale === "es";
  const initials = identity.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <ConfirmActionProvider locale={locale}>
      <div className="shell workspace-shell">
        <aside className="sidebar workspace-sidebar">
          <Link className="workspace-brand" href={`/${locale}`}><Brand /></Link>
          <div className="workspace-org"><OrganizationIdentity organization={organization} /></div>
          <WorkspaceNav locale={locale} role={identity.role} />
          <div className="workspace-sidebar-footer">
            <div className="workspace-user">
              <span className="workspace-avatar">{initials}</span>
              <span><strong>{identity.name}</strong><small>{identity.role.replaceAll("_", " ")} · {organization.name}</small></span>
            </div>
            <LogoutButton locale={locale} />
          </div>
        </aside>
        <div className="main workspace-main">
          <header className="app-header workspace-header">
            <div className="workspace-header-context"><strong>Workspace</strong></div>
            <div className="nav-actions">
              <WorkspaceSupportAlertBell locale={locale} />
              <span className="workspace-role-chip">{identity.role.replaceAll("_", " ")}</span>
              <LocaleSwitch locale={locale} />
              <ThemeToggle labels={es ? { light: "Claro", dark: "Oscuro", system: "Sistema" } : { light: "Light", dark: "Dark", system: "System" }} />
            </div>
          </header>
          <div className="workspace-mobile-nav"><WorkspaceNav locale={locale} role={identity.role} /></div>
          <main className="app-content workspace-content">{children}</main>
        </div>
      </div>
    </ConfirmActionProvider>
  );
}
