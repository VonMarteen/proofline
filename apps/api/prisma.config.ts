import { defineConfig } from "prisma/config";

const localUrl = "postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline?schema=public";
const url = process.env.PROOFLINE_DATABASE_URL ?? process.env.DATABASE_URL ?? localUrl;
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
});
