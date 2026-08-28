import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    const adapter = new PrismaPg({ connectionString });
    super({ adapter, log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  }

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log("PostgreSQL ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`PostgreSQL readiness failed: ${message}`);
      throw error;
    }
  }

  async onModuleDestroy() { await this.$disconnect(); }
}
