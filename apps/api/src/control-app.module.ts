import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { ControlHealthController } from "./control/control-health.controller.js";
import { ControlController } from "./control/control.controller.js";
import { ControlService } from "./control/control.service.js";
import { BackofficeController } from "./control/backoffice.controller.js";
import { BackofficeService } from "./control/backoffice.service.js";
import { ControlCommercialController } from "./commercial/commercial.controller.js";
import { CommercialService } from "./commercial/commercial.service.js";
import { InternalAuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { InternalDevAuthGuard } from "./auth/dev-auth.js";
import { AuditService } from "./audit/audit.service.js";
import { BrandingService } from "./branding/branding.service.js";
import { SupportService } from "./support/support.service.js";
import { PaymentService } from "./payments/payment.service.js";
import { ControlPaymentsController } from "./payments/payment.controller.js";
import { InvoiceDocumentsService } from "./billing/invoice-documents.service.js";
import { ControlInvoiceDocumentsController } from "./billing/control-invoice-documents.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [
    ControlHealthController,
    InternalAuthController,
    ControlController,
    BackofficeController,
    ControlCommercialController,
    ControlPaymentsController,
    ControlInvoiceDocumentsController,
  ],
  providers: [
    AuthService,
    AuditService,
    BrandingService,
    SupportService,
    CommercialService,
    PaymentService,
    InvoiceDocumentsService,
    ControlService,
    BackofficeService,
    InternalDevAuthGuard,
  ],
})
export class ControlAppModule {}
