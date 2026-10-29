import Link from "next/link";
import { Icon } from "@proofline/ui";
import { LocaleSwitch, ThemeToggle } from "@proofline/ui/client";
import type { Locale } from "@proofline/i18n";
import { copy } from "../lib/copy";
import { SiteBrand } from "./site-brand";
import { SiteHomeLink } from "./site-home-link";
import { SiteNav } from "./site-nav";

export function Header({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const es = locale === "es";

  return (
    <header className="topbar site-topbar">
      <div className="container site-header-inner">
        <SiteHomeLink className="site-brand-link" href={`/${locale}`} ariaLabel={es ? "Proofline, inicio" : "Proofline, home"}>
          <SiteBrand />
        </SiteHomeLink>

        <SiteNav locale={locale} />

        <div className="site-header-actions">
          <LocaleSwitch locale={locale} preferenceKey="proofline-site-locale" />
          <ThemeToggle
            preferenceKey="proofline-site-theme"
            labels={es ? { light: "Claro", dark: "Oscuro", system: "Sistema" } : { light: "Light", dark: "Dark", system: "System" }}
          />
          <Link className="btn btn-small site-start-button" href={`/${locale}/start`}>
            {es ? "Empezar" : "Start"}
          </Link>
          <Link className="btn btn-small btn-primary site-demo-button" href={`/${locale}/contact`}>
            <span>{c.nav.contact}</span>
            <Icon name="arrow-right" size={15} strokeWidth={1.9} />
          </Link>
        </div>
      </div>
    </header>
  );
}
