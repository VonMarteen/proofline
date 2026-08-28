import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PROOFLINE Control",
  description: "ARMAR TECHNOLOGIES internal control plane",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning><body>{children}</body></html>;
}
