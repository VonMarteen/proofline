import "./globals.css";
import "./workspace.css";
import "./workspace-enterprise-r3.css";
import "./assessment-detail-r4.css";
import "./assessment-detail-r5.css";
import "./workspace-r6-actions-density.css";
import "./workspace-r7-kpi-exclusion.css";
import "./workspace-r8-parity.css";
import "./suite-shell-parity.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "PROOFLINE",
  description: "Signal & Structure — customer workspace",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const preference = jar.get("proofline-workspace-theme")?.value;
  const theme = preference === "dark" || preference === "light" ? preference : undefined;
  return <html lang="es" data-proofline-surface="workspace" data-theme={theme} data-theme-preference={preference ?? "system"} suppressHydrationWarning><body>{children}</body></html>;
}
