import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { applyLocalDefaults } from "./local-env.js";

async function bootstrap() {
  applyLocalDefaults();
  if (process.env.NODE_ENV === "production" && process.env.AUTH_MODE === "dev") {
    throw new Error("Refusing to boot production with AUTH_MODE=dev");
  }
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 16 * 1024 * 1024 }),
    { logger: ["log", "warn", "error"] },
  );
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-proofline-user", "x-proofline-role", "x-proofline-organization", "x-service-token"],
  });
  await app.listen(Number(process.env.PORT ?? 4201), "0.0.0.0");
  console.log(`[proofline-api] http://localhost:${process.env.PORT ?? 4201}`);
}

bootstrap().catch((error) => {
  console.error("Proofline API failed to start", error);
  process.exit(1);
});
