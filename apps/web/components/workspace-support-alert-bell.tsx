"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@proofline/ui";

type SupportQueuePayload = { unreadCount?: number };
const SUPPORT_READ_EVENT = "proofline:support-read";

export function WorkspaceSupportAlertBell({ locale }: { locale: "es" | "en" }) {
  const es = locale === "es";
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/proxy/v1/workspace/support", { cache: "no-store", headers: { accept: "application/json" } });
      if (!response.ok) return;
      const data = (await response.json()) as SupportQueuePayload;
      setCount(Math.max(0, Number(data.unreadCount ?? 0)));
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const onFocus = () => void refresh();
    const onRead = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(SUPPORT_READ_EVENT, onRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SUPPORT_READ_EVENT, onRead);
    };
  }, [refresh]);

  const label = count > 0
    ? (es ? `${count} ticket${count === 1 ? "" : "s"} con mensajes nuevos` : `${count} ticket${count === 1 ? "" : "s"} with new messages`)
    : (es ? "Sin mensajes nuevos de soporte" : "No new support messages");

  return (
    <Link href={`/${locale}/support`} className={`workspace-support-bell${count > 0 ? " has-unread" : ""}`} aria-label={label} title={label}>
      <Icon name="bell" size={17} />
      {count > 0 ? <span className="workspace-support-bell-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
