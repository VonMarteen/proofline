import "./globals.css";
import "./preferences.css";
import "./support-ux-p1-parity.css";
import "./suite-shell-parity.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "PROOFLINE — Support",
  description: "PROOFLINE internal support operations",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const preference = jar.get("proofline-support-theme")?.value;
  const theme = preference === "dark" || preference === "light" ? preference : undefined;
  return <html lang="es" data-proofline-surface="support" data-theme={theme} data-theme-preference={preference ?? "system"} suppressHydrationWarning><body>{children}</body></html>;
}
