import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ClientDevAuthGuard, InternalDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { PaymentService } from "./payment.service.js";

const Provider = z.enum(["REDSYS", "PAYPAL", "BANK_TRANSFER"]);
const SafeSetup = z.object({ provider: Provider, maskedLabel: z.string().max(160).optional().nullable(), brand: z.string().max(40).optional().nullable(), last4: z.string().regex(/^\d{4}$/).optional().nullable(), expiresMonth: z.coerce.number().int().min(1).max(12).optional().nullable(), expiresYear: z.coerce.number().int().min(2020).max(2200).optional().nullable(), externalReference: z.string().max(180).optional().nullable(), bankReference: z.string().max(120).optional().nullable(), paymentTermsDays: z.coerce.number().int().optional().nullable() });
const CommercialSetup = SafeSetup.extend({ status: z.enum(["READY", "VERIFIED"]).default("READY") });
const Transaction = z.object({ paymentMethodId: z.string().optional().nullable(), subscriptionId: z.string().optional().nullable(), invoiceId: z.string().optional().nullable(), provider: Provider, kind: z.enum(["CHARGE", "REFUND", "TRANSFER"]), status: z.enum(["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "AWAITING_TRANSFER", "RECONCILED", "CANCELED"]), amountCents: z.coerce.number().int().nonnegative(), currency: z.string().length(3).optional(), externalReference: z.string().max(180).optional().nullable(), bankReference: z.string().max(120).optional().nullable(), failureCode: z.string().max(80).optional().nullable() });

@Controller("v1/workspace/billing/payment-methods")
@UseGuards(ClientDevAuthGuard)
export class WorkspacePaymentsController {
  constructor(@Inject(PaymentService) private readonly service: PaymentService) {}
  @Get() list(@Req() req: HeaderRequest) { return this.service.workspaceSummary(req); }
  @Post() requestChange(@Req() req: HeaderRequest, @Body() body: unknown) { return this.service.requestWorkspaceMethod(req, SafeSetup.parse(body)); }
}

@Controller("v1/control")
@UseGuards(InternalDevAuthGuard)
export class ControlPaymentsController {
  constructor(@Inject(PaymentService) private readonly service: PaymentService) {}
  @Post("sales/:id/payment-setup") commercial(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) { return this.service.configureCommercial(req, id, CommercialSetup.parse(body)); }
  @Get("organizations/:id/payments") organization(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.organizationSummary(req, id); }
  @Post("organizations/:id/payment-methods/:methodId/activate") activate(@Req() req: HeaderRequest, @Param("id") id: string, @Param("methodId") methodId: string) { return this.service.activateMethod(req, id, methodId); }
  @Post("organizations/:id/payment-transactions") transaction(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: unknown) { return this.service.recordTransaction(req, id, Transaction.parse(body)); }
}
