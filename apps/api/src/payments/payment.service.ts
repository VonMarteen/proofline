import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import { requireCapability } from "../auth/access-control.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { internalContext, requireInternalCapability } from "../control/internal-access.js";
import { PrismaService } from "../database/prisma.service.js";
import { bankTransferInstructions, PAYMENT_PROVIDER_CAPABILITIES } from "./payment-providers.js";
import { manualPaymentEvidenceError } from "./manual-payment-evidence.js";

export type SafePaymentSetup = {
  provider: "REDSYS" | "PAYPAL" | "BANK_TRANSFER";
  maskedLabel?: string | null;
  brand?: string | null;
  last4?: string | null;
  expiresMonth?: number | null;
  expiresYear?: number | null;
  externalReference?: string | null;
  bankReference?: string | null;
  paymentTermsDays?: number | null;
};

export function paymentType(provider: SafePaymentSetup["provider"]) {
  if (provider === "REDSYS") return "CARD" as const;
  if (provider === "PAYPAL") return "PAYPAL" as const;
  return "BANK_TRANSFER" as const;
}

export function sanitizePaymentSetup(input: SafePaymentSetup) {
  const terms = input.provider === "BANK_TRANSFER" ? Number(input.paymentTermsDays ?? 0) : 0;
  if (![0, 15, 30, 60].includes(terms)) throw new BadRequestException("Payment terms must be 0, 15, 30 or 60 days");
  const last4 = input.last4?.trim() || null;
  if (last4 && !/^\d{4}$/.test(last4)) throw new BadRequestException("Only the last four card digits may be stored");
  const brand = input.brand?.trim().slice(0, 40) || null;
  const maskedLabel = input.maskedLabel?.trim().slice(0, 160) || null;
  if (maskedLabel && input.provider === "REDSYS" && maskedLabel.replace(/\D/g, "").length > 4) throw new BadRequestException("Do not store a full card number in Proofline; only a masked label or last four digits are allowed");
  if (maskedLabel && /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(maskedLabel.replace(/\s+/g, ""))) throw new BadRequestException("Customer bank account identifiers must not be stored as a payment-method label");
  const externalReference = input.externalReference?.trim().slice(0, 180) || null;
  const bankReference = input.bankReference?.trim().slice(0, 120) || null;
  const expiresMonth = input.expiresMonth == null ? null : Number(input.expiresMonth);
  const expiresYear = input.expiresYear == null ? null : Number(input.expiresYear);
  if (expiresMonth != null && (!Number.isInteger(expiresMonth) || expiresMonth < 1 || expiresMonth > 12)) throw new BadRequestException("Invalid expiration month");
  if (expiresYear != null && (!Number.isInteger(expiresYear) || expiresYear < 2020 || expiresYear > 2200)) throw new BadRequestException("Invalid expiration year");
  return { provider: input.provider, type: paymentType(input.provider), maskedLabel, brand, last4, expiresMonth, expiresYear, externalReference, bankReference, paymentTermsDays: terms };
}


function safeMethodView(method: any) {
  return {
    id: method.id, organizationId: method.organizationId, provider: method.provider, type: method.type, status: method.status, isDefault: method.isDefault,
    maskedLabel: method.maskedLabel, brand: method.brand, last4: method.last4, expiresMonth: method.expiresMonth, expiresYear: method.expiresYear,
    bankReference: method.bankReference, paymentTermsDays: method.paymentTermsDays, createdByType: method.createdByType, createdBy: method.createdBy, createdAt: method.createdAt, activatedAt: method.activatedAt, replacedAt: method.replacedAt, revokedAt: method.revokedAt,
    externalReference: method.externalReference ? `…${String(method.externalReference).slice(-8)}` : null,
  };
}


function safeTransactionView(transaction: any) {
  return {
    id: transaction.id, organizationId: transaction.organizationId, subscriptionId: transaction.subscriptionId, invoiceId: transaction.invoiceId, paymentMethodId: transaction.paymentMethodId,
    provider: transaction.provider, kind: transaction.kind, status: transaction.status, amountCents: transaction.amountCents, currency: transaction.currency,
    externalReference: transaction.externalReference ? `…${String(transaction.externalReference).slice(-8)}` : null, bankReference: transaction.bankReference, failureCode: transaction.failureCode,
    occurredAt: transaction.occurredAt, settledAt: transaction.settledAt, createdAt: transaction.createdAt,
    evidenceSource: transaction.metadata && typeof transaction.metadata === "object" ? (transaction.metadata as Record<string, unknown>).evidenceSource ?? ((transaction.metadata as Record<string, unknown>).manual ? "LEGACY_MANUAL_ENTRY" : "UNKNOWN") : "UNKNOWN",
  };
}

function paymentCapability(req: HeaderRequest) {
  const ctx = internalContext(req);
  if (!ctx.capabilities.includes("*") && !ctx.capabilities.includes("billing.manage") && !ctx.capabilities.includes("sales.manage")) {
    throw new ForbiddenException("Internal billing or sales management capability required");
  }
  return ctx;
}

