"use client";

import { useEffect, useRef } from "react";

const SUPPORT_READ_EVENT = "proofline:support-read";

export function WorkspaceSupportMarkRead({
  ticketId,
  readVersion,
}: {
  ticketId: string;
  readVersion: string;
}) {
  const lastSentVersion = useRef<string | null>(null);

  useEffect(() => {
    const versionKey = `${ticketId}:${readVersion}`;
    if (lastSentVersion.current === versionKey) return;
    lastSentVersion.current = versionKey;

    let cancelled = false;

    async function markRead() {
      try {
        const response = await fetch(
          `/api/proxy/v1/workspace/support/tickets/${encodeURIComponent(ticketId)}/read`,
          {
            method: "POST",
            headers: { accept: "application/json" },
          },
        );

        if (!cancelled && response.ok) {
          window.dispatchEvent(
            new CustomEvent(SUPPORT_READ_EVENT, {
              detail: { ticketId },
            }),
          );
        }
      } catch {}
    }

    void markRead();

    return () => {
      cancelled = true;
    };
  }, [ticketId, readVersion]);

  return null;
}
