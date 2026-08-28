import { Brand } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";
import { copy } from "../lib/copy";

export function Footer({ locale }: { locale: Locale }) {
  const c = copy[locale].footer;
  return (
    <footer className="footer site-footer">
      <div className="container site-footer-grid">
        <div className="site-footer-brand">
          <Brand />
          <p>{c.note}</p>
          <div className="site-footer-signature">{c.text}</div>
        </div>
        <div className="site-footer-column">
          <strong>{c.platform}</strong>
          <a href={`/${locale}/product`}>{c.product}</a>
          <a href={`/${locale}/solutions`}>{c.modes}</a>
          <a href={`/${locale}/library`}>{c.assessments}</a>
        </div>
        <div className="site-footer-column">
          <strong>{locale === "es" ? "Gobernanza" : "Governance"}</strong>
          <a href={`/${locale}/trust`}>{c.trust}</a>
          <a href={`/${locale}/legal`}>{c.legal}</a>
          <a href={`/${locale}/contact`}>{c.contact}</a>
        </div>
      </div>
      <div className="container site-footer-bottom">
        <span>© {new Date().getFullYear()} ARMAR TECHNOLOGIES</span>
        <span>{locale === "es" ? "Diseñado para decisiones con evidencia." : "Designed for evidence-backed decisions."}</span>
      </div>
    </footer>
  );
}
