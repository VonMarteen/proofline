"use client";

import Link from "next/link";
import { ThemeToggle } from "@proofline/ui/client";

export function SupportLoginPreferences({
  locale,
}: {
  locale: "es" | "en";
}) {
  const next = locale === "es" ? "en" : "es";

  function remember() {
    localStorage.setItem("proofline-support-locale", next);
    document.cookie = `proofline-support-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
  }

  return (
    <div className="support-login-preferences">
      <Link
        className="btn btn-small btn-ghost proofline-utility-button"
        href={`/login?locale=${next}`}
        onClick={remember}
        aria-label={locale === "es" ? "Cambiar idioma" : "Change language"}
      >
        {next.toUpperCase()}
      </Link>

      <ThemeToggle
        preferenceKey="proofline-support-theme"
        labels={
          locale === "es"
            ? { light: "Claro", dark: "Oscuro", system: "Sistema" }
            : { light: "Light", dark: "Dark", system: "System" }
        }
      />
    </div>
  );
}
