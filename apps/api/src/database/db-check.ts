import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const local = "postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline?schema=public";
const connectionString = process.env.PROOFLINE_DATABASE_URL ?? local;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  await db.$queryRaw`SELECT 1`;
  const organizations = await db.organization.count();
  const assessments = await db.assessment.count();
  console.log(`[OK] PostgreSQL + Prisma · organizations=${organizations} · assessments=${assessments}`);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[FALLO] PostgreSQL + Prisma · ${msg.replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]")}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
