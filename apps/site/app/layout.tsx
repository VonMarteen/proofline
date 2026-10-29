import "./globals.css";
import "./commercial.css";
import "./commercial-editorial.css";
import "./commercial-phase1.css";
import "./commercial-home-v2.css";
import "./commercial-product-v3.css";
import "./consent.css";
import "./commercial-final-v6.css";
import "./commercial-light-polish.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "PROOFLINE",
  description: "Signal & Structure — by ARMAR TECHNOLOGIES",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const preference = jar.get("proofline-site-theme")?.value;
  const theme = preference === "dark" || preference === "light" ? preference : undefined;
  return <html lang="es" data-proofline-surface="site" data-theme={theme} data-theme-preference={preference ?? "system"} suppressHydrationWarning><body>{children}</body></html>;
}
