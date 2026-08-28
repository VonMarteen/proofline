import { normalizeLocale } from "@proofline/i18n";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { SiteCookiePreferences } from "../../components/cookie-preferences";

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  return <div className="site-shell">
    <Header locale={locale} />
    <main className="site-main">{children}</main>
    <Footer locale={locale} />
    <SiteCookiePreferences locale={locale} />
  </div>;
}
