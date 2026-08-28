import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PROOFLINE",
  description: "Signal & Structure — by ARMAR TECHNOLOGIES",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
