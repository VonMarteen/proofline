import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ControlAppModule } from "./control-app.module.js";
import { applyLocalDefaults } from "./local-env.js";
import { ControlController } from "./control/control.controller.js";
import { ControlCommercialController } from "./commercial/commercial.controller.js";
import { ControlHealthController } from "./control/control-health.controller.js";
import type { HeaderRequest } from "./auth/dev-auth.js";

applyLocalDefaults();
const internalReq: HeaderRequest = { headers: { "x-proofline-user": "owner@armar.local", "x-proofline-role": "INTERNAL_PLATFORM_OWNER" } };
const app = await NestFactory.createApplicationContext(ControlAppModule, { logger: false });
try {
  const health = app.get(ControlHealthController);
  const control = app.get(ControlController);
  const sales = app.get(ControlCommercialController);
  const ready = await health.health();
  if (!ready?.ok || ready.database !== "ready") throw new Error("Control API database readiness is invalid");
  const overview = await control.overview(internalReq) as any;
  if (typeof overview?.counts?.organizations !== "number" || typeof overview?.counts?.openTickets !== "number") throw new Error("Control overview is invalid");
  const organizations = await control.organizations(internalReq) as any[];
  if (!Array.isArray(organizations) || !organizations.length) throw new Error("Control organizations view is empty");
  const users = await control.users(internalReq) as any[];
  if (!Array.isArray(users) || !users.length) throw new Error("Control users view is empty");
  const usage = await control.usage(internalReq) as any;
  if (!usage?.period || !Array.isArray(usage?.events)) throw new Error("Control usage ledger view is invalid");
  const assessments = await control.assessments(internalReq) as any[];
  if (!Array.isArray(assessments) || !assessments.length) throw new Error("Control assessment operations view is invalid");
  const marketplace = await control.marketplace(internalReq) as any[];
  if (!Array.isArray(marketplace) || marketplace.length < 35) throw new Error("Control marketplace operations view is incomplete");
  const security = await control.security(internalReq) as any;
  if (security?.trustZones?.internal !== "separate-identity-and-session") throw new Error("Control trust-zone/auth separation is incomplete");
  if (!Array.isArray(security?.internalUsers) || security.internalUsers.length < 1) throw new Error("Control has no provisioned internal users in the active database. Run auth:bootstrap-local before runtime:check in local development.");
  const support = await control.support(internalReq) as any;
  if (!Array.isArray(support?.tickets)) throw new Error("Control support queue is invalid");
  const commercial = await sales.list(internalReq) as any[];
  if (!Array.isArray(commercial)) throw new Error("Control commercial pipeline is invalid");
  console.log(`[OK] Critical runtime C2 internal plane · orgs=${organizations.length} · users=${users.length} · marketplace=${marketplace.length} · support=${support.tickets.length} · sales=${commercial.length}`);
} finally {
  await app.close();
}
