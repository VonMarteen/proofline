"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@proofline/i18n";

const routes = [
  ["/organizations", "Plataforma", "Platform", "Organizaciones", "Organizations"],
  ["/users", "Plataforma", "Platform", "Usuarios y accesos", "Users & access"],
  ["/sales", "Negocio", "Business", "Ventas y onboarding", "Sales & onboarding"],
  ["/plans", "Negocio", "Business", "Planes y capacidades", "Plans & entitlements"],
  ["/billing", "Negocio", "Business", "Suscripciones y facturación", "Subscriptions & billing"],
  ["/usage", "Negocio", "Business", "Uso", "Usage"],
  ["/assessments", "Producto", "Product", "Assessments", "Assessments"],
  ["/reports", "Producto", "Product", "Informes", "Reports"],
  ["/marketplace", "Producto", "Product", "Marketplace", "Marketplace"],
  ["/communications", "Producto", "Product", "Comunicaciones", "Communications"],
  ["/support/history", "Servicio", "Service", "Histórico de tickets", "Ticket history"],
  ["/support", "Servicio", "Service", "Soporte", "Support"],
  ["/legal", "Confianza", "Trust", "Legal & Trust", "Legal & Trust"],
  ["/privacy", "Confianza", "Trust", "Privacidad y retención", "Privacy & retention"],
  ["/security", "Confianza", "Trust", "Seguridad", "Security"],
  ["/operations", "Operación", "Operations", "Operaciones", "Operations"],
  ["/audit", "Operación", "Operations", "Auditoría", "Audit"],
  ["/configuration", "Operación", "Operations", "Configuración", "Configuration"],
] as const;

export function ControlLocation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const es = locale === "es";
  const base = `/${locale}`;
  const match = routes.find(([suffix]) => pathname === `${base}${suffix}` || pathname.startsWith(`${base}${suffix}/`));
  const section = match ? (es ? match[1] : match[2]) : es ? "Plataforma" : "Platform";
  const page = match ? (es ? match[3] : match[4]) : es ? "Resumen" : "Overview";

  return (
    <div className="control-location" aria-label={es ? "Ubicación actual" : "Current location"}>
      <span>{section}</span>
      <i aria-hidden="true">/</i>
      <strong>{page}</strong>
    </div>
  );
}
