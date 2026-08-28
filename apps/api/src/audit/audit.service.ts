import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async record(input: {
    organizationId?: string;
    actorType: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.db.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        // Prisma's JSON input type is intentionally narrower than unknown.
        // Audit metadata enters only from server-owned objects; this cast is the
        // explicit JSON boundary and avoids leaking Prisma types across services.
        metadata: (input.metadata ?? {}) as any,
      },
    });
  }
}
