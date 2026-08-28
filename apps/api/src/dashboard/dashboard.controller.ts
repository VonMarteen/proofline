import { Controller,Get,Inject,Query,Req,UseGuards } from "@nestjs/common";
import { accessContext, permittedAssessmentIds } from "../auth/access-control.js";
import { ClientDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";

@Controller("v1/dashboard")
@UseGuards(ClientDevAuthGuard)
export class DashboardController{
 constructor(@Inject(PrismaService)private db:PrismaService){}
 @Get()async get(@Query("locale")lr?:string,@Req()req?:HeaderRequest){
  if(!req)return{empty:true};
  const locale=lr==="en"?"en":"es";
  const access=await accessContext(this.db,req);
  const permitted=await permittedAssessmentIds(this.db,req);
  const org=access.organization;
  const where={organizationId:org.id,...(permitted.unrestricted?{}:{id:{in:permitted.ids}})};
  const [assessments,memberCount,people,units,reports,sub,activity]=await Promise.all([
    access.capabilities.includes("assessment.read")?this.db.assessment.findMany({where,include:{participants:true,questions:true,legalProfile:true,audienceTargets:true,resultRecipients:{where:{active:true}},reports:true,frameworkVersion:{include:{framework:true}}},orderBy:{updatedAt:"desc"}}):Promise.resolve([]),
    this.db.membership.count({where:{organizationId:org.id}}),
    access.capabilities.includes("directory.manage")?this.db.directoryPerson.count({where:{organizationId:org.id,status:"ACTIVE"}}):Promise.resolve(0),
    access.capabilities.includes("directory.manage")?this.db.organizationUnit.count({where:{organizationId:org.id}}):Promise.resolve(0),
    access.capabilities.some(c=>["results.read","results.authorized_read"].includes(c))?this.db.report.findMany({where:{assessment:where}}):Promise.resolve([]),
    access.capabilities.includes("billing.view")?this.db.subscription.findFirst({where:{organizationId:org.id},include:{plan:true},orderBy:{createdAt:"desc"}}):Promise.resolve(null),
    this.db.auditEvent.findMany({where:{organizationId:org.id},take:8,orderBy:{createdAt:"desc"}})
  ]);
  const completed=assessments.reduce((n,x)=>n+x.participants.filter(p=>p.status==="COMPLETED").length,0),total=assessments.reduce((n,x)=>n+x.participants.length,0),ready=assessments.filter(x=>x.readinessScore!=null);
  const map=(x:any)=>{const c=x.participants.filter((p:any)=>p.status==="COMPLETED").length,t=x.participants.length;return{id:x.id,title:x.title,objective:x.objective,status:x.status,readinessScore:x.readinessScore,questions:x.questions.length,participants:{total:t,completed:c,rate:t?Math.round(c/t*100):0},resultRecipients:x.resultRecipients.length,reports:x.reports.length,framework:x.frameworkVersion?.framework?{name:x.frameworkVersion.framework.name}:null,updatedAt:x.updatedAt}};
  const mapped=assessments.map(map);
  return{
    organization:{id:org.id,name:org.name,slug:org.slug,billingEmail:org.billingEmail},
    user:{name:access.user.displayName,email:access.user.email,role:access.role,capabilities:access.capabilities},
    summary:{assessments:assessments.length,activeAssessments:assessments.filter(x=>x.status==="ACTIVE").length,draftsAndReview:assessments.filter(x=>["DRAFT","PREPARATION","REVIEW"].includes(x.status)).length,participants:total,completedResponses:completed,participationRate:total?Math.round(completed/total*100):0,teamMembers:memberCount,directoryPeople:people,units,avgReadiness:ready.length?Math.round(ready.reduce((n,x)=>n+(x.readinessScore??0),0)/ready.length):0,reportsPending:reports.filter(r=>r.status==="DRAFT").length,reportsDistributed:reports.filter(r=>r.status==="DISTRIBUTED").length},
    stateCounts:Object.fromEntries(["DRAFT","PREPARATION","REVIEW","READY","ACTIVE","CLOSED","ARCHIVED"].map(s=>[s,assessments.filter(x=>x.status===s).length])),
    billingVisible:access.capabilities.includes("billing.view"),
    subscription:sub?{status:sub.status,plan:sub.plan.name,renewsAt:sub.renewsAt,amountCents:sub.plan.monthlyAmountCents,currency:sub.plan.currency}:null,
    activeAssessments:mapped.filter(x=>x.status==="ACTIVE"),
    assessments:mapped.slice(0,8),
    recentActivity:activity,
    locale
  };
 }
}
