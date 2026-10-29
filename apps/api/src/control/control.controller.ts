import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { InternalDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { ControlService } from "./control.service.js";
import { RetentionLifecycleService } from "./retention-lifecycle.service.js";
import { SupportService } from "../support/support.service.js";
import { CommercialService } from "../commercial/commercial.service.js";
import { z } from "zod";

@Controller("v1/control")
@UseGuards(InternalDevAuthGuard)
export class ControlController {
  constructor(@Inject(ControlService) private readonly service: ControlService, @Inject(RetentionLifecycleService) private readonly retention: RetentionLifecycleService, @Inject(SupportService) private readonly supportService: SupportService, @Inject(CommercialService) private readonly commercialService: CommercialService) {}

  @Get("overview") overview(@Req() req: HeaderRequest) { return this.service.overview(req); }
  @Get("system-health") systemHealth(@Req() req: HeaderRequest) { return this.service.systemHealth(req); }

  @Get("tables/organizations") organizationsPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string,@Query("plan")plan?:string,@Query("risk")risk?:string){return this.service.organizationsPage(req,{page,pageSize,q,status,plan,risk});}
  @Get("tables/users") usersPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string){return this.service.usersPage(req,{page,pageSize,q});}
  @Get("tables/assessments") assessmentsPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string){return this.service.assessmentsPage(req,{page,pageSize,q,status});}
  @Get("tables/reports") reportsPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string,@Query("kind")kind?:string,@Query("delivery")delivery?:string){return this.service.reportsPage(req,{page,pageSize,q,status,kind,delivery});}
  @Get("assessments/:id/operational-detail") assessmentOperationalDetail(@Req()req:HeaderRequest,@Param("id")id:string){return this.service.assessmentOperationalDetail(req,id);}
  @Get("reports/:id/operational-detail") reportOperationalDetail(@Req()req:HeaderRequest,@Param("id")id:string,@Query("page")page?:string,@Query("pageSize")pageSize?:string){return this.service.reportOperationalDetail(req,id,{page,pageSize});}
  @Get("tables/audit") auditPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string){return this.service.auditPage(req,{page,pageSize,q});}
  @Get("organizations") organizations(@Req() req: HeaderRequest) { return this.service.organizations(req); }
  @Get("organizations/:id") organization(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.organization(req, id); }
  @Get("users") users(@Req() req: HeaderRequest) { return this.service.users(req); }
  @Get("billing") billing(@Req() req: HeaderRequest) { return this.service.billing(req); }
  @Get("tables/billing/subscriptions") billingSubscriptionsPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string,@Query("planCode")planCode?:string){return this.service.billingSubscriptionsPage(req,{page,pageSize,q,status,planCode});}
  @Get("tables/billing/payment-methods") billingMethodsPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string){return this.service.billingMethodsPage(req,{page,pageSize});}
  @Get("tables/billing/invoices") billingInvoicesPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string){return this.service.billingInvoicesPage(req,{page,pageSize});}
  @Get("tables/billing/transactions") billingTransactionsPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string){return this.service.billingTransactionsPage(req,{page,pageSize});}
  @Get("tables/usage") usagePage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string){return this.service.usagePage(req,{page,pageSize});}
  @Get("tables/operations") operationsPage(@Req() req:HeaderRequest,@Query("jobsPage")jobsPage?:string,@Query("jobsPageSize")jobsPageSize?:string,@Query("analysisPage")analysisPage?:string,@Query("analysisPageSize")analysisPageSize?:string,@Query("jobStatus")jobStatus?:string,@Query("jobType")jobType?:string,@Query("analysisStatus")analysisStatus?:string){return this.service.operationsPage(req,{jobsPage,jobsPageSize,analysisPage,analysisPageSize,jobStatus,jobType,analysisStatus});}
  @Get("usage") usage(@Req() req: HeaderRequest) { return this.service.usage(req); }
  @Get("assessments") assessments(@Req() req: HeaderRequest) { return this.service.assessments(req); }
  @Get("reports") reports(@Req() req: HeaderRequest) { return this.service.reports(req); }
  @Get("tables/support") supportPage(@Req() req: HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("view")view?:string,@Query("q")q?:string,@Query("priority")priority?:string,@Query("status")status?:string){return this.supportService.internalQueuePage(req,{page,pageSize,view,q,priority,status});}
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
  @Get("communications/deliveries/:id") communicationDelivery(@Req()req:HeaderRequest,@Param("id")id:string){return this.service.communicationDeliveryDetail(req,id);}
  @Get("communications/outbox/:id") communicationOutbox(@Req()req:HeaderRequest,@Param("id")id:string){return this.service.communicationOutboxDetail(req,id);}
  @Get("tables/legal/records") legalRecordsPage(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string,@Query("recordClass")recordClass?:string){return this.service.legalRecordsPage(req,{page,pageSize,q,status,recordClass});}
  @Get("tables/legal/interactions") legalInteractionsPage(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("action")action?:string){return this.service.legalInteractionsPage(req,{page,pageSize,q,action});}
  @Get("tables/security/events") securityEventsPage(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string){return this.service.securityEventsPage(req,{page,pageSize,q});}
  @Get("legal/versions/:id") legalVersionDetail(@Req()req:HeaderRequest,@Param("id")id:string){return this.service.legalVersionDetail(req,id);}
  @Get("legal") legal(@Req() req: HeaderRequest,@Query("view")view?:string) { return this.service.legal(req,view); }
  @Get("retention/preview") retentionPreview(@Req() req: HeaderRequest,@Query("organizationId")organizationId?:string,@Query("assessmentId")assessmentId?:string,@Query("limit")limit?:string){return this.retention.preview(req,{organizationId,assessmentId,limit:Number(limit||100)});}

  @Get("operations") operations(@Req() req: HeaderRequest) { return this.service.operations(req); }
  @Get("audit") audit(@Req() req: HeaderRequest) { return this.service.auditLog(req); }
  // P2/7: all operational tables use bounded DB pagination; summary calls remain separate.
  @Get("tables/marketplace") marketplacePage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("category")category?:string,@Query("sort")sort?:string,@Query("origin")origin?:string,@Query("visibility")visibility?:string){return this.service.marketplacePage(req,{page,pageSize,q,category,sort,origin,visibility});}
  @Get("tables/entitlements") entitlementsPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("sort")sort?:string){return this.service.entitlementsPage(req,{page,pageSize,q,sort});}
  @Get("tables/internal-users") internalUsersPage(@Req() req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("role")role?:string,@Query("status")status?:string,@Query("sort")sort?:string){return this.service.internalUsersPage(req,{page,pageSize,q,role,status,sort});}
  @Get("tables/plans-catalog") plansCatalog(@Req() req:HeaderRequest){return this.service.plansCatalog(req);}
  @Get("marketplace/:id") marketplaceDetail(@Req() req:HeaderRequest,@Param("id") id:string){return this.service.marketplaceDetail(req,id);}
  @Post("marketplace/:id/metadata") marketplaceMetadata(@Req() req:HeaderRequest,@Param("id") id:string,@Body() body:unknown){return this.service.updateMarketplaceMetadata(req,id,body);}
  @Get("marketplace") marketplace(@Req() req: HeaderRequest) { return this.service.marketplace(req); }
  @Get("security/users/:id") securityUserDetail(@Req()req:HeaderRequest,@Param("id")id:string){return this.service.securityUserDetail(req,id);}
  @Get("security") security(@Req() req: HeaderRequest,@Query("view")view?:string) { return this.service.security(req,view); }
  @Get("configuration") configuration(@Req() req: HeaderRequest,@Query("q")q?:string,@Query("view")view?:string) { return this.service.configuration(req,q,view); }
  @Post("configuration/organizations/:id/locale") updateOrganizationLocale(@Req() req:HeaderRequest,@Param("id")id:string,@Body()body:{locale?:unknown}){return this.service.updateOrganizationLocale(req,id,body?.locale);}
  @Get("governance/roles") governance(@Req() req:HeaderRequest){return this.service.governance(req);}
  @Post("legal/documents/:id/versions") createLegalVersion(@Req()req:HeaderRequest,@Param("id")id:string,@Body()body:unknown){return this.service.createLegalVersion(req,id,body);}
  @Post("legal/versions/:id/publish") publishLegalVersion(@Req()req:HeaderRequest,@Param("id")id:string,@Body()body:{reason?:unknown}){return this.service.publishLegalVersion(req,id,body?.reason);}


  @Post("support/tickets/:id/status") updateTicket(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { status?: string }) { return this.supportService.updateStatus(req, id, String(body.status ?? "")); }
  @Post("support/tickets/:id/assign-me") assignTicket(@Req() req: HeaderRequest, @Param("id") id: string) { return this.supportService.assignToMe(req, id); }
  @Post("support/tickets/:id/messages") supportMessage(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { body?: string; visibility?: string }) { return this.supportService.addInternalMessage(req, id, String(body.body ?? ""), String(body.visibility ?? "CUSTOMER")); }
  @Post("support/tickets/:id/request-information") requestInformation(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { body?: string; requestDocument?: boolean }) { return this.supportService.requestInformation(req, id, String(body.body ?? ""), Boolean(body.requestDocument)); }
  @Post("account-change-requests/:id/status") accountChange(@Req() req: HeaderRequest, @Param("id") id: string, @Body() body: { status?: string; resolutionNote?: string; requestDocument?: boolean }) { return this.supportService.updateAccountChange(req, id, String(body.status ?? ""), body.resolutionNote, Boolean(body.requestDocument)); }
  @Post("plans/clone") clonePlan(@Req() req: HeaderRequest,@Body() body:unknown){const p=z.object({sourceCode:z.string().min(1).max(80),code:z.string().min(3).max(40),name:z.string().min(3).max(100),monthlyAmountCents:z.number().int().min(0).max(10000000)}).parse(body);return this.commercialService.clonePlan(req,p);}
  @Post("internal-users/:id/role") updateInternalRole(@Req() req:HeaderRequest,@Param("id") id:string,@Body() body:{role?:unknown}){return this.service.updateInternalRole(req,id,body?.role);}
  @Post("internal-users") internalUser(@Req() req: HeaderRequest, @Body() body: unknown) { const p=z.object({email:z.string().email(),displayName:z.string().min(2).max(120),role:z.string()}).parse(body); return this.commercialService.createInternalUser(req,p); }
  @Post("assessments/:id/reprocess") reprocess(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.reprocessAssessment(req, id); }
  @Post("operations/jobs/:id/retry") retryJob(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.retryJob(req, id); }
  @Post("legal-holds/:id/release") releaseHold(@Req() req: HeaderRequest, @Param("id") id: string) { return this.service.releaseLegalHold(req, id); }
  @Post("retention/execute") executeRetention(@Req() req: HeaderRequest,@Body() body:{organizationId?:string;assessmentId?:string;limit?:number;confirm?:string}){return this.retention.execute(req,body);}
  @Post("retention/policies") upsertRetentionPolicy(@Req() req: HeaderRequest,@Body() body:any){return this.retention.upsertPolicy(req,body);}
  @Post("legal-holds") createLegalHold(@Req() req: HeaderRequest,@Body() body:any){return this.retention.createLegalHold(req,body);}

}
