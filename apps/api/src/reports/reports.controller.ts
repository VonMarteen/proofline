import { Body,Controller,Get,Header,Inject,Param,Post,Query,Req,StreamableFile,UseGuards } from "@nestjs/common";
import { z } from "zod";
import { accessContext, requireAnyResultRead, requireCapability } from "../auth/access-control.js";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { REPORT_LEVELS } from "./report-contract.js";
import { ReportService } from "./report.service.js";

const Generate = z.object({ level: z.enum(REPORT_LEVELS).optional(), kind: z.enum(["EXECUTIVE", "FULL"]).optional() }).transform((value) => value.level ?? (value.kind === "FULL" ? "L4_STRATEGIC" : "L1_EXECUTIVE"));

@Controller("v1")
@UseGuards(ClientDevAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportService) private readonly reports: ReportService, @Inject(PrismaService) private readonly db: PrismaService) {}

  @Get("assessments/:id/report-preview")
  async preview(@Req() req: HeaderRequest, @Param("id") id: string, @Query("synthetic") synthetic?: string, @Query("level") level?: string) {
    const ctx = await accessContext(this.db, req);
    if (ctx.capabilities.includes("assessment.edit")) await requireCapability(this.db, req, "assessment.edit", id);
    else await requireAnyResultRead(this.db, req, id);
    return this.reports.preview(id, synthetic === "1" || synthetic === "true", level);
  }

  @Get("assessments/:id/reports")
  async list(@Req() req: HeaderRequest, @Param("id") id: string) {
    await requireAnyResultRead(this.db, req, id);
    return this.reports.list(id);
  }

  @Post("assessments/:id/reports")
  async generate(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    const ctx = await requireCapability(this.db, req, "reports.generate", id);
    return this.reports.generate(id, Generate.parse(body), ctx.identity.email);
  }

  @Post("reports/:id/approve")
  async approve(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    const ctx = await requireCapability(this.db, req, "reports.approve", report.assessmentId);
    return this.reports.approve(id, ctx.identity.email);
  }

  @Post("reports/:id/distribute")
  async distribute(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    const ctx = await requireCapability(this.db, req, "reports.distribute", report.assessmentId);
    return this.reports.distribute(id, ctx.identity.email);
  }

  @Post("reports/:id/retry-failed")
  async retryFailed(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    const ctx = await requireCapability(this.db, req, "reports.distribute", report.assessmentId);
    return this.reports.retryFailedDeliveries(id, ctx.identity.email);
  }

  @Get("reports/:id/view")
  async view(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    await requireAnyResultRead(this.db, req, report.assessmentId);
    return this.reports.view(id);
  }

  @Get("reports/:id/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", "inline; filename=proofline-report.pdf")
  async pdf(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    await requireAnyResultRead(this.db, req, report.assessmentId);
    return new StreamableFile(await this.reports.pdf(id));
  }

  @Get("reports/:id/export.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=proofline-report.json")
  async exportJson(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    await requireAnyResultRead(this.db, req, report.assessmentId);
    return new StreamableFile(await this.reports.exportJson(id));
  }

  @Get("reports/:id/export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=proofline-report.csv")
  async exportCsv(@Req() req: HeaderRequest, @Param("id") id: string) {
    const report = await this.reports.get(id);
    await requireAnyResultRead(this.db, req, report.assessmentId);
    return new StreamableFile(await this.reports.exportCsv(id));
  }
}
