import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

export type HealthStatus = "healthy" | "degraded" | "unavailable" | "attention" | "not_configured";

type Probe = {
  status: HealthStatus;
  latencyMs: number | null;
  detail?: string;
};

const nowIso = () => new Date().toISOString();

@Injectable()
export class SystemHealthService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private async probeHttp(url: string, timeoutMs = 2500): Promise<Probe> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const latencyMs = Date.now() - started;
      if (!response.ok) return { status: "degraded", latencyMs, detail: `HTTP ${response.status}` };
      return { status: "healthy", latencyMs };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        detail: "Probe unavailable or timed out",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async probeDatabase(): Promise<Probe> {
    const started = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "healthy", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        detail: "Probe unavailable or timed out",
      };
    }
  }

  private async probeQueue(): Promise<Probe & { pending: number; processing: number; failed: number; oldestPendingSeconds: number | null }> {
    const started = Date.now();
    try {
      const [pending, processing, failed, oldest] = await Promise.all([
        this.db.outboxEvent.count({ where: { status: "PENDING" } }),
        this.db.outboxEvent.count({ where: { status: "PROCESSING" } }),
        this.db.outboxEvent.count({ where: { status: "FAILED" } }),
        this.db.outboxEvent.findFirst({ where: { status: "PENDING" }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
      ]);
      const oldestPendingSeconds = oldest ? Math.max(0, Math.round((Date.now() - oldest.createdAt.getTime()) / 1000)) : null;
      const stale = oldestPendingSeconds !== null && oldestPendingSeconds > 120;
      const status: HealthStatus = failed > 0 ? "attention" : stale ? "degraded" : "healthy";
      return { status, latencyMs: Date.now() - started, pending, processing, failed, oldestPendingSeconds };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        detail: "Probe unavailable or timed out",
        pending: 0,
        processing: 0,
        failed: 0,
        oldestPendingSeconds: null,
      };
    }
  }

  async snapshot() {
    const clientApiUrl = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4201").replace(/\/$/, "");
    const analyticsUrl = (process.env.ANALYTICS_URL ?? "http://127.0.0.1:4281").replace(/\/$/, "");
    const mailpitUrl = (process.env.MAILPIT_WEB_URL ?? "http://127.0.0.1:4280").replace(/\/$/, "");
    const [api, database, analytics, mail, queue] = await Promise.all([
      this.probeHttp(`${clientApiUrl}/health`),
      this.probeDatabase(),
      this.probeHttp(`${analyticsUrl}/health`),
      this.probeHttp(`${mailpitUrl}/api/v1/info`),
      this.probeQueue(),
    ]);

    return {
      checkedAt: nowIso(),
      environment: process.env.NODE_ENV ?? "development",
      api,
      controlApi: {
        status: "healthy" as HealthStatus,
        latencyMs: 0,
        uptimeSeconds: Math.round(process.uptime()),
        detail: "self-liveness",
      },
      database,
      analytics,
      mail,
      queue,
    };
  }
}
