"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";

export function SiteNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const es = locale === "es";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const items = [
    { href: `/${locale}/product`, label: es ? "Producto" : "Product" },
    { href: `/${locale}/solutions`, label: es ? "Soluciones" : "Solutions" },
    { href: `/${locale}/library`, label: "Frameworks" },
    { href: `/${locale}/trust`, label: es ? "Confianza" : "Trust" },
  ];

  const activeFor = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className="site-nav pl-editorial-nav" aria-label={es ? "Navegación principal" : "Primary navigation"}>
        {items.map((item) => (
          <Link key={item.href} className={activeFor(item.href) ? "active" : ""} href={item.href} aria-current={activeFor(item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="site-mobile-menu">
        <button
          type="button"
          className="site-mobile-menu-trigger"
          aria-expanded={open}
          aria-controls="site-mobile-navigation"
          aria-label={open ? (es ? "Cerrar menú" : "Close menu") : (es ? "Abrir menú" : "Open menu")}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} size={19} strokeWidth={1.9} />
          <span>{es ? "Menú" : "Menu"}</span>
        </button>

        <div className={`site-mobile-menu-panel${open ? " is-open" : ""}`} id="site-mobile-navigation">
          <nav aria-label={es ? "Navegación móvil" : "Mobile navigation"}>
            {items.map((item) => (
              <Link key={item.href} className={activeFor(item.href) ? "active" : ""} href={item.href} aria-current={activeFor(item.href) ? "page" : undefined}>
                <span>{item.label}</span>
                <Icon name="chevron-right" size={16} strokeWidth={1.8} />
              </Link>
            ))}
            <Link href={`/${locale}/legal`}>
              <span>{es ? "Legal" : "Legal"}</span>
              <Icon name="chevron-right" size={16} strokeWidth={1.8} />
            </Link>
          </nav>

          <div className="site-mobile-menu-actions">
            <Link className="btn" href={`/${locale}/start`}>{es ? "Empezar" : "Start"}</Link>
            <Link className="btn btn-primary" href={`/${locale}/contact`}>
              <span>{es ? "Solicitar demo" : "Request demo"}</span>
              <Icon name="arrow-right" size={16} strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
