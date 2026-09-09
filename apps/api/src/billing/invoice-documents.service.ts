import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { requireCapability } from "../auth/access-control.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "../control/internal-access.js";
import { buildInvoicePdf, type InvoicePdfSnapshot } from "./invoice-pdf.js";
import { buildStoredZip } from "./zip.js";

type DownloadMode = "view" | "download";

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function safeFileName(value: string) {
  const clean = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "invoice";
}

function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

@Injectable()
export class InvoiceDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async findInvoice(id: string) {
    return this.db.billingInvoice.findUnique({
      where: { id },
      include: { organization: true, documentRecord: { include: { blob: true } } },
    });
  }

  private snapshot(invoice: any): InvoicePdfSnapshot {
    const raw = object(invoice.billingSnapshot);
    const issuer = object(raw.issuer);
    const customer = object(raw.customer);
    const rawLines = Array.isArray(raw.lines) ? raw.lines.map(object) : [];
    const subtotalCents = number(raw.subtotalCents, number(raw.baseCents, invoice.amountCents));
    const taxCents = number(raw.taxCents, invoice.taxCents);
    const totalCents = number(raw.totalCents, subtotalCents + taxCents);
    const taxRate = typeof raw.taxRate === "number" ? raw.taxRate : (subtotalCents > 0 && taxCents > 0 ? taxCents / subtotalCents * 100 : null);
    const plan = typeof raw.plan === "string" && raw.plan.trim() ? raw.plan.trim() : "PROOFLINE";
    const lines = rawLines.length ? rawLines.map((line) => ({
      description: String(line.description ?? line.name ?? plan),
      quantity: Math.max(1, number(line.quantity, 1)),
      unitPriceCents: number(line.unitPriceCents, number(line.amountCents, subtotalCents)),
      amountCents: number(line.amountCents, subtotalCents),
    })) : [{ description: plan, quantity: 1, unitPriceCents: subtotalCents, amountCents: subtotalCents }];

    return {
      locale: invoice.organization.defaultLocale === "en" ? "en" : "es",
      invoiceNumber: invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id,
      status: invoice.status,
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: invoice.dueAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      currency: invoice.currency,
      subtotalCents,
      taxCents,
      totalCents,
      taxRate,
      issuer: {
        name: String(issuer.name ?? process.env.PROOFLINE_INVOICE_ISSUER_NAME ?? "ARMAR TECHNOLOGIES · PROOFLINE"),
        taxId: issuer.taxId ?? process.env.PROOFLINE_INVOICE_ISSUER_TAX_ID ?? null,
        address: issuer.address ?? process.env.PROOFLINE_INVOICE_ISSUER_ADDRESS ?? null,
        email: issuer.email ?? process.env.PROOFLINE_INVOICE_ISSUER_EMAIL ?? null,
      },
      customer: {
        name: String(customer.name ?? invoice.organization.name),
        legalName: customer.legalName ?? invoice.organization.legalName,
        taxId: customer.taxId ?? invoice.organization.taxId,
        address: customer.address ?? customer.billingAddress ?? null,
        country: customer.country ?? invoice.organization.country,
        billingEmail: customer.billingEmail ?? invoice.organization.billingEmail,
      },
      lines,
      paymentMethod: typeof raw.paymentMethod === "string" ? raw.paymentMethod : null,
      paymentReference: typeof raw.paymentReference === "string" ? raw.paymentReference : (typeof raw.paymentRef === "string" ? raw.paymentRef : null),
      servicePeriod: typeof raw.servicePeriod === "string" ? raw.servicePeriod : null,
      notes: typeof raw.notes === "string" ? raw.notes : null,
    };
  }

  private async materialize(invoice: any) {
    if (invoice.status === "DRAFT") {
      throw new BadRequestException({
        code: "INVOICE_NOT_ISSUED",
        message: "Draft invoices do not have a final document.",
      });
    }

    const existingBlob = invoice.documentRecord?.blob;
    const existingBytes = existingBlob ? Buffer.from(existingBlob.bytes) : null;
    const existingMetadata = object(invoice.documentRecord?.metadata);
    const currentLayoutVersion = number(existingMetadata.invoiceLayoutVersion, 0);
    const generatedByProofline = existingMetadata.materializedFromBillingLedger === true;
    const looksLikeLegacyPlaceholder = Boolean(
      existingBytes &&
      existingBytes.length < 12000 &&
      existingMetadata.invoiceId === invoice.id &&
      existingBytes.toString("latin1").includes("PROOFLINE")
    );
    const requiresUpgrade = Boolean(
      existingBytes &&
      ((generatedByProofline && currentLayoutVersion < 3) || looksLikeLegacyPlaceholder)
    );

    // Preserve externally supplied or already-current invoice PDFs exactly as issued.
    if (existingBytes && !requiresUpgrade) {
      return {
        bytes: existingBytes,
        fileName: invoice.documentRecord!.fileName,
        mimeType: invoice.documentRecord!.mimeType || "application/pdf",
      };
    }

    const snapshot = this.snapshot(invoice);
    const bytes = buildInvoicePdf(snapshot);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const fileName = `${safeFileName(snapshot.invoiceNumber)}.pdf`;
    const title = `${snapshot.locale === "es" ? "Factura" : "Invoice"} ${snapshot.invoiceNumber}`;
    const retentionUntil = new Date(invoice.issuedAt.getTime() + 2190 * 86400000);
    const metadata = {
      ...existingMetadata,
      invoiceId: invoice.id,
      invoiceNumber: snapshot.invoiceNumber,
      materializedFromBillingLedger: true,
      materializedAt: new Date().toISOString(),
      snapshotVersion: 3,
      invoiceLayoutVersion: 3,
      ...(requiresUpgrade && invoice.documentRecord?.id
        ? { supersedesDocumentRecordId: invoice.documentRecord.id }
        : {}),
    };

    // If C2.4.6 (or an older local placeholder) already produced a blob, do not
    // mutate that immutable evidence. Create a new document version and relink
    // the invoice, leaving the previous record retained for audit purposes.
    if (requiresUpgrade && invoice.documentRecord) {
      const previousDocumentRecordId = invoice.documentRecord.id;
      const newRecord = await this.db.$transaction(async (tx) => {
        const record = await tx.documentRecord.create({
          data: {
            organizationId: invoice.organizationId,
            recordClass: "ACCOUNTING_INVOICE",
            documentType: "INVOICE",
            title,
            fileName,
            mimeType: "application/pdf",
            contentHash: hash,
            version: Math.max(2, number(invoice.documentRecord.version, 1) + 1),
            immutable: true,
            retentionUntil: invoice.documentRecord.retentionUntil ?? retentionUntil,
            metadata: metadata as any,
            blob: { create: { bytes } },
          },
        });
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: { documentRecordId: record.id },
        });
        return record;
      });

      await this.audit.record({
        organizationId: invoice.organizationId,
        actorType: "SYSTEM",
        actorId: "invoice-document-service",
        action: "BILLING_INVOICE_DOCUMENT_SUPERSEDED",
        targetType: "BillingInvoice",
        targetId: invoice.id,
        metadata: {
          invoiceNumber: snapshot.invoiceNumber,
          previousDocumentRecordId,
          documentRecordId: newRecord.id,
          contentHash: hash,
          invoiceLayoutVersion: 3,
        },
      });

      return { bytes, fileName, mimeType: "application/pdf" };
    }

    if (invoice.documentRecord) {
      await this.db.$transaction(async (tx) => {
        await tx.documentRecord.update({
          where: { id: invoice.documentRecord!.id },
          data: {
            title,
            fileName,
            mimeType: "application/pdf",
            contentHash: hash,
            immutable: true,
            retentionUntil: invoice.documentRecord!.retentionUntil ?? retentionUntil,
            metadata: metadata as any,
          },
        });
        await tx.documentBlob.upsert({
          where: { documentRecordId: invoice.documentRecord!.id },
          create: { documentRecordId: invoice.documentRecord!.id, bytes },
          update: { bytes },
        });
      });
    } else {
      await this.db.$transaction(async (tx) => {
        const record = await tx.documentRecord.create({
          data: {
            organizationId: invoice.organizationId,
            recordClass: "ACCOUNTING_INVOICE",
            documentType: "INVOICE",
            title,
            fileName,
            mimeType: "application/pdf",
            contentHash: hash,
            version: 1,
            immutable: true,
            retentionUntil,
            metadata: metadata as any,
            blob: { create: { bytes } },
          },
        });
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: { documentRecordId: record.id },
        });
      });
    }

    await this.audit.record({
      organizationId: invoice.organizationId,
      actorType: "SYSTEM",
      actorId: "invoice-document-service",
      action: "BILLING_INVOICE_DOCUMENT_MATERIALIZED",
      targetType: "BillingInvoice",
      targetId: invoice.id,
      metadata: {
        invoiceNumber: snapshot.invoiceNumber,
        contentHash: hash,
        invoiceLayoutVersion: 3,
      },
    });
    return { bytes, fileName, mimeType: "application/pdf" };
  }

  async workspaceInvoices(req: HeaderRequest) {
    const ctx = await requireCapability(this.db, req, "billing.invoices");
    return this.db.billingInvoice.findMany({
      where: { organizationId: ctx.organization.id, status: { not: "DRAFT" } },
      select: { id: true, invoiceNumber: true, externalRef: true, amountCents: true, taxCents: true, currency: true, status: true, issuedAt: true, dueAt: true, paidAt: true, documentRecordId: true },
      orderBy: { issuedAt: "desc" },
    });
  }

  async workspaceDocument(req: HeaderRequest, id: string, mode: DownloadMode) {
    const ctx = await requireCapability(this.db, req, "billing.invoices");
    const invoice = await this.findInvoice(id);
    if (!invoice || invoice.organizationId !== ctx.organization.id || invoice.status === "DRAFT") throw new NotFoundException("Invoice not found");
    const file = await this.materialize(invoice);
    await this.audit.record({
      organizationId: invoice.organizationId,
      actorType: "USER",
      actorId: ctx.identity.email,
      action: mode === "download" ? "BILLING_INVOICE_DOWNLOADED" : "BILLING_INVOICE_VIEWED",
      targetType: "BillingInvoice",
      targetId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id },
    });
    return file;
  }

  async controlDocument(req: HeaderRequest, id: string, mode: DownloadMode) {
    const ctx = requireInternalCapability(req, "billing.read");
    const invoice = await this.findInvoice(id);
    if (!invoice || invoice.status === "DRAFT") throw new NotFoundException("Issued invoice not found");
    const file = await this.materialize(invoice);
    await this.audit.record({
      organizationId: invoice.organizationId,
      actorType: "INTERNAL",
      actorId: ctx.identity.email,
      action: mode === "download" ? "BILLING_INVOICE_DOWNLOADED" : "BILLING_INVOICE_VIEWED",
      targetType: "BillingInvoice",
      targetId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id, actorRole: ctx.identity.role },
    });
    return file;
  }

  async controlExport(req: HeaderRequest, year?: number | null) {
    const ctx = requireInternalCapability(req, "billing.read");
    if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2200)) throw new BadRequestException("Invalid invoice year");
    const where: any = { status: { not: "DRAFT" } };
    if (year != null) where.issuedAt = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
    const invoices = await this.db.billingInvoice.findMany({
      where,
      include: { organization: true, documentRecord: { include: { blob: true } } },
      orderBy: [{ issuedAt: "asc" }, { invoiceNumber: "asc" }],
    });
    if (!invoices.length) throw new NotFoundException("No issued invoices found for export");

    const entries: Array<{ name: string; bytes: Buffer }> = [];
    const manifest = ["invoice_number,issued_at,status,customer,tax_id,subtotal,tax,total,currency"];
    for (const invoice of invoices) {
      const file = await this.materialize(invoice);
      const numberValue = invoice.invoiceNumber ?? invoice.externalRef ?? invoice.id;
      const customer = invoice.organization.legalName ?? invoice.organization.name;
      const prefix = invoice.issuedAt.toISOString().slice(0, 10);
      entries.push({ name: `invoices/${prefix}_${safeFileName(numberValue)}_${safeFileName(customer)}.pdf`, bytes: file.bytes });
      const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      manifest.push([
        csv(numberValue), csv(invoice.issuedAt.toISOString().slice(0, 10)), csv(invoice.status), csv(customer), csv(invoice.organization.taxId),
        csv((invoice.amountCents / 100).toFixed(2)), csv((invoice.taxCents / 100).toFixed(2)), csv(((invoice.amountCents + invoice.taxCents) / 100).toFixed(2)), csv(invoice.currency),
      ].join(","));
    }
    entries.unshift({ name: "manifest.csv", bytes: Buffer.from(manifest.join("\r\n") + "\r\n", "utf8") });
    const bytes = buildStoredZip(entries);
    const fileName = year != null ? `proofline-invoices-${year}.zip` : "proofline-invoices-all.zip";
    await this.audit.record({
      actorType: "INTERNAL",
      actorId: ctx.identity.email,
      action: "BILLING_INVOICE_ARCHIVE_EXPORTED",
      targetType: "BillingInvoice",
      metadata: { year: year ?? "ALL", invoiceCount: invoices.length, actorRole: ctx.identity.role },
    });
    return { bytes, fileName, invoiceCount: invoices.length };
  }
}
