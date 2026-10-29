import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AuthService, hashPassword } from "../auth/auth.service.js";
import { blindIndex, decryptText, encryptText } from "../security/crypto.js";
import { salesFilters, canChangeCommercialStage, requiresLossReason, validatePlanClone, canProvisionPaid } from "./p6-policy.js";
import { normalizeInternalOpportunity, activeDuplicateFilter, type InternalOpportunityInput } from "./internal-opportunity-policy.js";
import { clampedPagination, paged } from "../common/pagination.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "../control/internal-access.js";

const slugBase=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"organization";
@Injectable() export class CommercialService{
 constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(AuditService)private readonly audit:AuditService,@Inject(AuthService)private readonly auth:AuthService){}
 async createPublic(input:{mode:"DEMO"|"START";name:string;email:string;company:string;legalName?:string;taxId?:string;billingEmail?:string;country?:string;estimatedParticipants?:number;planCode?:string;paymentProvider?:"REDSYS"|"PAYPAL"|"BANK_TRANSFER";useCase?:string;message?:string;locale:"es"|"en";marketingConsent:boolean}){
  const privacy=await this.db.legalDocumentVersion.findFirstOrThrow({where:{document:{key:"privacy"},locale:input.locale,active:true},orderBy:{effectiveAt:"desc"}});const email=input.email.trim().toLowerCase(),emailLookup=blindIndex(email);
  const lead=await this.db.lead.create({data:{name:input.name,emailEncrypted:encryptText(email),emailLookup,company:input.company,message:input.message??input.useCase??"",locale:input.locale,marketingConsent:input.marketingConsent,privacyNoticeVersion:`${privacy.version}:${privacy.id}`}});
  const request=await this.db.commercialRequest.create({data:{leadId:lead.id,mode:input.mode,stage:input.mode==="START"?"QUALIFIED":"NEW",name:input.name,emailEncrypted:encryptText(email),emailLookup,company:input.company,legalName:input.legalName||null,taxId:input.taxId||null,billingEmail:input.billingEmail?.trim().toLowerCase()||null,country:input.country||null,estimatedParticipants:input.estimatedParticipants??null,planCode:input.planCode||null,paymentProvider:input.paymentProvider??null,paymentStatus:input.paymentProvider?"PENDING_PROVIDER":"NOT_CONFIGURED",useCase:input.useCase||input.message||null,locale:input.locale}});
  await this.db.legalInteraction.create({data:{documentVersionId:privacy.id,actorType:"PUBLIC_VISITOR",actorRef:emailLookup,action:"ACKNOWLEDGE",locale:input.locale,evidence:{channel:input.mode==="START"?"public-start":"public-demo",commercialRequestId:request.id,purpose:"commercial_request"}}});
  if(input.marketingConsent){const marketing=await this.db.legalDocumentVersion.findFirst({where:{document:{key:"marketing-consent"},locale:input.locale,active:true},orderBy:{effectiveAt:"desc"}});if(marketing)await this.db.legalInteraction.create({data:{documentVersionId:marketing.id,actorType:"PUBLIC_VISITOR",actorRef:emailLookup,action:"CONSENT",locale:input.locale,evidence:{channel:"public-commercial",commercialRequestId:request.id,purpose:"marketing_updates",separateControl:true}}});}
  await this.db.outboxEvent.create({data:{type:"SEND_EMAIL",payload:{to:"sales@proofline.local",subject:`${input.mode==="START"?"Start request":"Demo request"} · ${input.company}`,text:`${input.name} · ${email}\n${input.company}\n${input.country??""}\nParticipants: ${input.estimatedParticipants??"n/a"}\nPlan: ${input.planCode??"n/a"}\n\n${input.useCase??input.message??""}`,category:input.mode==="START"?"commercial_start":"commercial_demo",locale:input.locale==="en"?"en":"es"}}});return{ok:true,id:request.id,stage:request.stage};
 }
 /** CQF-F2: auditable internally sourced opportunity; no synthetic consent or payment. */
 async createInternalOpportunity(req:HeaderRequest,input:InternalOpportunityInput){
  const ctx=requireInternalCapability(req,"sales.manage");
  const clean=normalizeInternalOpportunity(input);
  const emailLookup=blindIndex(clean.email);
  return this.db.$transaction(async tx=>{
    if(clean.planCode){
      const plan=await tx.plan.findUnique({where:{code:clean.planCode},select:{code:true}});
      if(!plan)throw new BadRequestException("Selected plan does not exist");
    }
    const existing=await tx.commercialRequest.findFirst({
      where:activeDuplicateFilter(emailLookup,clean.company), select:{id:true}
    });
    if(existing)throw new BadRequestException("An open opportunity for this company and contact already exists");
    const created=await tx.commercialRequest.create({data:{
      mode:clean.mode,stage:"NEW",name:clean.name,
      emailEncrypted:encryptText(clean.email),emailLookup,
      company:clean.company,country:clean.country,
      estimatedParticipants:clean.estimatedParticipants,
      planCode:clean.planCode,useCase:clean.useCase,locale:clean.locale,
      paymentStatus:"NOT_CONFIGURED"
    }});
    await tx.auditEvent.create({data:{
      actorType:"INTERNAL",actorId:ctx.identity.email,
      action:"COMMERCIAL_OPPORTUNITY_CREATED",targetType:"CommercialRequest",
      targetId:created.id,
      metadata:{source:"control",mode:created.mode,stage:created.stage,
        selectedPlanCode:created.planCode,customerConsentCaptured:false,
        paymentCollected:false}
    }});
    return {ok:true,id:created.id,stage:created.stage};
  });
 }
 async list(req:HeaderRequest){requireInternalCapability(req,"sales.read");const rows=await this.db.commercialRequest.findMany({include:{organization:{select:{id:true,name:true,slug:true}}},orderBy:{createdAt:"desc"}});return rows.map(r=>({...r,email:decryptText(r.emailEncrypted),emailEncrypted:undefined}))}
 async page(req:HeaderRequest,input:{page?:string;pageSize?:string;q?:string;stage?:string;mode?:string;planCode?:string}) {
  requireInternalCapability(req,"sales.read");
  const f=salesFilters(input),AND:any[]=[];
  if(f.stage)AND.push({stage:f.stage});
  if(f.mode)AND.push({mode:f.mode});
  if(f.planCode)AND.push({planCode:f.planCode});
  if(f.q){const OR:any[]=[{company:{contains:f.q,mode:"insensitive"}},{name:{contains:f.q,mode:"insensitive"}},{id:{contains:f.q,mode:"insensitive"}}];
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.q)) OR.push({emailLookup:blindIndex(f.q.toLowerCase())});
    AND.push({OR});
  }
  const where=AND.length?{AND}:{};
  const [total,byStage,byMode]=await Promise.all([
    this.db.commercialRequest.count({where}),
    this.db.commercialRequest.groupBy({by:["stage"],_count:{_all:true}}),
    this.db.commercialRequest.groupBy({by:["mode"],_count:{_all:true}}),
  ]);
  const pg=clampedPagination(total,input);
  const records=await this.db.commercialRequest.findMany({where,skip:pg.skip,take:pg.take,
    include:{organization:{select:{id:true,name:true,slug:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}]});
  const items=records.map(r=>({...r,email:decryptText(r.emailEncrypted),emailEncrypted:undefined,emailLookup:undefined,paymentSetup:undefined}));
  return {...paged(items,total,pg.page,pg.pageSize),summary:{byStage:Object.fromEntries(byStage.map(x=>[x.stage,x._count._all])),byMode:Object.fromEntries(byMode.map(x=>[x.mode,x._count._all]))}};
 }
 async availablePlans(req:HeaderRequest){requireInternalCapability(req,"sales.read");return this.db.plan.findMany({select:{code:true,name:true,monthlyAmountCents:true,currency:true},orderBy:[{monthlyAmountCents:"asc"},{code:"asc"}]});}
 async setPlan(req:HeaderRequest,id:string,planCode:string){
  const ctx=requireInternalCapability(req,"sales.manage");
  const plan=await this.db.plan.findUnique({where:{code:planCode}});
  if(!plan)throw new BadRequestException("Unknown plan code");
  return this.db.$transaction(async tx=>{
    const request=await tx.commercialRequest.findUnique({where:{id}});
    if(!request)throw new NotFoundException("Commercial request not found");
    if(["PROVISIONED","LOST"].includes(request.stage))throw new BadRequestException("Closed opportunities cannot change plan");
    if(request.planCode===planCode)return{ok:true,unchanged:true,planCode};
    await tx.commercialRequest.update({where:{id},data:{planCode}});
    await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"COMMERCIAL_PLAN_SELECTED",targetType:"CommercialRequest",targetId:id,metadata:{previous:request.planCode,next:planCode,monthlyAmountCents:plan.monthlyAmountCents,currency:plan.currency}}});
    return{ok:true,planCode};
  });
 }
 async clonePlan(req:HeaderRequest,input:{sourceCode:string;code:string;name:string;monthlyAmountCents:number}){
  const ctx=requireInternalCapability(req,"billing.manage");
  let normalized;
  try{normalized=validatePlanClone(input)}catch(error){throw new BadRequestException((error as Error).message)}
  const source=await this.db.plan.findUnique({where:{code:input.sourceCode}});
  if(!source)throw new NotFoundException("Template plan not found");
  return this.db.$transaction(async tx=>{
    const existing=await tx.plan.findUnique({where:{code:normalized.code}});
    if(existing)throw new BadRequestException("Plan code already exists");
    const plan=await tx.plan.create({data:{...normalized,currency:source.currency,entitlementsJson:source.entitlementsJson as any}});
    await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"PLAN_CREATED_FROM_TEMPLATE",targetType:"Plan",targetId:plan.id,metadata:{sourceCode:source.code,code:plan.code,monthlyAmountCents:plan.monthlyAmountCents,currency:plan.currency}}});
    return{ok:true,id:plan.id,code:plan.code};
  });
 }
 async updateStage(req:HeaderRequest,id:string,stage:string,lostReason?:string){
  const ctx=requireInternalCapability(req,"sales.manage");
  return this.db.$transaction(async tx=>{
    const current=await tx.commercialRequest.findUnique({where:{id}});
    if(!current)throw new NotFoundException("Commercial request not found");
    if(!canChangeCommercialStage(current.stage,stage,Boolean(current.organizationId)))throw new BadRequestException("Invalid commercial stage transition: evaluation and provisioning require their actual workflows");
    if(requiresLossReason(stage,lostReason))throw new BadRequestException("A loss reason of at least 5 characters is required");
    if(current.stage===stage)return{ok:true,unchanged:true,stage};
    const updated=await tx.commercialRequest.update({where:{id},data:{stage:stage as any,lostReason:stage==="LOST"?lostReason?.trim()||null:null}});
    await tx.auditEvent.create({data:{actorType:"INTERNAL",actorId:ctx.identity.email,action:"COMMERCIAL_STAGE_CHANGED",targetType:"CommercialRequest",targetId:id,metadata:{from:current.stage,to:stage,lostReason:stage==="LOST"?lostReason?.trim():null}}});
    return{ok:true,stage:updated.stage};
  });
 }
 private async uniqueSlug(company:string){const base=slugBase(company);let slug=base,i=1;while(await this.db.organization.findUnique({where:{slug}})){i+=1;slug=`${base}-${i}`}return slug}
 async provision(req:HeaderRequest,id:string,evaluation:boolean){
  const ctx=requireInternalCapability(req,"sales.manage");
  const request=await this.db.commercialRequest.findUnique({where:{id}});
  if(!request)throw new NotFoundException("Commercial request not found");
  const plan=request.planCode?await this.db.plan.findUnique({where:{code:request.planCode}}):await this.db.plan.findFirst({orderBy:{monthlyAmountCents:"asc"}});
  if(!plan)throw new BadRequestException("No plan is configured");
  if(!evaluation&&request.mode!=="START")throw new BadRequestException("Paid provisioning requires a START request");
  if(!evaluation&&!request.planCode)throw new BadRequestException("Select an explicit contract plan before paid provisioning");
  if(evaluation&&["LOST","PROVISIONED"].includes(request.stage))throw new BadRequestException("Cannot create evaluation after opportunity is closed");
  const entitlements=plan.entitlementsJson&&typeof plan.entitlementsJson==="object"&&!Array.isArray(plan.entitlementsJson)?plan.entitlementsJson as Record<string,unknown>:{};
  const paymentReady=canProvisionPaid(request.stage,request.paymentProvider,request.paymentStatus,request.paymentTermsDays);
  const paymentSetup=(request.paymentSetup&&typeof request.paymentSetup==="object"&&!Array.isArray(request.paymentSetup)?request.paymentSetup:{}) as Record<string,any>;
  const paymentMethodData=(organizationId:string)=>({organizationId,provider:request.paymentProvider as any,type:(request.paymentProvider==="REDSYS"?"CARD":request.paymentProvider==="PAYPAL"?"PAYPAL":"BANK_TRANSFER") as any,status:"ACTIVE" as const,isDefault:true,externalReference:paymentSetup.externalReference??null,maskedLabel:paymentSetup.maskedLabel??null,brand:paymentSetup.brand??null,last4:paymentSetup.last4??null,expiresMonth:paymentSetup.expiresMonth??null,expiresYear:paymentSetup.expiresYear??null,bankReference:paymentSetup.bankReference??null,paymentTermsDays:Number(request.paymentTermsDays??paymentSetup.paymentTermsDays??0),createdByType:"INTERNAL",createdBy:ctx.identity.email,activatedAt:new Date()});

  if(request.organizationId){
    if(evaluation)return{ok:true,organizationId:request.organizationId,alreadyProvisioned:true,evaluation:true};
    if(request.stage==="PROVISIONED")return{ok:true,organizationId:request.organizationId,alreadyProvisioned:true};
    if(request.stage!=="WON")throw new BadRequestException("An evaluation can only be converted to paid after the opportunity is WON");
    if(!paymentReady)throw new BadRequestException("Paid activation requires an approved bank-transfer contract with net terms. Redsys/PayPal adapters are not connected; payment setup alone is not a charge.");
    const organization=await this.db.organization.findUnique({where:{id:request.organizationId}});
    if(!organization)throw new NotFoundException("Provisioned organization not found");
    await this.db.$transaction(async tx=>{
      const subscription=await tx.subscription.findFirst({where:{organizationId:organization.id,status:{in:["TRIAL","ACTIVE"]}},orderBy:{createdAt:"desc"}});
      if(subscription)await tx.subscription.update({where:{id:subscription.id},data:{planId:plan.id,status:"ACTIVE",externalRef:`contract:${request.id}`,renewsAt:null}});
      else await tx.subscription.create({data:{organizationId:organization.id,planId:plan.id,status:"ACTIVE",externalRef:`contract:${request.id}`,renewsAt:null}});
      await tx.entitlement.deleteMany({where:{organizationId:organization.id,key:{startsWith:"plan."}}});
      for(const[key,value]of Object.entries(entitlements))await tx.entitlement.create({data:{organizationId:organization.id,key:`plan.${key}`,value:value as any,source:"plan"}});
      const previous=await tx.paymentMethod.findFirst({where:{organizationId:organization.id,isDefault:true,status:"ACTIVE"}});
      if(previous)await tx.paymentMethod.update({where:{id:previous.id},data:{status:"REPLACED",isDefault:false,replacedAt:new Date()}});
      const method=await tx.paymentMethod.create({data:paymentMethodData(organization.id)});
      await tx.paymentMethodEvent.create({data:{organizationId:organization.id,paymentMethodId:method.id,previousPaymentMethodId:previous?.id??null,eventType:previous?"REPLACED_DEFAULT":"ACTIVATED_ON_CONTRACT",actorType:"INTERNAL",actorId:ctx.identity.email,metadata:{commercialRequestId:id,provider:request.paymentProvider,paymentStatus:request.paymentStatus}}});
      await tx.commercialRequest.update({where:{id},data:{stage:"PROVISIONED",evaluationExpiresAt:null}});
    });
    const email=decryptText(request.emailEncrypted);
    await this.db.outboxEvent.create({data:{type:"SEND_EMAIL",payload:{to:email,subject:`Proofline · ${organization.name} · servicio activado`,text:`${organization.name} ya ha pasado de evaluación a servicio activo de Proofline.\n\nPlan: ${plan.name}\nEstado: ACTIVE\n\nPuedes continuar utilizando el mismo Workspace y tus datos de evaluación se conservan.`,category:"commercial_trial_converted",locale:request.locale==="en"?"en":"es"}}});
    await this.audit.record({organizationId:organization.id,actorType:"INTERNAL",actorId:ctx.identity.email,action:"EVALUATION_CONVERTED_TO_PAID",targetType:"Organization",targetId:organization.id,metadata:{commercialRequestId:id,planCode:plan.code,preservedWorkspace:true,paymentProvider:request.paymentProvider,paymentStatus:request.paymentStatus}});
    return{ok:true,organizationId:organization.id,convertedFromEvaluation:true,status:"ACTIVE"};
  }

  if(!evaluation&&request.stage!=="WON")throw new BadRequestException("A paid organization can only be provisioned after the opportunity is WON");
  if(!evaluation&&!paymentReady)throw new BadRequestException("Paid activation requires an approved bank-transfer contract with net terms. Redsys/PayPal adapters are not connected; payment setup alone is not a charge.");
  const email=decryptText(request.emailEncrypted),slug=await this.uniqueSlug(request.company),expires=evaluation?new Date(Date.now()+14*86_400_000):null;
  const result=await this.db.$transaction(async tx=>{
    const organization=await tx.organization.create({data:{name:request.company,legalName:request.legalName||request.company,taxId:request.taxId,billingEmail:request.billingEmail||email,country:request.country,contractOwnerEmail:email,slug,defaultLocale:request.locale}});
    const user=await tx.user.upsert({where:{email},update:{displayName:request.name},create:{email,displayName:request.name,locale:request.locale,accountStatus:"PENDING_VERIFICATION"}});
    await tx.membership.upsert({where:{organizationId_userId:{organizationId:organization.id,userId:user.id}},update:{role:"OWNER"},create:{organizationId:organization.id,userId:user.id,role:"OWNER"}});
    await tx.subscription.create({data:{organizationId:organization.id,planId:plan.id,status:evaluation?"TRIAL":"ACTIVE",externalRef:evaluation?`evaluation:${request.id}`:`contract:${request.id}`,renewsAt:evaluation?expires:null}});
    for(const[key,value]of Object.entries(entitlements))await tx.entitlement.create({data:{organizationId:organization.id,key:`plan.${key}`,value:value as any,source:evaluation?"evaluation":"plan"}});
    if(!evaluation){const method=await tx.paymentMethod.create({data:paymentMethodData(organization.id)});await tx.paymentMethodEvent.create({data:{organizationId:organization.id,paymentMethodId:method.id,eventType:"ACTIVATED_ON_CONTRACT",actorType:"INTERNAL",actorId:ctx.identity.email,metadata:{commercialRequestId:id,provider:request.paymentProvider,paymentStatus:request.paymentStatus}}});}
    await tx.commercialRequest.update({where:{id},data:{organizationId:organization.id,stage:evaluation?"EVALUATION":"PROVISIONED",evaluationExpiresAt:expires}});
    return{organization,user};
  });
  const activation=await this.auth.createActivation(result.user.id,result.user.email,request.locale);
  await this.audit.record({organizationId:result.organization.id,actorType:"INTERNAL",actorId:ctx.identity.email,action:evaluation?"EVALUATION_WORKSPACE_PROVISIONED":"CUSTOMER_ORGANIZATION_PROVISIONED",targetType:"Organization",targetId:result.organization.id,metadata:{commercialRequestId:id,planCode:plan.code,evaluationExpiresAt:expires?.toISOString()??null,paymentProvider:evaluation?null:request.paymentProvider,paymentStatus:evaluation?null:request.paymentStatus}});
  return{ok:true,organizationId:result.organization.id,activationUrl:process.env.NODE_ENV==="production"?undefined:activation.activationUrl,evaluationExpiresAt:expires};
 }
 async createInternalUser(req:HeaderRequest,input:{email:string;displayName:string;role:string}){const ctx=requireInternalCapability(req,"security.manage");const allowed=["INTERNAL_OPERATIONS","INTERNAL_FINANCE","INTERNAL_TRUST","INTERNAL_SUPPORT","INTERNAL_ANALYST"];if(!allowed.includes(input.role))throw new BadRequestException("Invalid internal role");const email=input.email.trim().toLowerCase();const existing=await this.db.internalUser.findUnique({where:{email}});if(existing)throw new BadRequestException("Internal user already exists");const placeholder=hashPassword(randomBytes(32).toString("base64url"));const user=await this.db.internalUser.create({data:{email,displayName:input.displayName,role:input.role,passwordHash:placeholder,status:"PENDING_ACTIVATION"}});const activation=await this.auth.createInternalActivation(user.id,email);await this.audit.record({actorType:"INTERNAL",actorId:ctx.identity.email,action:"INTERNAL_USER_CREATED",targetType:"InternalUser",targetId:user.id,metadata:{email,role:input.role}});return{ok:true,id:user.id,activationUrl:process.env.NODE_ENV==="production"?undefined:activation.activationUrl}}
}
