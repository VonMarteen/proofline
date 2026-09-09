import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { InternalDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { ControlService } from "./control.service.js";
import { SupportService } from "../support/support.service.js";
import { CommercialService } from "../commercial/commercial.service.js";
import { z } from "zod";

@Controller("v1/control")
@UseGuards(InternalDevAuthGuard)
export class ControlController {
  constructor(@Inject(ControlService) private readonly service: ControlService, @Inject(SupportService) private readonly supportService: SupportService, @Inject(CommercialService) private readonly commercialService: CommercialService) {}

  @Get("overview") overview(@Req() req: HeaderRequest) { return this.service.overview(req); }
  @Get("organizations") organizations(@Req() req: HeaderRequest) { return this.service.organizations(req); }
  @Get("organizations/:id") organization(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.organization(req, id); }
  @Get("users") users(@Req() req: HeaderRequest) { return this.service.users(req); }
  @Get("billing") billing(@Req() req: HeaderRequest) { return this.service.billing(req); }
  @Get("usage") usage(@Req() req: HeaderRequest) { return this.service.usage(req); }
  @Get("assessments") assessments(@Req() req: HeaderRequest) { return this.service.assessments(req); }
  @Get("reports") reports(@Req() req: HeaderRequest) { return this.service.reports(req); }
  @Get("support") support(@Req() req: HeaderRequest) { return this.supportService.internalQueue(req); }
  @Get("support/tickets/:id") supportTicket(@Req() req: HeaderRequest, @Param("id") id: string) { return this.supportService.internalTicket(req, id); }
  @Get("support/attachments/:id") async supportAttachment(@Req() req: HeaderRequest, @Param("id") id: string, @Query("download") rawDownload: string | undefined, @Res() reply: any) {
    const download = rawDownload === "1" || rawDownload === "true";
    const file = await this.supportService.internalAttachment(req, id, download ? "download" : "view");
    reply.header("content-type", file.mimeType);
    reply.header("content-length", String(file.bytes.length));
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store, max-age=0");
    reply.header("cross-origin-resource-policy", "same-origin");
    reply.header("content-security-policy", "sandbox");
    reply.header("content-disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return reply.send(file.bytes);
  }
  @Get("communications") communications(@Req() req: HeaderRequest) { return this.service.communications(req); }
  @Get("legal") legal(@Req() req: HeaderRequest) { return this.service.legal(req); }
  @Get("operations") operations(@Req() req: HeaderRequest) { return this.service.operations(req); }
  @Get("audit") audit(@Req() req: HeaderRequest) { return this.service.auditLog(req); }
  @Get("marketplace") marketplace(@Req() req: HeaderRequest) { return this.service.marketplace(req); }
  @Get("security") security(@Req() req: HeaderRequest) { return this.service.security(req); }
  @Get("configuration") configuration(@Req() req: HeaderRequest) { return this.service.configuration(req); }

  @Post("support/tickets/:id/status") updateTicket(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { status?: string }) { return this.supportService.updateStatus(req, id, String(body.status ?? "")); }
  @Post("support/tickets/:id/assign-me") assignTicket(@Req() req: HeaderRequest, @Param("id") id: string) { return this.supportService.assignToMe(req, id); }
  @Post("support/tickets/:id/messages") supportMessage(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { body?: string; visibility?: string }) { return this.supportService.addInternalMessage(req, id, String(body.body ?? ""), String(body.visibility ?? "CUSTOMER")); }
  @Post("support/tickets/:id/request-information") requestInformation(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { body?: string; requestDocument?: boolean }) { return this.supportService.requestInformation(req, id, String(body.body ?? ""), Boolean(body.requestDocument)); }
  @Post("account-change-requests/:id/status") accountChange(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { status?: string; resolutionNote?: string; requestDocument?: boolean }) { return this.supportService.updateAccountChange(req, id, String(body.status ?? ""), body.resolutionNote, Boolean(body.requestDocument)); }
  @Post("internal-users") internalUser(@Req() req: HeaderRequest, @Body() body: unknown) { const p=z.object({email:z.string().email(),displayName:z.string().min(2).max(120),role:z.string()}).parse(body); return this.commercialService.createInternalUser(req,p); }
  @Post("assessments/:id/reprocess") reprocess(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.reprocessAssessment(req, id); }
  @Post("operations/jobs/:id/retry") retryJob(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.retryJob(req, id); }
  @Post("legal-holds/:id/release") releaseHold(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.releaseLegalHold(req, id); }
}
