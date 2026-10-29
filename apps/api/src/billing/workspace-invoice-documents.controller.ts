import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { InvoiceDocumentsService } from "./invoice-documents.service.js";

function fileHeaders(reply: any, file: { fileName: string; mimeType: string; bytes: Buffer }, download: boolean) {
  reply.header("content-type", file.mimeType);
  reply.header("content-length", String(file.bytes.length));
  reply.header("x-content-type-options", "nosniff");
  reply.header("cache-control", "private, no-store, max-age=0");
  reply.header("cross-origin-resource-policy", "same-origin");
  reply.header("content-security-policy", "sandbox");
  reply.header("content-disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
}

@Controller("v1/workspace/billing")
@UseGuards(ClientDevAuthGuard)
export class WorkspaceInvoiceDocumentsController {
  constructor(@Inject(InvoiceDocumentsService) private readonly invoices: InvoiceDocumentsService) {}

  @Get("invoices")
  list(@Req() req: HeaderRequest) {
    return this.invoices.workspaceInvoices(req);
  }

  @Get("invoices/table")
  table(@Req() req: HeaderRequest, @Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.invoices.workspaceInvoicesPage(req,{page,pageSize});
  }

  @Get("invoice-documents/:id")
  async document(@Req() req: HeaderRequest, @Param("id") id: string, @Query("download") rawDownload: string | undefined, @Res() reply: any) {
    const download = rawDownload === "1" || rawDownload === "true";
    const file = await this.invoices.workspaceDocument(req, id, download ? "download" : "view");
    fileHeaders(reply, file, download);
    return reply.send(file.bytes);
  }
}
