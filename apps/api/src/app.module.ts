import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { PublicController } from "./public/public.controller.js";
import { LegalController } from "./legal/legal.controller.js";
import { AssessmentsController } from "./assessments/assessments.controller.js";
import { AssessmentsService } from "./assessments/assessments.service.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { RespondController } from "./respond/respond.controller.js";
import { InternalController } from "./internal/internal.controller.js";
import { WorkspaceController } from "./workspace.controller.js";
import { ReportsController } from "./reports/reports.controller.js";
import { ReportService } from "./reports/report.service.js";
import { ImportsController } from "./imports/imports.controller.js";
import { ImportService } from "./imports/import.service.js";
import { AuditService } from "./audit/audit.service.js";
import { BrandingService } from "./branding/branding.service.js";
import { ClientDevAuthGuard, ServiceTokenGuard } from "./auth/dev-auth.js";
import { ClientAuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { SupportService } from "./support/support.service.js";
import { WorkspaceSupportController } from "./support/workspace-support.controller.js";
import { CommercialService } from "./commercial/commercial.service.js";
import { PublicCommercialController } from "./commercial/commercial.controller.js";
import { PaymentService } from "./payments/payment.service.js";
import { WorkspacePaymentsController } from "./payments/payment.controller.js";
import { InvoiceDocumentsService } from "./billing/invoice-documents.service.js";
import { WorkspaceInvoiceDocumentsController } from "./billing/workspace-invoice-documents.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    PublicController,
    PublicCommercialController,
    ClientAuthController,
    LegalController,
    AssessmentsController,
    DashboardController,
    RespondController,
    InternalController,
    WorkspaceController,
    WorkspacePaymentsController,
    WorkspaceInvoiceDocumentsController,
    WorkspaceSupportController,
    ReportsController,
    ImportsController,
  ],
  providers: [
    AssessmentsService,
    ReportService,
    ImportService,
    AuditService,
    BrandingService,
    AuthService,
    SupportService,
    CommercialService,
    PaymentService,
    InvoiceDocumentsService,
    ClientDevAuthGuard,
    ServiceTokenGuard,
  ],
})
export class AppModule {}
