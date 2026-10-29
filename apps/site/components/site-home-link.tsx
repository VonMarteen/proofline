"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHomeLink({ href, className, ariaLabel, children }: { href: string; className?: string; ariaLabel: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      scroll
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        if (pathname === href) {
          window.scrollTo(0, 0);
        }
      }}
    >
      {children}
    </Link>
  );
}
