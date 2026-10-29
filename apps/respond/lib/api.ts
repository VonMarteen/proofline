export type AssessmentLoadResult =
  | { ok: true; data: any }
  | { ok: false; status: number; message: string };

export async function getAssessmentResult(token: string, locale: string): Promise<AssessmentLoadResult> {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4201";
  try {
    const r = await fetch(`${base}/v1/respond/${encodeURIComponent(token)}?locale=${encodeURIComponent(locale)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const raw = Array.isArray(body?.message) ? body.message.join(" · ") : body?.message;
      return { ok: false, status: r.status, message: typeof raw === "string" && raw.trim() ? raw : `API ${r.status}` };
    }
    return { ok: true, data: body };
  } catch {
    return { ok: false, status: 503, message: "Respond service unavailable" };
  }
}

export async function getAssessment(token: string, locale: string) {
  const result = await getAssessmentResult(token, locale);
  return result.ok ? result.data : null;
}
