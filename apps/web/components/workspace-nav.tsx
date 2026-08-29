"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type ProoflineIconName } from "@proofline/ui";

export function WorkspaceNav({ locale, role }: { locale: "es" | "en"; role: string }) {
  const pathname = usePathname(), es = locale === "es";
  const all: Array<{ href: string; label: string; roles: string[] | "ALL"; exact?: boolean; icon: ProoflineIconName }> = [
    { href: `/${locale}`, label: es ? "Resumen" : "Overview", roles: "ALL", exact: true, icon: "overview" },
    { href: `/${locale}/assessments`, label: "Assessments", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER","REVIEWER","ANALYST","VIEWER"], icon: "assessments" },
    { href: `/${locale}/library`, label: "Library / Marketplace", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER"], icon: "library" },
    { href: `/${locale}/directory`, label: es ? "Personas y organización" : "People & organization", roles: ["OWNER","ADMIN","ASSESSMENT_MANAGER"], icon: "people" },
    { href: `/${locale}/reports`, label: es ? "Informes" : "Reports", roles: ["OWNER","ADMIN","REVIEWER","ANALYST","VIEWER"], icon: "reports" },
    { href: `/${locale}/billing`, label: es ? "Plan y facturación" : "Plan and billing", roles: ["OWNER","BILLING_ADMIN"], icon: "billing" },
    { href: `/${locale}/team`, label: es ? "Equipo y permisos" : "Team & permissions", roles: ["OWNER","ADMIN"], icon: "user-settings" },
    { href: `/${locale}/branding`, label: es ? "Identidad de organización" : "Organization identity", roles: ["OWNER"], icon: "branding" },
    { href: `/${locale}/legal`, label: es ? "Privacidad y cumplimiento" : "Privacy & compliance", roles: ["OWNER","ADMIN"], icon: "governance" },
    { href: `/${locale}/support`, label: es ? "Soporte" : "Support", roles: "ALL", icon: "support" },
  ];
  const links = all.filter(x => x.roles === "ALL" || x.roles.includes(role));
  return <nav className="workspace-nav" aria-label={es ? "Navegación del workspace" : "Workspace navigation"}>{links.map(link => {
    const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
    return <Link key={link.href} className={active ? "active" : ""} href={link.href} aria-current={active ? "page" : undefined}><Icon name={link.icon} size={17}/><span>{link.label}</span></Link>;
  })}</nav>;
}
