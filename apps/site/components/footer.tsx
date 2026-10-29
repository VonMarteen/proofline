import { Icon } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";
import { copy } from "../lib/copy";
import { CookiePreferencesButton } from "./consent-manager";
import { SiteBrand } from "./site-brand";

const socialLinks = [
  { label: "LinkedIn", icon: "linkedin" as const },
  { label: "Instagram", icon: "instagram" as const },
  { label: "X", icon: "x" as const },
] as const;

export function Footer({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const f = c.footer;

  return (
    <footer className="footer site-footer">
      <div className="container site-footer-grid">
        <div className="site-footer-brand">
          <SiteBrand />
          <p>{f.note}</p>
          <div className="site-footer-signature">{f.text}</div>
        </div>

        <div className="site-footer-column">
          <strong>{f.platform}</strong>
          <a href={`/${locale}/product`}>{f.product}</a>
          <a href={`/${locale}/solutions`}>{f.modes}</a>
          <a href={`/${locale}/library`}>{f.assessments}</a>
        </div>

        <div className="site-footer-column">
          <strong>{locale === "es" ? "Gobernanza" : "Governance"}</strong>
          <a href={`/${locale}/trust`}>{f.trust}</a>
          <a href={`/${locale}/legal`}>{f.legal}</a>
          <a href={`/${locale}/cookies`}>{locale === "es" ? "Política de cookies" : "Cookie policy"}</a>
          <CookiePreferencesButton locale={locale} />
          <a href={`/${locale}/contact`}>{f.contact}</a>
        </div>

        <div className="site-footer-social">
          <strong>{locale === "es" ? "Redes sociales" : "Social"}</strong>
          <p>{locale === "es" ? "Canales preparados para conectar los perfiles oficiales de Proofline." : "Channels ready to connect Proofline's official profiles."}</p>
          <div className="site-footer-social-links" aria-label={locale === "es" ? "Redes sociales de Proofline" : "Proofline social media"}>
            {socialLinks.map(({ label, icon }) => (
              <span className="site-social-link is-pending" key={label} aria-label={`${label} — ${locale === "es" ? "URL pendiente de configurar" : "URL pending configuration"}`} title={`${label} — ${locale === "es" ? "URL pendiente" : "URL pending"}`}>
                <Icon name={icon} size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="container site-footer-bottom">
        <span>© {new Date().getFullYear()} ARMAR TECHNOLOGIES</span>
        <span>{locale === "es" ? "Diseñado para decisiones con evidencia." : "Designed for evidence-backed decisions."}</span>
      </div>
    </footer>
  );
}
