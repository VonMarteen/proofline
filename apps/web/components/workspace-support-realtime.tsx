"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Ticket = {
  id: string;
  status: string;
  updatedAt: string;
  canReply?: boolean;
  unread?: boolean;
  _count?: { messages?: number };
};

type QueuePayload = { unreadCount?: number; tickets?: Ticket[] };

const marker = (payload: QueuePayload) =>
  `${Number(payload.unreadCount ?? 0)}|${(payload.tickets ?? [])
    .map((ticket) => `${ticket.id}:${ticket.status}:${ticket.updatedAt}:${ticket.canReply ? 1 : 0}:${ticket.unread ? 1 : 0}:${ticket._count?.messages ?? 0}`)
    .sort()
    .join("|")}`;

export function WorkspaceSupportRealtime() {
  const router = useRouter();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/proxy/v1/workspace/support", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as QueuePayload;
        const next = marker(data);
        if (seen.current !== null && seen.current !== next) router.refresh();
        seen.current = next;
      } catch {}
    };

    void poll();
    const timer = window.setInterval(() => { if (!document.hidden && !stopped) void poll(); }, 2500);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  return null;
}
