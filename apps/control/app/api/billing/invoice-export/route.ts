import { NextResponse } from "next/server";
import { controlSessionToken } from "../../../../lib/session";

const base = process.env.CONTROL_API_INTERNAL_URL ?? "http://127.0.0.1:4200";

export async function GET(request: Request) {
  const token = await controlSessionToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const search = new URL(request.url).search;
  const response = await fetch(`${base}/v1/control/billing/invoice-export${search}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "content-length", "x-content-type-options", "cache-control"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(response.body, { status: response.status, headers });
}
