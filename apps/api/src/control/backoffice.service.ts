import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { internalContext, requireInternalCapability } from "./internal-access.js";

const DAY = 86_400_000;
const sum = (values:number[]) => values.reduce((a,b)=>a+b,0);
const pct = (current:number, previous:number) => previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current-previous)/Math.abs(previous))*1000)/10;
const clamp = (n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

function resolveWindow(range?:string, from?:string, to?:string){
  const now=new Date();
  let end=to?new Date(to):now;
  if(Number.isNaN(end.getTime()))end=now;
  let start:Date;
  if(from){start=new Date(from);if(Number.isNaN(start.getTime()))start=new Date(end.getTime()-30*DAY)}
  else{const days=range==="7d"?7:range==="90d"?90:range==="365d"?365:30;start=new Date(end.getTime()-days*DAY)}
  const span=Math.max(DAY,end.getTime()-start.getTime());
  const previousEnd=new Date(start.getTime());
  const previousStart=new Date(start.getTime()-span);
  return{start,end,previousStart,previousEnd,range:range??"30d"};
}
function bucketKey(date:Date,spanDays:number){
  if(spanDays>120)return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-01`;
  if(spanDays>45){const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return d.toISOString().slice(0,10)}
  return date.toISOString().slice(0,10);
}
function can(req:HeaderRequest,capability:string){const c=internalContext(req).capabilities;return c.includes("*")||c.includes(capability)}

@Injectable()
export class BackofficeService{
  constructor(@Inject(PrismaService)private readonly db:PrismaService){}

  async dashboard(req:HeaderRequest,query:{range?:string;from?:string;to?:string}={}){
    requireInternalCapability(req,"control.overview");
    const w=resolveWindow(query.range,query.from,query.to),spanDays=Math.ceil((w.end.getTime()-w.start.getTime())/DAY);
    const financeVisible=can(req,"billing.read"),supportVisible=can(req,"support.read"),operationsVisible=can(req,"operations.read");
    const [organizations,subscriptions,invoices,usage,tickets,outbox,analysis,audit,users,paymentTx]=await Promise.all([
      this.db.organization.findMany({select:{id:true,name:true,country:true,createdAt:true}}),
      this.db.subscription.findMany({include:{organization:{select:{id:true,name:true,country:true}},plan:true},orderBy:{createdAt:"desc"}}),
      financeVisible?this.db.billingInvoice.findMany({where:{issuedAt:{gte:w.previousStart,lte:w.end}},include:{organization:{select:{id:true,name:true}},documentRecord:{select:{id:true}}},orderBy:{issuedAt:"asc"}}):Promise.resolve([]),
      can(req,"usage.read")?this.db.usageEvent.findMany({where:{occurredAt:{gte:w.start,lte:w.end}},select:{organizationId:true,eventType:true,quantity:true,billable:true,occurredAt:true}}):Promise.resolve([]),
      supportVisible?this.db.supportTicket.findMany({where:{createdAt:{lte:w.end}},include:{organization:{select:{name:true}}},orderBy:{updatedAt:"desc"},take:250}):Promise.resolve([]),
      operationsVisible?this.db.outboxEvent.findMany({where:{createdAt:{gte:w.previousStart,lte:w.end}},orderBy:{createdAt:"desc"},take:500}):Promise.resolve([]),
      operationsVisible?this.db.analysisRun.findMany({where:{createdAt:{gte:w.previousStart,lte:w.end}},orderBy:{createdAt:"desc"},take:300}):Promise.resolve([]),
      can(req,"audit.read")?this.db.auditEvent.findMany({include:{organization:{select:{name:true}}},orderBy:{createdAt:"desc"},take:12}):Promise.resolve([]),
      this.db.user.findMany({select:{id:true,createdAt:true,lastLoginAt:true}}),
      financeVisible?this.db.paymentTransaction.findMany({where:{occurredAt:{gte:w.previousStart,lte:w.end}},orderBy:{occurredAt:"desc"},take:500}):Promise.resolve([]),
    ]);
    const currentInvoices=(invoices as any[]).filter(i=>i.issuedAt>=w.start&&i.issuedAt<=w.end),previousInvoices=(invoices as any[]).filter(i=>i.issuedAt>=w.previousStart&&i.issuedAt<w.previousEnd);
    const paid=(rows:any[])=>sum(rows.filter(i=>i.status==="PAID").map(i=>i.amountCents+i.taxCents));
    const billed=(rows:any[])=>sum(rows.filter(i=>!['VOID'].includes(i.status)).map(i=>i.amountCents+i.taxCents));
    const revenueCents=paid(currentInvoices),previousRevenueCents=paid(previousInvoices),billedCents=billed(currentInvoices),previousBilledCents=billed(previousInvoices);
    const activeSubs=(subscriptions as any[]).filter(s=>s.status==="ACTIVE"),trialSubs=(subscriptions as any[]).filter(s=>s.status==="TRIAL"),pastDue=(subscriptions as any[]).filter(s=>s.status==="PAST_DUE"),canceled=(subscriptions as any[]).filter(s=>s.status==="CANCELED");
    const mrrCents=sum(activeSubs.map(s=>s.plan.monthlyAmountCents)),activeOrgIds=new Set(activeSubs.map(s=>s.organizationId)),arpuCents=activeOrgIds.size?Math.round(mrrCents/activeOrgIds.size):0;
    const newCustomers=organizations.filter(o=>o.createdAt>=w.start&&o.createdAt<=w.end).length,previousNewCustomers=organizations.filter(o=>o.createdAt>=w.previousStart&&o.createdAt<w.previousEnd).length;
    const currentTickets=(tickets as any[]).filter(t=>t.createdAt>=w.start&&t.createdAt<=w.end),openTickets=(tickets as any[]).filter(t=>!["CLOSED","RESOLVED"].includes(t.status)),urgent=openTickets.filter(t=>t.priority==="URGENT"),slaRisk=openTickets.filter(t=>t.slaDueAt&&t.slaDueAt.getTime()<Date.now()+24*60*60*1000);
    const firstResponseMs=(tickets as any[]).filter(t=>t.lastInternalReplyAt).map(t=>new Date(t.lastInternalReplyAt).getTime()-new Date(t.createdAt).getTime()).filter(n=>n>=0),resolutionMs=(tickets as any[]).filter(t=>t.resolvedAt).map(t=>new Date(t.resolvedAt).getTime()-new Date(t.createdAt).getTime()).filter(n=>n>=0);
    const failedJobs=(outbox as any[]).filter(j=>j.status==="FAILED"),pendingJobs=(outbox as any[]).filter(j=>["PENDING","PROCESSING"].includes(j.status)),failedAnalysis=(analysis as any[]).filter(a=>a.status==="FAILED"),failedPayments=(paymentTx as any[]).filter(t=>t.status==="FAILED");
    const churnDenom=activeSubs.length+canceled.length;const churnPct=churnDenom?Math.round((canceled.length/churnDenom)*1000)/10:0;
    const billableUnits=sum((usage as any[]).filter(u=>u.billable).map(u=>u.quantity));
    const currentActiveUsers=users.filter(u=>u.lastLoginAt&&u.lastLoginAt>=w.start&&u.lastLoginAt<=w.end).length;
    const timeline=new Map<string,{date:string;revenueCents:number;billedCents:number;customers:number;tickets:number}>();
    const ensure=(d:Date)=>{const key=bucketKey(d,spanDays);if(!timeline.has(key))timeline.set(key,{date:key,revenueCents:0,billedCents:0,customers:0,tickets:0});return timeline.get(key)!};
    currentInvoices.forEach((i:any)=>{const b=ensure(i.issuedAt);if(i.status==="PAID")b.revenueCents+=i.amountCents+i.taxCents;if(i.status!=="VOID")b.billedCents+=i.amountCents+i.taxCents});
    organizations.filter(o=>o.createdAt>=w.start&&o.createdAt<=w.end).forEach(o=>ensure(o.createdAt).customers++);currentTickets.forEach((t:any)=>ensure(t.createdAt).tickets++);
    const planMap=new Map<string,{code:string;name:string;customers:number;mrrCents:number}>();activeSubs.forEach((s:any)=>{const x=planMap.get(s.plan.code)??{code:s.plan.code,name:s.plan.name,customers:0,mrrCents:0};x.customers++;x.mrrCents+=s.plan.monthlyAmountCents;planMap.set(s.plan.code,x)});
    const countryMap=new Map<string,number>();activeSubs.forEach((s:any)=>{const key=s.organization.country||"—";countryMap.set(key,(countryMap.get(key)??0)+1)});
    const revenueGrowth=previousRevenueCents?pct(revenueCents,previousRevenueCents)/100:0;const modeledGrowth=clamp(revenueGrowth,-0.15,0.2);
    return{
      period:{range:w.range,from:w.start.toISOString(),to:w.end.toISOString(),previousFrom:w.previousStart.toISOString(),previousTo:w.previousEnd.toISOString()},
      visibility:{finance:financeVisible,support:supportVisible,operations:operationsVisible},
      kpis:{revenueCents,billedCents,mrrCents,arrCents:mrrCents*12,activeCustomers:activeOrgIds.size,newCustomers,trialCustomers:trialSubs.length,canceledSubscriptions:canceled.length,arpuCents,churnPct,billableUnits,activeUsers:currentActiveUsers,openTickets:openTickets.length,urgentTickets:urgent.length},
      comparison:{revenuePct:pct(revenueCents,previousRevenueCents),billedPct:pct(billedCents,previousBilledCents),newCustomersPct:pct(newCustomers,previousNewCustomers)},
      attention:{pastDueSubscriptions:pastDue.length,openInvoiceCents:sum((invoices as any[]).filter(i=>i.status==="OPEN").map(i=>i.amountCents+i.taxCents)),failedPayments:failedPayments.length,urgentTickets:urgent.length,slaRisk:slaRisk.length,failedJobs:failedJobs.length,pendingJobs:pendingJobs.length,failedAnalysis:failedAnalysis.length},
      support:{firstResponseMinutes:firstResponseMs.length?Math.round(sum(firstResponseMs)/firstResponseMs.length/60000):null,resolutionMinutes:resolutionMs.length?Math.round(sum(resolutionMs)/resolutionMs.length/60000):null,createdInPeriod:currentTickets.length},
      timeline:[...timeline.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      planMix:[...planMap.values()].sort((a,b)=>b.mrrCents-a.mrrCents),countryMix:[...countryMap.entries()].map(([country,customers])=>({country,customers})).sort((a,b)=>b.customers-a.customers),
      forecast:{model:"MRR run-rate + observed paid-invoice growth, clamped to -15%/+20%",confidence:previousRevenueCents>0?"MEDIUM":"LOW",assumptions:["No pricing change","No exceptional one-off invoices","Observed revenue growth is capped to reduce volatility"],conservativeCents:Math.round(mrrCents*(1+Math.min(modeledGrowth,0)-0.03)),baseCents:Math.round(mrrCents*(1+modeledGrowth)),optimisticCents:Math.round(mrrCents*(1+Math.max(modeledGrowth,0)+0.05))},
      system:{api:"healthy",database:"healthy",queue:failedJobs.length?"degraded":"healthy",analytics:failedAnalysis.length?"degraded":"healthy",environment:process.env.NODE_ENV??"development"},
      dataQuality:{organizations:organizations.length,subscriptions:subscriptions.length,invoices:(invoices as any[]).length,tickets:(tickets as any[]).length,usageEvents:(usage as any[]).length,lastUpdatedAt:new Date().toISOString()},
      recentAudit:(audit as any[]).map(a=>({id:a.id,action:a.action,actorId:a.actorId,targetType:a.targetType,organization:a.organization?.name??null,createdAt:a.createdAt}))
    }
  }

  async notifications(req:HeaderRequest){
    requireInternalCapability(req,"control.overview");const caps=internalContext(req).capabilities,all=caps.includes("*");const items:any[]=[];
    if(all||caps.includes("support.read")){const tickets=await this.db.supportTicket.findMany({where:{status:{notIn:["CLOSED","RESOLVED"]}},include:{organization:{select:{name:true}}},orderBy:{updatedAt:"desc"},take:30});for(const t of tickets){if(t.priority==="URGENT"||t.status==="ESCALATED"||t.slaDueAt.getTime()<Date.now()+24*60*60*1000)items.push({key:`ticket:${t.id}`,kind:"SUPPORT",severity:t.priority==="URGENT"||t.status==="ESCALATED"?"critical":"warning",title:t.subject,detail:`${t.organization.name} · ${t.status.replaceAll("_"," ")}`,href:`/support/${t.id}`,createdAt:t.updatedAt})}}
    if(all||caps.includes("operations.read")){const jobs=await this.db.outboxEvent.findMany({where:{status:"FAILED"},orderBy:{updatedAt:"desc"},take:20});for(const j of jobs)items.push({key:`job:${j.id}`,kind:"OPERATIONS",severity:"critical",title:`Job fallido · ${j.type}`,detail:j.error??"Requiere revisión operativa",href:"/operations",createdAt:j.updatedAt})}
    if(all||caps.includes("billing.read")){const [subs,payments]=await Promise.all([this.db.subscription.findMany({where:{status:"PAST_DUE"},include:{organization:{select:{name:true}}},take:20}),this.db.paymentTransaction.findMany({where:{status:"FAILED"},include:{organization:{select:{name:true}}},orderBy:{occurredAt:"desc"},take:20})]);for(const s of subs)items.push({key:`subscription:${s.id}`,kind:"BILLING",severity:"warning",title:`Suscripción vencida · ${s.organization.name}`,detail:s.externalRef??s.id,href:"/subscriptions",createdAt:s.createdAt});for(const p of payments)items.push({key:`payment:${p.id}`,kind:"PAYMENT",severity:"critical",title:`Pago fallido · ${p.organization.name}`,detail:p.failureCode??p.externalReference??"Proveedor de pago",href:"/subscriptions",createdAt:p.occurredAt})}
    if(all||caps.includes("legal.read")){const holds=await this.db.legalHold.findMany({where:{status:"ACTIVE"},include:{organization:{select:{name:true}}},orderBy:{createdAt:"desc"},take:15});for(const h of holds)items.push({key:`hold:${h.id}`,kind:"TRUST",severity:"warning",title:`Legal hold · ${h.organization.name}`,detail:h.reason,href:"/legal",createdAt:h.createdAt})}
    items.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());return{count:items.length,critical:items.filter(i=>i.severity==="critical").length,items:items.slice(0,60),generatedAt:new Date().toISOString()}
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
