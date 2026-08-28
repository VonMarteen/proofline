import { Brand } from "@proofline/ui";
import { LocaleSwitch, ThemeToggle } from "@proofline/ui/client";
import type { Locale } from "@proofline/i18n";
import { copy } from "../lib/copy";
import { SiteNav } from "./site-nav";

export function Header({ locale }: { locale: Locale }) {
  const c = copy[locale];
  return (
    <header className="topbar site-topbar">
      <div className="container site-header-inner">
        <a className="site-brand-link" href={`/${locale}`} aria-label="Proofline">
          <Brand />
        </a>
        <SiteNav locale={locale} />
        <div className="site-header-actions">
          <LocaleSwitch locale={locale} />
          <ThemeToggle labels={locale === "es" ? { light: "Claro", dark: "Oscuro", system: "Sistema" } : { light: "Light", dark: "Dark", system: "System" }} />
          <a className="btn btn-small site-start-button" href={`/${locale}/start`}>{locale === "es" ? "Empezar" : "Start"}</a>
          <a className="btn btn-small btn-primary site-demo-button" href={`/${locale}/contact`}>{c.nav.contact}</a>
        </div>
      </div>
    </header>
  );
}
