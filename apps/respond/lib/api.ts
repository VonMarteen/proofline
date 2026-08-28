export async function getAssessment(token: string, locale: string) {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
  try {
    const r = await fetch(`${base}/v1/respond/${encodeURIComponent(token)}?locale=${encodeURIComponent(locale)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}
