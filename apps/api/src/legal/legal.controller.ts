import { Body, Controller, Get, Post, UseGuards, Inject } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service.js";
import { ClientDevAuthGuard, identityFrom, type HeaderRequest } from "../auth/dev-auth.js";
import { Req } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";

const Interaction = z.object({ documentVersionId:z.string(), action:z.enum(["ACCEPT","ACKNOWLEDGE","CONSENT","EXPLICIT_CONSENT","REJECT","WITHDRAW"]), locale:z.enum(["es","en"]) });
@Controller("v1/legal")
export class LegalController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}
  @Get("public")
  async publicDocs() {
    const docs = await this.db.legalDocument.findMany({ include: { versions: { where:{active:true}, orderBy:{effectiveAt:"desc"} } } });
    return docs.map(d=>({key:d.key,scope:d.scope,description:d.description,versions:d.versions.map(v=>({id:v.id,version:v.version,locale:v.locale,title:v.title,content:v.content,effectiveAt:v.effectiveAt}))}));
  }
  @UseGuards(ClientDevAuthGuard)
  @Post("interactions")
  async interact(@Req() req: HeaderRequest, @Body() body: unknown) {
    const user = identityFrom(req); const value=Interaction.parse(body);
    const row=await this.db.legalInteraction.create({ data: { documentVersionId:value.documentVersionId, actorType:"USER", actorRef:user.email, action:value.action, locale:value.locale, evidence:{channel:"app",authMode:"dev"} } });
    await this.audit.record({actorType:"USER",actorId:user.email,action:`LEGAL_${value.action}`,targetType:"LegalDocumentVersion",targetId:value.documentVersionId});
    return {ok:true,id:row.id};
  }
}