@Injectable()
export class PaymentService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async workspaceSummary(req: HeaderRequest) {
    const { organization } = await requireCapability(this.db, req, "billing.view");
    const [methods, events, transactions] = await Promise.all([
      this.db.paymentMethod.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } }),
      this.db.paymentMethodEvent.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.paymentTransaction.findMany({ where: { organizationId: organization.id }, orderBy: { occurredAt: "desc" }, take: 100 }),
    ]);
    return {
      current: (()=>{const m=methods.find(m => m.isDefault && m.status === "ACTIVE") ?? methods.find(m => m.status === "ACTIVE") ?? null;return m?safeMethodView(m):null;})(),
      methods: methods.map(safeMethodView),
      history: events,
      transactions: transactions.map(safeTransactionView),
      providers: ["REDSYS", "PAYPAL", "BANK_TRANSFER"],
      providerCapabilities: PAYMENT_PROVIDER_CAPABILITIES,
      bankTransferInstructions: bankTransferInstructions(),
      connectionState: { redsys: "adapter-contract-ready", paypal: "adapter-contract-ready", bankTransfer: "manual-reconciliation-ready" },
    };
  }

  async requestWorkspaceMethod(req: HeaderRequest, input: SafePaymentSetup) {
    const ctx = await requireCapability(this.db, req, "billing.manage");
    const safe = sanitizePaymentSetup(input);
    const method = await this.db.paymentMethod.create({
      data: {
        organizationId: ctx.organization.id,
        provider: safe.provider,
        type: safe.type,
        status: "PENDING",
        isDefault: false,
        externalReference: safe.externalReference,
        maskedLabel: safe.maskedLabel,
        brand: safe.brand,
        last4: safe.last4,
        expiresMonth: safe.expiresMonth,
        expiresYear: safe.expiresYear,
        bankReference: safe.bankReference,
        paymentTermsDays: safe.paymentTermsDays,
        createdByType: "USER",
        createdBy: ctx.identity.email,
      },
    });
    await this.db.paymentMethodEvent.create({ data: { organizationId: ctx.organization.id, paymentMethodId: method.id, eventType: "CHANGE_REQUESTED", actorType: "USER", actorId: ctx.identity.email, metadata: { provider: safe.provider, type: safe.type, paymentTermsDays: safe.paymentTermsDays } } });
    await this.audit.record({ organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.identity.email, action: "PAYMENT_METHOD_CHANGE_REQUESTED", targetType: "PaymentMethod", targetId: method.id, metadata: { provider: safe.provider, type: safe.type } });
    return { ok: true, method: safeMethodView(method), requiresInternalActivation: true };
  }

  async configureCommercial(req: HeaderRequest, id: string, input: SafePaymentSetup & { status?: "READY" | "VERIFIED" }) {
    const ctx = paymentCapability(req);
    const request = await this.db.commercialRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Commercial request not found");
    if (request.stage === "LOST" || request.stage === "PROVISIONED") throw new BadRequestException("Payment setup cannot be changed in this commercial stage");
    const safe = sanitizePaymentSetup(input);
    if (safe.provider === "REDSYS" && !safe.last4 && !safe.maskedLabel && !safe.externalReference) throw new BadRequestException("Redsys setup needs a safe masked descriptor, last four digits or an external provider reference");
    if (safe.provider === "PAYPAL" && !safe.maskedLabel && !safe.externalReference) throw new BadRequestException("PayPal setup needs a safe account label or an external provider reference");
    // P6: no connected Redsys/PayPal adapter or verified webhook in this release.
    // A manually entered masked descriptor must never be treated as external payment verification.
    if(input.status==="VERIFIED" && (safe.provider!=="BANK_TRANSFER" || !safe.bankReference))
      throw new BadRequestException("VERIFIED requires a documented bank transfer reference; card and PayPal provider verification is not connected");
    const status = input.status === "VERIFIED" ? "VERIFIED" : "READY";
    const updated = await this.db.commercialRequest.update({
      where: { id },
      data: {
        paymentProvider: safe.provider,
        paymentStatus: status,
        paymentTermsDays: safe.paymentTermsDays,
        paymentSetup: safe as any,
        paymentReadyAt: new Date(),
      },
    });
    await this.audit.record({ actorType: "INTERNAL", actorId: ctx.identity.email, action: "COMMERCIAL_PAYMENT_SETUP_READY", targetType: "CommercialRequest", targetId: id, metadata: { provider: safe.provider, status, paymentTermsDays: safe.paymentTermsDays } });
    return { ok: true, paymentProvider: updated.paymentProvider, paymentStatus: updated.paymentStatus, paymentReadyAt: updated.paymentReadyAt };
  }

  async activateMethod(req: HeaderRequest, organizationId: string, methodId: string) {
    const ctx = requireInternalCapability(req, "billing.manage");
    const method = await this.db.paymentMethod.findFirst({ where: { id: methodId, organizationId } });
    if (!method) throw new NotFoundException("Payment method not found");
    if (method.status === "REVOKED" || method.status === "FAILED") throw new BadRequestException("Payment method cannot be activated");
    if (method.status === "ACTIVE" && method.isDefault) return { ok:true, alreadyActive:true };
    const previous = await this.db.paymentMethod.findFirst({ where: { organizationId, isDefault: true, status: "ACTIVE" } });
    await this.db.$transaction(async tx => {
      if (previous && previous.id !== method.id) await tx.paymentMethod.update({ where: { id: previous.id }, data: { status: "REPLACED", isDefault: false, replacedAt: new Date() } });
      await tx.paymentMethod.update({ where: { id: method.id }, data: { status: "ACTIVE", isDefault: true, activatedAt: method.activatedAt ?? new Date(), replacedAt: null, revokedAt: null } });
      await tx.paymentMethodEvent.create({ data: { organizationId, paymentMethodId: method.id, previousPaymentMethodId: previous?.id ?? null, eventType: previous && previous.id !== method.id ? "REPLACED_DEFAULT" : "ACTIVATED", actorType: "INTERNAL", actorId: ctx.identity.email, metadata: { provider: method.provider, previousProvider: previous?.provider ?? null } } });
    });
    await this.audit.record({ organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "PAYMENT_METHOD_ACTIVATED", targetType: "PaymentMethod", targetId: method.id, metadata: { previousPaymentMethodId: previous?.id ?? null, provider: method.provider } });
    return { ok: true };
  }

  async recordTransaction(req: HeaderRequest, organizationId: string, input: { paymentMethodId?: string | null; subscriptionId?: string | null; invoiceId?: string | null; provider: SafePaymentSetup["provider"]; kind: "CHARGE" | "REFUND" | "TRANSFER"; status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED" | "AWAITING_TRANSFER" | "RECONCILED" | "CANCELED"; amountCents: number; currency?: string; externalReference?: string | null; bankReference?: string | null; failureCode?: string | null }) {
    const ctx = requireInternalCapability(req, "billing.manage");
    const evidenceError = manualPaymentEvidenceError(input);
    if (evidenceError) throw new BadRequestException(evidenceError);
    const method=input.paymentMethodId?await this.db.paymentMethod.findFirst({ where: { id: input.paymentMethodId, organizationId } }):null;
    if (input.paymentMethodId && !method) throw new BadRequestException("Payment method does not belong to organization");
    if (method && method.provider!==input.provider) throw new BadRequestException("Transaction provider must match the selected payment method");
    if (input.subscriptionId && !(await this.db.subscription.findFirst({where:{id:input.subscriptionId,organizationId}}))) throw new BadRequestException("Subscription does not belong to organization");
    if (input.invoiceId && !(await this.db.billingInvoice.findFirst({where:{id:input.invoiceId,organizationId}}))) throw new BadRequestException("Invoice does not belong to organization");
    const transaction = await this.db.paymentTransaction.create({ data: { organizationId, paymentMethodId: input.paymentMethodId ?? null, subscriptionId: input.subscriptionId ?? null, invoiceId: input.invoiceId ?? null, provider: input.provider, kind: input.kind, status: input.status, amountCents: input.amountCents, currency: (input.currency || "EUR").slice(0, 3).toUpperCase(), externalReference: input.externalReference?.trim().slice(0, 180) || null, bankReference: input.bankReference?.trim().slice(0, 120) || null, failureCode: input.failureCode?.trim().slice(0, 80) || null, metadata: { recordedBy: ctx.identity.email, manual: true, evidenceSource: input.provider === "BANK_TRANSFER" && input.status === "RECONCILED" ? "BANK_REFERENCE_DECLARED" : "MANUAL_ENTRY_UNVERIFIED" }, settledAt: ["CAPTURED", "REFUNDED", "RECONCILED"].includes(input.status) ? new Date() : null } });
    await this.audit.record({ organizationId, actorType: "INTERNAL", actorId: ctx.identity.email, action: "PAYMENT_TRANSACTION_RECORDED", targetType: "PaymentTransaction", targetId: transaction.id, metadata: { provider: input.provider, kind: input.kind, status: input.status, amountCents: input.amountCents, evidenceSource: input.provider === "BANK_TRANSFER" && input.status === "RECONCILED" ? "BANK_REFERENCE_DECLARED" : "MANUAL_ENTRY_UNVERIFIED" } });
    return { ok: true, transaction };
  }

  async organizationSummary(req: HeaderRequest, organizationId: string) {
    requireInternalCapability(req, "organizations.read");
    const org = await this.db.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException("Organization not found");
    const [methods, events, transactions] = await Promise.all([
      this.db.paymentMethod.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      this.db.paymentMethodEvent.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.paymentTransaction.findMany({ where: { organizationId }, orderBy: { occurredAt: "desc" }, take: 100 }),
    ]);
    const current=methods.find(m => m.isDefault && m.status === "ACTIVE") ?? methods.find(m => m.status === "ACTIVE") ?? null;
    return { current: current?safeMethodView(current):null, methods:methods.map(safeMethodView), history: events, transactions:transactions.map(safeTransactionView), providerCapabilities:PAYMENT_PROVIDER_CAPABILITIES };
  }
}
