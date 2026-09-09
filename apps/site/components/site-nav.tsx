"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@proofline/i18n";

export function SiteNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const es = locale === "es";
  const items = [
    { href: `/${locale}/product`, label: es ? "Producto" : "Product" },
    { href: `/${locale}/solutions`, label: es ? "Soluciones" : "Solutions" },
    { href: `/${locale}/library`, label: es ? "Frameworks" : "Frameworks" },
    { href: `/${locale}/trust`, label: es ? "Confianza" : "Trust" },
  ];

  return (
    <>
      <nav className="site-nav pl-editorial-nav" aria-label={es ? "Navegación principal" : "Primary navigation"}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <a key={item.href} className={active ? "active" : ""} href={item.href}>{item.label}</a>;
        })}
      </nav>
      <details className="site-mobile-menu">
        <summary>{es ? "Menú" : "Menu"}</summary>
        <nav aria-label={es ? "Navegación móvil" : "Mobile navigation"}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <a key={item.href} className={active ? "active" : ""} href={item.href}>{item.label}</a>;
          })}
          <a href={`/${locale}/legal`}>{es ? "Legal" : "Legal"}</a>
        </nav>
      </details>
    </>
  );
}
