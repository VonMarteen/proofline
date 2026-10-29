import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { SupportService } from "./support.service.js";

const Ticket = z.object({
  subject: z.string().min(4).max(180),
  description: z.string().min(10).max(5000),
  category: z.string(),
  priority: z.string().default("NORMAL"),
});

const Message = z.object({ body: z.string().min(1).max(5000) });

const DocumentUpload = z.object({
  requestId: z.string().min(1).max(120),
  fileName: z.string().min(1).max(180),
  mimeType: z.string().min(3).max(100),
  base64: z.string().min(4).max(7_100_000),
  note: z.string().max(1000).optional(),
});

const Change = z.object({
  type: z.string(),
  summary: z.string().min(8).max(2000),
  requestedData: z.record(z.string(), z.unknown()).default({}),
});

@Controller("v1/workspace")
@UseGuards(ClientDevAuthGuard)
export class WorkspaceSupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}


  @Get("support/table")
  queuePage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string) {
    return this.support.workspaceQueuePage(req,{page,pageSize,q,status});
  }

  @Get("support")
  queue(@Req() req: HeaderRequest) {
    return this.support.workspaceQueue(req);
  }

  @Get("support/tickets/:id")
  ticket(@Req() req: HeaderRequest, @Param("id") id: string) {
    return this.support.workspaceTicket(req, id);
  }

  @Post("support/tickets")
  create(@Req() req: HeaderRequest, @Body() body: unknown) {
    return this.support.createWorkspaceTicket(req, Ticket.parse(body));
  }

  @Post("support/tickets/:id/messages")
  message(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.support.addWorkspaceMessage(req, id, Message.parse(body).body);
  }

  @Post("support/tickets/:id/documents")
  document(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.support.uploadWorkspaceDocument(req, id, DocumentUpload.parse(body));
  }

  @Get("support/tickets/:ticketId/attachments/:attachmentId")
  async attachment(
    @Req() req: HeaderRequest,
    @Param("ticketId") ticketId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("download") rawDownload: string | undefined,
    @Res() reply: any,
  ) {
    const download = rawDownload === "1" || rawDownload === "true";
    const file = await this.support.workspaceAttachment(req, ticketId, attachmentId, download ? "download" : "view");
    reply.header("content-type", file.mimeType);
    reply.header("content-length", String(file.bytes.length));
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store, max-age=0");
    reply.header("cross-origin-resource-policy", "same-origin");
    reply.header("content-security-policy", "sandbox");
    reply.header("content-disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return reply.send(file.bytes);
  }

  @Post("support/tickets/:id/read")
  markRead(@Req() req: HeaderRequest, @Param("id") id: string) {
    return this.support.markWorkspaceTicketRead(req, id);
  }

  @Post("account-change-requests")
  change(@Req() req: HeaderRequest, @Body() body: unknown) {
    return this.support.requestAccountChange(req, Change.parse(body));
  }
}
