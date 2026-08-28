import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { randomBytes, scryptSync } from "node:crypto";

const LOCAL_DATABASE_URL = "postgresql://proofline:proofline_local_only@127.0.0.1:55432/proofline?schema=public";
const url = process.env.PROOFLINE_DATABASE_URL ?? LOCAL_DATABASE_URL;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
function hashPassword(password: string) { const salt = randomBytes(16).toString("base64url"); const digest = scryptSync(password, salt, 32).toString("base64url"); return `scrypt$${salt}$${digest}`; }

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("auth:bootstrap-local is forbidden in production");
  const clientDefault = process.env.PROOFLINE_LOCAL_CLIENT_PASSWORD ?? "proofline-demo";
  const acmeUsers = await db.user.findMany({ where: { email: { endsWith: "@acme.local" } }, select: { id: true, passwordHash: true } });
  for (const user of acmeUsers) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: user.passwordHash ?? hashPassword(clientDefault), accountStatus: "ACTIVE", emailVerifiedAt: new Date() } });
  }

  const internalDefault = process.env.PROOFLINE_LOCAL_CONTROL_PASSWORD ?? "proofline-control-demo";
  const internalUsers = [
    { email: "owner@armar.local", displayName: "Platform Owner", role: "INTERNAL_PLATFORM_OWNER" },
    { email: "support@armar.local", displayName: "Support Operator", role: "INTERNAL_SUPPORT" },
    { email: "operations@armar.local", displayName: "Operations", role: "INTERNAL_OPERATIONS" },
    { email: "finance@armar.local", displayName: "Finance", role: "INTERNAL_FINANCE" },
    { email: "trust@armar.local", displayName: "Trust & Privacy", role: "INTERNAL_TRUST" },
  ];
  for (const item of internalUsers) {
    const existing = await db.internalUser.findUnique({ where: { email: item.email } });
    await db.internalUser.upsert({
      where: { email: item.email },
      update: { displayName: item.displayName, role: item.role, status: "ACTIVE", emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(), passwordHash: existing?.passwordHash ?? hashPassword(internalDefault) },
      create: { ...item, status: "ACTIVE", passwordHash: hashPassword(internalDefault), emailVerifiedAt: new Date() },
    });
  }
  console.log("Local auth bootstrap complete");
  console.log("Default Workspace password is assigned only to local ACME users without a password: proofline-demo (unless PROOFLINE_LOCAL_CLIENT_PASSWORD is set)");
  console.log("Default Control password is assigned only to newly created local internal users: proofline-control-demo (unless PROOFLINE_LOCAL_CONTROL_PASSWORD is set)");
}
main().finally(() => db.$disconnect());
