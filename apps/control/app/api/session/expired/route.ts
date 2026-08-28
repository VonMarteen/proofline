import { NextResponse } from "next/server";

const secure = process.env.NODE_ENV === "production";
const sessionCookies = [
  "proofline_control_session",
  "proofline_control_user",
  "proofline_control_role",
  "proofline_control_name",
];

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?locale=es&reason=session-expired", request.url));
  for (const name of sessionCookies) {
    response.cookies.set(name, "", { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: 0 });
  }
  return response;
}
