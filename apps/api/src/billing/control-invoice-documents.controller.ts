import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { InternalDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { InvoiceDocumentsService } from "./invoice-documents.service.js";

function pdfHeaders(reply: any, file: { fileName: string; mimeType: string; bytes: Buffer }, download: boolean) {
  reply.header("content-type", file.mimeType);
  reply.header("content-length", String(file.bytes.length));
  reply.header("x-content-type-options", "nosniff");
  reply.header("cache-control", "private, no-store, max-age=0");
  reply.header("cross-origin-resource-policy", "same-origin");
  reply.header("content-security-policy", "sandbox");
  reply.header("content-disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
}

@Controller("v1/control/billing")
@UseGuards(InternalDevAuthGuard)
export class ControlInvoiceDocumentsController {
  constructor(@Inject(InvoiceDocumentsService) private readonly invoices: InvoiceDocumentsService) {}

  @Get("invoice-documents/:id")
  async document(@Req() req: HeaderRequest, @Param("id") id: string, @Query("download") rawDownload: string | undefined, @Res() reply: any) {
    const download = rawDownload === "1" || rawDownload === "true";
    const file = await this.invoices.controlDocument(req, id, download ? "download" : "view");
    pdfHeaders(reply, file, download);
    return reply.send(file.bytes);
  }

  @Get("invoice-export")
  async export(@Req() req: HeaderRequest, @Query("year") rawYear: string | undefined, @Res() reply: any) {
    const year = rawYear ? Number(rawYear) : null;
    const archive = await this.invoices.controlExport(req, year);
    reply.header("content-type", "application/zip");
    reply.header("content-length", String(archive.bytes.length));
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store, max-age=0");
    reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(archive.fileName)}`);
    return reply.send(archive.bytes);
  }
}
