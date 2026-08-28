"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@proofline/i18n";
import { copy } from "../lib/copy";

export function SiteNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const c = copy[locale].nav;
  const items = [
    { href: `/${locale}/product`, label: c.product },
    { href: `/${locale}/solutions`, label: c.solutions },
    { href: `/${locale}/library`, label: c.library },
    { href: `/${locale}/trust`, label: c.trust },
    { href: `/${locale}/legal`, label: c.legal },
  ];

  return (
    <>
      <nav className="site-nav" aria-label={locale === "es" ? "Navegación principal" : "Primary navigation"}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <a key={item.href} className={active ? "active" : ""} href={item.href}>{item.label}</a>;
        })}
      </nav>
      <details className="site-mobile-menu">
        <summary>{c.menu}</summary>
        <nav aria-label={locale === "es" ? "Navegación móvil" : "Mobile navigation"}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <a key={item.href} className={active ? "active" : ""} href={item.href}>{item.label}</a>;
          })}
        </nav>
      </details>
    </>
  );
}
