"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type ProoflineIconName } from "@proofline/ui";

type WorkspaceLink = { href: string; label: string; roles: string[] | "ALL"; exact?: boolean; icon: ProoflineIconName; group: "general" | "assessments" | "organization" | "management" };

/** Groups change presentation only. Paths, role visibility and active state are unchanged. */
export function WorkspaceNav({ locale, role }: { locale: "es" | "en"; role: string }) {
  const pathname = usePathname();
  const es = locale === "es";
  const all: WorkspaceLink[] = [
    { href: `/${locale}`, label: es ? "Resumen" : "Overview", roles: "ALL", exact: true, icon: "overview", group: "general" },
    { href: `/${locale}/assessments`, label: "Assessments", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER","REVIEWER","ANALYST","VIEWER"], icon: "assessments", group: "assessments" },
    { href: `/${locale}/library`, label: "Library / Marketplace", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER"], icon: "library", group: "assessments" },
    { href: `/${locale}/reports`, label: es ? "Informes" : "Reports", roles: ["OWNER","ADMIN","REVIEWER","ANALYST","VIEWER"], icon: "reports", group: "assessments" },
    { href: `/${locale}/directory`, label: es ? "Personas y organización" : "People & organization", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER"], icon: "people", group: "organization" },
    { href: `/${locale}/team`, label: es ? "Equipo y permisos" : "Team & permissions", roles: ["OWNER","ADMIN"], icon: "user-settings", group: "organization" },
    { href: `/${locale}/branding`, label: es ? "Identidad de organización" : "Organization identity", roles: ["OWNER"], icon: "branding", group: "organization" },
    { href: `/${locale}/billing`, label: es ? "Plan y facturación" : "Plan and billing", roles: ["OWNER","BILLING_ADMIN"], icon: "billing", group: "management" },
    { href: `/${locale}/legal`, label: es ? "Privacidad y cumplimiento" : "Privacy & compliance", roles: ["OWNER","ADMIN"], icon: "governance", group: "management" },
    { href: `/${locale}/support`, label: es ? "Soporte" : "Support", roles: "ALL", icon: "support", group: "management" },
  ];
  const groups = [
    { id: "general", es: "GENERAL", en: "GENERAL" },
    { id: "assessments", es: "ASSESSMENTS", en: "ASSESSMENTS" },
    { id: "organization", es: "ORGANIZACIÓN", en: "ORGANIZATION" },
    { id: "management", es: "GESTIÓN", en: "MANAGEMENT" },
  ] as const;

  const allowed = all.filter(link => link.roles === "ALL" || link.roles.includes(role));
  return (
    <nav className="workspace-nav" aria-label={es ? "Navegación del workspace" : "Workspace navigation"}>
      {groups.map(group => {
        const links = allowed.filter(link => link.group === group.id);
        if (!links.length) return null;
        const activeGroup = links.some(link => link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`));
        return (
          <section className={`workspace-nav-group${activeGroup ? " is-active" : ""}`} key={group.id} aria-label={es ? group.es : group.en}>
            <div className="workspace-nav-group-title" aria-hidden="true">{es ? group.es : group.en}</div>
            <div className="workspace-nav-group-items">
              {links.map(link => {
                const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link key={link.href} className={active ? "active" : ""} href={link.href} aria-current={active ? "page" : undefined}>
                    <Icon name={link.icon} size={17}/><span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
