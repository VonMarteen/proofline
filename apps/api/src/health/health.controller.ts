import { Controller, Get, ServiceUnavailableException, Inject } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

function safeDbError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]")
    .replace(/password[^,;\s]*/gi, "password=[redacted]")
    .slice(0, 500);
}

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Get("live")
  live() {
    return { ok: true, service: "proofline-api", status: "live", version: "0.2.5", time: new Date().toISOString() };
  }

  @Get()
  async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { ok: true, service: "proofline-api", status: "ready", database: "ready", version: "0.2.5", time: new Date().toISOString(), authMode: process.env.AUTH_MODE ?? "unset" };
    } catch (error) {
      throw new ServiceUnavailableException({
        ok: false,
        service: "proofline-api",
        status: "degraded",
        database: "unavailable",
        error: process.env.NODE_ENV === "production" ? "Database unavailable" : safeDbError(error),
      });
    }
  }
}
