import { redirect } from "next/navigation";
import { workspaceIdentity, workspaceSessionToken } from "./session";

const internal = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4201";

export async function apiGet(path: string) {
  const [token, identity] = await Promise.all([workspaceSessionToken(), workspaceIdentity()]);
  const headers: Record<string, string> = token
    ? { authorization: `Bearer ${token}` }
    : {
        "x-proofline-user": identity.email,
        "x-proofline-role": identity.role,
        ...(identity.organizationId ? { "x-proofline-organization": identity.organizationId } : {}),
      };

  let response: Response;
  try {
    response = await fetch(`${internal}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Proofline API unavailable at ${internal}: ${message}`);
  }

  if (response.status === 401) redirect("/api/session/expired");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`Proofline API unavailable at ${internal}: ${body?.message ?? `API ${path} returned ${response.status}`}`);
  }
  return response.json();
}
