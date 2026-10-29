import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { requireCapability } from "../auth/access-control.js";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { ImportService } from "./import.service.js";

const Analyze=z.object({fileName:z.string().min(1).max(240),mimeType:z.string().max(160).default("application/octet-stream"),base64:z.string().min(1),extractedText:z.string().min(20).max(250000)});
const Question=z.object({prompt:z.string().min(5).max(1500),type:z.enum(["SINGLE","MULTI","CHECKBOX","YES_NO","LIKERT","NPS","NUMERIC","RANGE","PERCENTAGE","SLIDER","MATRIX","DUAL","RANKING","ALLOCATION","SHORT_TEXT","LONG_TEXT","INFO"]),dimension:z.string().max(120).nullable().optional(),required:z.boolean().default(true),weight:z.number().positive().max(20).default(1),config:z.record(z.string(),z.unknown()).nullable().optional(),confidence:z.number().optional(),source:z.enum(["detected","suggested"]).optional()});
const Apply=z.object({title:z.string().min(4).max(160).optional(),objective:z.string().min(12).max(1600).optional(),questions:z.array(Question).min(1).max(120).optional(),level:z.enum(["L1","L2","L3","L4"]).default("L2")});
@Controller("v1/workspace/imports")
@UseGuards(ClientDevAuthGuard)
export class ImportsController{
  constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(ImportService)private readonly imports:ImportService,@Inject(AuditService)private readonly audit:AuditService){}
  @Post("analyze")async analyze(@Req()req:HeaderRequest,@Body()body:unknown){const ctx=await requireCapability(this.db,req,"assessment.edit");const value=Analyze.parse(body);const result=await this.imports.analyze(ctx.organization.id,value);await this.audit.record({organizationId:ctx.organization.id,actorType:"USER",actorId:ctx.identity.email,action:"ASSESSMENT_SOURCE_ANALYZED",targetType:"AssessmentImport",targetId:result.id,metadata:{fileName:value.fileName,classification:result.classification,engine:result.engine}});return result}
  @Get(":id")async get(@Req()req:HeaderRequest,@Param("id")id:string){const ctx=await requireCapability(this.db,req,"assessment.edit");return this.imports.get(ctx.organization.id,id)}
  @Get(":id/source")async source(@Req()req:HeaderRequest,@Param("id")id:string){const ctx=await requireCapability(this.db,req,"assessment.edit");return this.imports.source(ctx.organization.id,id)}
  @Post(":id/apply")async apply(@Req()req:HeaderRequest,@Param("id")id:string,@Body()body:unknown){const ctx=await requireCapability(this.db,req,"assessment.edit");const value=Apply.parse(body);const result=await this.imports.apply(ctx.organization.id,id,ctx.identity.email,value as any);return result}
}
