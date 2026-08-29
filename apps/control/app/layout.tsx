import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "PROOFLINE — Control",
  description: "ARMAR TECHNOLOGIES internal control plane",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const preference = cookieStore.get("proofline-theme")?.value;
  const theme = preference === "dark" || preference === "light" ? preference : undefined;
  return (
    <html lang="es" data-theme={theme} data-theme-preference={preference ?? "system"} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
