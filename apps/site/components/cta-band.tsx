import type { Locale } from "@proofline/i18n";

export function CtaBand({
  locale,
  title,
  text,
  secondaryHref,
  secondaryLabel,
}: {
  locale: Locale;
  title: string;
  text: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const es = locale === "es";
  return (
    <section className="section section-final">
      <div className="container">
        <div className="cta-band">
          <div><h2>{title}</h2><p>{text}</p></div>
          <div className="cta-band-actions">
            <a className="btn btn-primary" href={`/${locale}/contact`}>{es ? "Solicitar una demo" : "Book a demo"}</a>
            <a className="btn" href={`/${locale}/start`}>{es ? "Empezar" : "Start"}</a>
            {secondaryHref && secondaryLabel ? <a className="btn" href={secondaryHref}>{secondaryLabel}</a> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
