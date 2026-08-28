import { NextResponse } from "next/server";

const secure = process.env.NODE_ENV === "production";
const sessionCookies = [
  "proofline_workspace_session",
  "proofline_workspace_user",
  "proofline_workspace_role",
  "proofline_workspace_name",
  "proofline_workspace_org",
];

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?locale=es&reason=session-expired", request.url));
  for (const name of sessionCookies) {
    response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
  }
  return response;
}
