import { Inject, Injectable } from "@nestjs/common";
import { operationalAlertTotals } from "./p4-filters.js";
import { PrismaService } from "../database/prisma.service.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { internalContext, requireInternalCapability } from "./internal-access.js";
import { SystemHealthService } from "./system-health.service.js";
import { percentChange as pct, resolveWindow, summarizeEurInvoices, buildTimeline } from "./backoffice-metrics.js";

const sum = (values:number[]) => values.reduce((a,b)=>a+b,0);
const clamp = (n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function can(req:HeaderRequest,capability:string){const c=internalContext(req).capabilities;return c.includes("*")||c.includes(capability)}

@Injectable()
export class BackofficeService{
  constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(SystemHealthService)private readonly health:SystemHealthService){}

  async dashboard(req:HeaderRequest,query:{range?:string;from?:string;to?:string}={}){
    requireInternalCapability(req,"control.overview");
    const dashboardStartedAt=Date.now();
    const w=resolveWindow(query.range,query.from,query.to);
    const financeVisible=can(req,"billing.read"),supportVisible=can(req,"support.read"),operationsVisible=can(req,"operations.read");
    const healthStartedAt=Date.now();
    let healthDurationMs=0;
    const systemHealthPromise=this.health.snapshot().then(result=>{healthDurationMs=Date.now()-healthStartedAt;return result;});
    const queryStartedAt=Date.now();
    const [organizations,subscriptions,invoices,usage,tickets,outbox,analysis,audit,users,paymentTx,openBalance]=await Promise.all([
      this.db.organization.findMany({select:{id:true,name:true,country:true,createdAt:true}}),
      this.db.subscription.findMany({select:{organizationId:true,status:true,plan:{select:{code:true,name:true,currency:true,monthlyAmountCents:true}},organization:{select:{country:true}}}}),
      financeVisible?this.db.billingInvoice.findMany({where:{OR:[{issuedAt:{gte:w.previousStart,lte:w.end}},{paidAt:{gte:w.previousStart,lte:w.end}}]},select:{status:true,currency:true,amountCents:true,taxCents:true,issuedAt:true,paidAt:true},orderBy:{issuedAt:"asc"}}):Promise.resolve([]),
      can(req,"usage.read")?this.db.usageEvent.findMany({where:{occurredAt:{gte:w.start,lte:w.end}},select:{quantity:true,billable:true}}):Promise.resolve([]),
      supportVisible?this.db.supportTicket.findMany({where:{createdAt:{lte:w.end}},select:{createdAt:true,status:true,priority:true,slaDueAt:true,lastInternalReplyAt:true,resolvedAt:true},orderBy:{updatedAt:"desc"},take:250}):Promise.resolve([]),
      operationsVisible?this.db.outboxEvent.findMany({where:{createdAt:{gte:w.previousStart,lte:w.end}},select:{status:true},orderBy:{createdAt:"desc"},take:500}):Promise.resolve([]),
      operationsVisible?this.db.analysisRun.findMany({where:{createdAt:{gte:w.previousStart,lte:w.end}},select:{status:true},orderBy:{createdAt:"desc"},take:300}):Promise.resolve([]),
      can(req,"audit.read")?this.db.auditEvent.findMany({select:{id:true,action:true,actorId:true,targetType:true,createdAt:true,organization:{select:{name:true}}},orderBy:{createdAt:"desc"},take:12}):Promise.resolve([]),
      this.db.user.findMany({select:{lastLoginAt:true}}),
      financeVisible?this.db.paymentTransaction.findMany({where:{occurredAt:{gte:w.previousStart,lte:w.end}},select:{status:true},orderBy:{occurredAt:"desc"},take:500}):Promise.resolve([]),
      financeVisible?this.db.billingInvoice.aggregate({where:{status:"OPEN",currency:"EUR"},_sum:{amountCents:true,taxCents:true}}):Promise.resolve(null),
    ]);
    const queryDurationMs=Date.now()-queryStartedAt;
    // Monetary measures are EUR-only, and PAID invoices use paidAt, not issuedAt.
    const financial=summarizeEurInvoices(invoices as any[],w);
    const {currentInvoices,currentPaid,revenueCents,previousRevenueCents,billedCents,previousBilledCents}=financial;
    const activeSubs=(subscriptions as any[]).filter(s=>s.status==="ACTIVE"),trialSubs=(subscriptions as any[]).filter(s=>s.status==="TRIAL"),pastDue=(subscriptions as any[]).filter(s=>s.status==="PAST_DUE"),canceled=(subscriptions as any[]).filter(s=>s.status==="CANCELED");
    const eurActiveSubs=activeSubs.filter(s=>s.plan.currency==="EUR");
    const mrrCents=sum(eurActiveSubs.map(s=>s.plan.monthlyAmountCents)),activeOrgIds=new Set(activeSubs.map(s=>s.organizationId)),eurActiveOrgIds=new Set(eurActiveSubs.map(s=>s.organizationId)),arpuCents=eurActiveOrgIds.size?Math.round(mrrCents/eurActiveOrgIds.size):0;
    const newCustomers=organizations.filter(o=>o.createdAt>=w.start&&o.createdAt<=w.end).length,previousNewCustomers=organizations.filter(o=>o.createdAt>=w.previousStart&&o.createdAt<w.previousEnd).length;
    const currentTickets=(tickets as any[]).filter(t=>t.createdAt>=w.start&&t.createdAt<=w.end),openTickets=(tickets as any[]).filter(t=>!["CLOSED","RESOLVED"].includes(t.status)),urgent=openTickets.filter(t=>t.priority==="URGENT"),slaRisk=openTickets.filter(t=>t.slaDueAt&&t.slaDueAt.getTime()<Date.now()+24*60*60*1000);
    const firstResponseMs=(tickets as any[]).filter(t=>t.lastInternalReplyAt).map(t=>new Date(t.lastInternalReplyAt).getTime()-new Date(t.createdAt).getTime()).filter(n=>n>=0),resolutionMs=(tickets as any[]).filter(t=>t.resolvedAt).map(t=>new Date(t.resolvedAt).getTime()-new Date(t.createdAt).getTime()).filter(n=>n>=0);
    const failedJobs=(outbox as any[]).filter(j=>j.status==="FAILED"),pendingJobs=(outbox as any[]).filter(j=>["PENDING","PROCESSING"].includes(j.status)),failedAnalysis=(analysis as any[]).filter(a=>a.status==="FAILED"),failedPayments=(paymentTx as any[]).filter(t=>t.status==="FAILED");
    const churnDenom=activeSubs.length+canceled.length;const churnPct=churnDenom?Math.round((canceled.length/churnDenom)*1000)/10:0;
    const systemHealth=await systemHealthPromise;
    const billableUnits=sum((usage as any[]).filter(u=>u.billable).map(u=>u.quantity));
    const currentActiveUsers=users.filter(u=>u.lastLoginAt&&u.lastLoginAt>=w.start&&u.lastLoginAt<=w.end).length;
    const timeline=buildTimeline(w,currentInvoices,currentPaid,organizations,currentTickets);
    const planMap=new Map<string,{code:string;name:string;customers:number;mrrCents:number}>();activeSubs.forEach((s:any)=>{const x=planMap.get(s.plan.code)??{code:s.plan.code,name:s.plan.name,customers:0,mrrCents:0};x.customers++;if(s.plan.currency==="EUR"&&financeVisible)x.mrrCents+=s.plan.monthlyAmountCents;planMap.set(s.plan.code,x)});
    const countryMap=new Map<string,number>();activeSubs.forEach((s:any)=>{const key=s.organization.country||"—";countryMap.set(key,(countryMap.get(key)??0)+1)});
    const growthPct=pct(revenueCents,previousRevenueCents);const modeledGrowth=clamp((growthPct??0)/100,-0.15,0.2);
    const dashboardDurationMs=Date.now()-dashboardStartedAt;
    if(dashboardDurationMs>1000)console.warn(`[CONTROL] dashboard slow response: ${dashboardDurationMs}ms; range=${w.range}; dbBatch=${queryDurationMs}ms; health=${healthDurationMs}ms; finalization=${Math.max(0,dashboardDurationMs-Math.max(queryDurationMs,healthDurationMs))}ms`);
    return {
      period:{range:w.range,from:w.start.toISOString(),to:w.end.toISOString(),previousFrom:w.previousStart.toISOString(),previousTo:w.previousEnd.toISOString()},
      visibility:{finance:financeVisible,support:supportVisible,operations:operationsVisible},
      kpis:{revenueCents:financeVisible?revenueCents:null,billedCents:financeVisible?billedCents:null,mrrCents:financeVisible?mrrCents:null,arrCents:financeVisible?mrrCents*12:null,activeCustomers:activeOrgIds.size,newCustomers,trialCustomers:trialSubs.length,canceledSubscriptions:canceled.length,arpuCents:financeVisible?arpuCents:null,churnPct:financeVisible?churnPct:null,billableUnits,activeUsers:currentActiveUsers,openTickets:openTickets.length,urgentTickets:urgent.length},
      comparison:{revenuePct:financeVisible?pct(revenueCents,previousRevenueCents):null,billedPct:financeVisible?pct(billedCents,previousBilledCents):null,newCustomersPct:pct(newCustomers,previousNewCustomers)},
      attention:{pastDueSubscriptions:pastDue.length,openInvoiceCents:financeVisible?((openBalance?._sum.amountCents??0)+(openBalance?._sum.taxCents??0)):null,failedPayments:failedPayments.length,urgentTickets:urgent.length,slaRisk:slaRisk.length,failedJobs:failedJobs.length,pendingJobs:pendingJobs.length,failedAnalysis:failedAnalysis.length},
      support:{firstResponseMinutes:firstResponseMs.length?Math.round(sum(firstResponseMs)/firstResponseMs.length/60000):null,resolutionMinutes:resolutionMs.length?Math.round(sum(resolutionMs)/resolutionMs.length/60000):null,createdInPeriod:currentTickets.length},
      timeline:timeline.map(b=>({...b,revenueCents:financeVisible?b.revenueCents:null,billedCents:financeVisible?b.billedCents:null})),
      planMix:[...planMap.values()].sort((a,b)=>b.customers-a.customers),countryMix:[...countryMap.entries()].map(([country,customers])=>({country,customers})).sort((a,b)=>b.customers-a.customers),
      forecast:financeVisible&&mrrCents>0&&previousRevenueCents>0?{
        model:"EUR active-plan MRR run-rate adjusted by observed paid-invoice growth (bounded -15%/+20%)",
        confidence:"LOW", // estimate, not contract, booked revenue or cash projection
        assumptions:["EUR plans only", "Gross paid-invoice growth is a scenario proxy", "No changes in prices or plan mix", "Not bank-settled cash; no external provider verification"],
        conservativeCents:Math.max(0,Math.round(mrrCents*(1+Math.min(modeledGrowth,0)-0.03))),
        baseCents:Math.max(0,Math.round(mrrCents*(1+modeledGrowth))),
        optimisticCents:Math.max(0,Math.round(mrrCents*(1+Math.max(modeledGrowth,0)+0.05)))
      }:null,
      financeMethodology:financeVisible?{
        currency:"EUR",basis:"PAID_INVOICE_PAID_AT",grossIncludesTax:true,
        nonEurInvoicesExcluded:financial.nonEurInvoicesExcluded,
        nonEurActivePlansExcluded:activeSubs.length-eurActiveSubs.length,
        paidWithoutPaidAtExcluded:financial.paidWithoutPaidAtExcluded,
        note:"Gross paid invoices are grouped by paidAt; issued invoices by issuedAt. Neither proves bank settlement. MRR derives from active plan list prices, not actual collections."
      }:null,
      system:{api:systemHealth.api.status,database:systemHealth.database.status,queue:systemHealth.queue.status,analytics:systemHealth.analytics.status,mail:systemHealth.mail.status,environment:systemHealth.environment,checkedAt:systemHealth.checkedAt,details:systemHealth},
      dataQuality:{organizations:organizations.length,subscriptions:subscriptions.length,invoices:financeVisible?(invoices as any[]).length:null,tickets:(tickets as any[]).length,usageEvents:(usage as any[]).length,lastUpdatedAt:new Date().toISOString()},
      recentAudit:(audit as any[]).map(a=>({id:a.id,action:a.action,actorId:a.actorId,targetType:a.targetType,organization:a.organization?.name??null,createdAt:a.createdAt}))
    }
  }

  async notifications(req:HeaderRequest){
    requireInternalCapability(req,"control.overview");const caps=internalContext(req).capabilities,all=caps.includes("*");const items:any[]=[];
    if(all||caps.includes("support.read")){const tickets=await this.db.supportTicket.findMany({where:{status:{notIn:["CLOSED","RESOLVED"]},OR:[{priority:"URGENT"},{status:"ESCALATED"},{slaDueAt:{lt:new Date(Date.now()+24*60*60*1000)}}]},include:{organization:{select:{name:true}}},orderBy:{updatedAt:"desc"},take:30});for(const t of tickets){if(t.priority==="URGENT"||t.status==="ESCALATED"||t.slaDueAt.getTime()<Date.now()+24*60*60*1000)items.push({key:`ticket:${t.id}`,kind:"SUPPORT",severity:t.priority==="URGENT"||t.status==="ESCALATED"?"critical":"warning",title:t.subject,detail:`${t.organization.name} · ${t.status.replaceAll("_"," ")}`,href:`/support/${t.id}`,createdAt:t.updatedAt})}}
    if(all||caps.includes("operations.read")){const jobs=await this.db.outboxEvent.findMany({where:{status:"FAILED"},orderBy:{updatedAt:"desc"},take:20});for(const j of jobs)items.push({key:`job:${j.id}`,kind:"OPERATIONS",severity:"critical",title:`Job fallido · ${j.type}`,detail:j.error??"Requiere revisión operativa",href:"/operations",createdAt:j.updatedAt})}
    if(all||caps.includes("billing.read")){const [subs,payments]=await Promise.all([this.db.subscription.findMany({where:{status:"PAST_DUE"},include:{organization:{select:{name:true}}},take:20}),this.db.paymentTransaction.findMany({where:{status:"FAILED"},include:{organization:{select:{name:true}}},orderBy:{occurredAt:"desc"},take:20})]);for(const s of subs)items.push({key:`subscription:${s.id}`,kind:"BILLING",severity:"warning",title:`Suscripción vencida · ${s.organization.name}`,detail:s.externalRef??s.id,href:"/subscriptions",createdAt:s.createdAt});for(const p of payments)items.push({key:`payment:${p.id}`,kind:"PAYMENT",severity:"critical",title:`Pago fallido · ${p.organization.name}`,detail:p.failureCode??p.externalReference??"Proveedor de pago",href:"/subscriptions",createdAt:p.occurredAt})}
    if(all||caps.includes("legal.read")){const holds=await this.db.legalHold.findMany({where:{status:"ACTIVE"},include:{organization:{select:{name:true}}},orderBy:{createdAt:"desc"},take:15});for(const h of holds)items.push({key:`hold:${h.id}`,kind:"TRUST",severity:"warning",title:`Legal hold · ${h.organization.name}`,detail:h.reason,href:"/legal",createdAt:h.createdAt})}
    // Totals are computed independently of the bounded preview, never inferred from 30/20/15 sampled rows.
    const now=new Date(),soon=new Date(now.getTime()+24*60*60*1000);
    const counts=await Promise.all([
      all||caps.includes("support.read")?this.db.supportTicket.count({where:{status:{notIn:["CLOSED","RESOLVED"]},OR:[{priority:"URGENT"},{status:"ESCALATED"},{slaDueAt:{lt:soon}}]}}):0,
      all||caps.includes("support.read")?this.db.supportTicket.count({where:{status:{notIn:["CLOSED","RESOLVED"]},OR:[{priority:"URGENT"},{status:"ESCALATED"}]}}):0,
      all||caps.includes("operations.read")?this.db.outboxEvent.count({where:{status:"FAILED"}}):0,
      all||caps.includes("billing.read")?this.db.subscription.count({where:{status:"PAST_DUE"}}):0,
      all||caps.includes("billing.read")?this.db.paymentTransaction.count({where:{status:"FAILED"}}):0,
      all||caps.includes("legal.read")?this.db.legalHold.count({where:{status:"ACTIVE"}}):0,
    ]);
    items.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    const totals=operationalAlertTotals(counts);
    return{...totals,
      items:items.slice(0,60),previewLimited:items.length>60||totals.count>Math.min(items.length,60),
      generatedAt:new Date().toISOString()};
  }

  async search(req:HeaderRequest,q:string){
    requireInternalCapability(req,"control.overview");const query=q.trim();if(query.length<2)return{query,items:[]};const caps=internalContext(req).capabilities,all=caps.includes("*"),items:any[]=[];
    if(all||caps.includes("organizations.read")){const rows=await this.db.organization.findMany({where:{OR:[{name:{contains:query,mode:"insensitive"}},{slug:{contains:query,mode:"insensitive"}},{billingEmail:{contains:query,mode:"insensitive"}},{contractOwnerEmail:{contains:query,mode:"insensitive"}}]},take:12});rows.forEach(o=>items.push({type:"CUSTOMER",id:o.id,title:o.name,subtitle:o.billingEmail??o.slug,href:`/organizations/${o.id}`}))}
    if(all||caps.includes("security.read")){const rows=await this.db.internalUser.findMany({where:{OR:[{email:{contains:query,mode:"insensitive"}},{displayName:{contains:query,mode:"insensitive"}},{role:{contains:query,mode:"insensitive"}}]},take:10});rows.forEach(u=>items.push({type:"INTERNAL_USER",id:u.id,title:u.displayName,subtitle:`${u.email} · ${u.role}`,href:"/internal-users"}))}
    if(all||caps.includes("support.read")){const rows=await this.db.supportTicket.findMany({where:{OR:[{id:{contains:query,mode:"insensitive"}},{subject:{contains:query,mode:"insensitive"}}]},include:{organization:{select:{name:true}}},take:10});rows.forEach(t=>items.push({type:"TICKET",id:t.id,title:t.subject,subtitle:`${t.organization.name} · ${t.id}`,href:`/support/${t.id}`}))}
    if(all||caps.includes("assessments.read")){const rows=await this.db.assessment.findMany({where:{OR:[{id:{contains:query,mode:"insensitive"}},{title:{contains:query,mode:"insensitive"}}]},include:{organization:{select:{name:true}}},take:10});rows.forEach(a=>items.push({type:"ASSESSMENT",id:a.id,title:a.title,subtitle:a.organization.name,href:"/assessments"}))}
    if(all||caps.includes("billing.read")){const rows=await this.db.subscription.findMany({where:{OR:[{id:{contains:query,mode:"insensitive"}},{externalRef:{contains:query,mode:"insensitive"}},{organization:{name:{contains:query,mode:"insensitive"}}}]},include:{organization:{select:{name:true}},plan:{select:{name:true}}},take:10});rows.forEach(s=>items.push({type:"SUBSCRIPTION",id:s.id,title:s.organization.name,subtitle:`${s.plan.name} · ${s.status}`,href:"/subscriptions"}))}
    return{query,items:items.slice(0,40)}
  }
}
