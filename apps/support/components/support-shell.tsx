import { Brand, Icon } from "@proofline/ui";
import { ConfirmActionProvider, LocaleSwitch, ThemeToggle } from "@proofline/ui/client";
import type { Locale } from "@proofline/i18n";
import { SupportLogoutButton } from "./support-logout-button";
import { SupportRealtime } from "./support-realtime";
import { SupportNav } from "./support-nav";

/** Support visual parity P1. Authentication, provider and route behavior unchanged. */
export function SupportShell({
  locale, identity, children,
}: {
  locale: Locale;
  identity: { email: string; role: string; name: string };
  children: React.ReactNode;
}) {
  const es = locale === "es";
  const roleLabel = identity.role === "INTERNAL_SUPPORT"
    ? (es ? "Equipo de soporte" : "Support team")
    : identity.role.replace(/^INTERNAL_/, "").replaceAll("_", " ");

  return (
    <ConfirmActionProvider locale={locale}>
      <div className="support-shell">
        <aside className="support-sidebar">
          <div className="support-brand">
            <Brand />
            <span>{es ? "SOPORTE" : "SUPPORT"}</span>
          </div>
          <SupportNav locale={locale} />
          <div className="support-sidebar-bottom">
            <div className="support-agent">
              <span className="support-agent-avatar"><Icon name="support" size={17} /></span>
              <div>
                <strong>{identity.name}</strong>
                <span>{identity.email}</span>
                <small>{roleLabel}</small>
              </div>
            </div>
            <SupportLogoutButton locale={locale} />
          </div>
        </aside>
        <main className="support-main">
          <header className="support-header">
            <div className="support-header-context">
              <strong>{es ? "Proofline Support" : "Proofline Support"}</strong>
              <span className="support-header-label">
                <Icon name="support" size={13} />
                {es ? "Gestión de tickets" : "Ticket operations"}
              </span>
            </div>
            <div className="support-header-actions">
              <LocaleSwitch locale={locale} preferenceKey="proofline-support-locale" />
              <ThemeToggle preferenceKey="proofline-support-theme" labels={es
                ? { light: "Claro", dark: "Oscuro", system: "Sistema" }
                : { light: "Light", dark: "Dark", system: "System" }} />
              <SupportRealtime locale={locale} />
            </div>
          </header>
          <div className="support-mobile-nav"><SupportNav locale={locale} /></div>
          <div className="support-content">{children}</div>
        </main>
      </div>
    </ConfirmActionProvider>
  );
}
