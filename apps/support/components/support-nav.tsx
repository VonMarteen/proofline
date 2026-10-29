"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Icon, type ProoflineIconName } from "@proofline/ui";
import type { Locale } from "@proofline/i18n";

type NavItem = {
  href: string;
  label: string;
  icon: ProoflineIconName;
  view?: string;
  history?: boolean;
};

/** Existing URLs/query semantics are preserved; only navigation grouping is new. */
export function SupportNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = search.get("view") ?? "";
  const es = locale === "es";
  const isHistory = pathname.startsWith(`/${locale}/history`);
  const isTicketDetail = pathname.startsWith(`/${locale}/tickets/`);
  const isQueue = pathname === `/${locale}`;
  const groups: { title: string; items: NavItem[] }[] = [
    { title: es ? "Operación" : "Operations", items: [
      { href: `/${locale}`, label: es ? "Cola de tickets" : "Ticket queue", icon: "support" },
      { href: `/${locale}?view=mine`, label: es ? "Mis tickets" : "My tickets", icon: "user-settings", view: "mine" },
      { href: `/${locale}?view=unassigned`, label: es ? "Sin adjudicar" : "Unassigned", icon: "clock", view: "unassigned" },
    ] },
    { title: es ? "Consulta" : "Review", items: [
      { href: `/${locale}/history`, label: es ? "Histórico" : "History", icon: "history", history: true },
    ] },
  ];

  const isActive = (item: NavItem) => item.history
    ? isHistory
    : isQueue && (item.view ? view === item.view : !view || view === "open");

  return (
    <nav className="support-nav" aria-label={es ? "Navegación de soporte" : "Support navigation"}>
      {groups.map((group, index) => {
        const activeGroup = group.items.some(isActive) || (index === 0 && isTicketDetail) || (index === 0 && isQueue && (view === "overdue" || view === "all"));
        return (
          <div className={`support-nav-group${activeGroup ? " is-active" : ""}`} key={group.title}>
            <span className="support-nav-title">{group.title}</span>
            <div className="support-nav-group-items">
              {group.items.map(item => {
                const active = isActive(item);
                return (
                  <a key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                    <Icon name={item.icon} size={15} />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
