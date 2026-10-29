import { redirect } from "next/navigation";
import { controlSessionToken } from "./session";

const base = process.env.CONTROL_API_INTERNAL_URL ?? "http://127.0.0.1:4206";

async function authHeaders() {
  const token = await controlSessionToken();
  if (!token) redirect("/api/session/expired");
  return { authorization: `Bearer ${token}` };
}

async function parseResponse(response: Response, path: string) {
  if (response.status === 401) redirect("/api/session/expired");
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Control API ${path} returned ${response.status}${detail ? ` · ${detail}` : ""}`);
  }
  return response.json();
}

export async function controlGet(path: string) {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Proofline Control cannot reach API at ${base} within 5s: ${message}`);
  }
  const elapsedMs = Date.now() - startedAt;
  // Never log query strings, session tokens or response bodies.
  if (elapsedMs > 1000) console.warn(`[CONTROL UI] slow GET ${path.split("?")[0]}: ${elapsedMs}ms; HTTP ${response.status}`);
  return parseResponse(response, path);
}

export async function controlPost(path: string, body: Record<string, unknown> = {}) {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { ...(await authHeaders()), "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Proofline Control cannot reach API at ${base} within 5s: ${message}`);
  }
  return parseResponse(response, path);
}
