import { Body,Controller,Get,Header,Inject,Param,Post,Query,Req,StreamableFile,UseGuards } from "@nestjs/common";
import { z } from "zod";
import { accessContext, requireAnyResultRead, requireCapability } from "../auth/access-control.js";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { ReportService } from "./report.service.js";
const G=z.object({kind:z.enum(["EXECUTIVE","FULL"]).default("EXECUTIVE")});
@Controller("v1")
@UseGuards(ClientDevAuthGuard)
export class ReportsController{
 constructor(@Inject(ReportService)private r:ReportService,@Inject(PrismaService)private db:PrismaService){}
 @Get("assessments/:id/report-preview")async preview(@Req()req:HeaderRequest,@Param("id")id:string,@Query("synthetic")s?:string){const ctx=await accessContext(this.db,req);if(ctx.capabilities.includes("assessment.edit"))await requireCapability(this.db,req,"assessment.edit",id);else await requireAnyResultRead(this.db,req,id);return this.r.snapshot(id,s==="1"||s==="true")}
 @Get("assessments/:id/reports")async list(@Req()req:HeaderRequest,@Param("id")id:string){await requireAnyResultRead(this.db,req,id);return this.r.list(id)}
 @Post("assessments/:id/reports")async gen(@Req()req:HeaderRequest,@Param("id")id:string,@Body()b:unknown){await requireCapability(this.db,req,"reports.generate",id);return this.r.generate(id,G.parse(b).kind)}
 @Post("reports/:id/approve")async approve(@Req()req:HeaderRequest,@Param("id")id:string){const report=await this.r.get(id);await requireCapability(this.db,req,"reports.approve",report.assessmentId);return this.r.approve(id)}
 @Post("reports/:id/distribute")async dist(@Req()req:HeaderRequest,@Param("id")id:string){const report=await this.r.get(id);await requireCapability(this.db,req,"reports.distribute",report.assessmentId);return this.r.distribute(id)}
 @Get("reports/:id/pdf")@Header("Content-Type","application/pdf")@Header("Content-Disposition","inline; filename=proofline-report.pdf")async pdf(@Req()req:HeaderRequest,@Param("id")id:string){const report=await this.r.get(id);await requireAnyResultRead(this.db,req,report.assessmentId);return new StreamableFile(await this.r.pdf(id))}
}
