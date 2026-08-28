import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AuthService, hashPassword } from "../auth/auth.service.js";
import { blindIndex, decryptText, encryptText } from "../security/crypto.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "../control/internal-access.js";

const slugBase=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"organization";
@Injectable() export class CommercialService{
 constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(AuditService)private readonly audit:AuditService,@Inject(AuthService)private readonly auth:AuthService){}
 async createPublic(input:{mode:"DEMO"|"START";name:string;email:string;company:string;legalName?:string;taxId?:string;billingEmail?:string;country?:string;estimatedParticipants?:number;planCode?:string;useCase?:string;message?:string;locale:"es"|"en";marketingConsent:boolean}){
  const privacy=await this.db.legalDocumentVersion.findFirstOrThrow({where:{document:{key:"privacy"},locale:input.locale,active:true},orderBy:{effectiveAt:"desc"}});const email=input.email.trim().toLowerCase(),emailLookup=blindIndex(email);
  const lead=await this.db.lead.create({data:{name:input.name,emailEncrypted:encryptText(email),emailLookup,company:input.company,message:input.message??input.useCase??"",locale:input.locale,marketingConsent:input.marketingConsent,privacyNoticeVersion:`${privacy.version}:${privacy.id}`}});
  const request=await this.db.commercialRequest.create({data:{leadId:lead.id,mode:input.mode,stage:input.mode==="START"?"QUALIFIED":"NEW",name:input.name,emailEncrypted:encryptText(email),emailLookup,company:input.company,legalName:input.legalName||null,taxId:input.taxId||null,billingEmail:input.billingEmail?.trim().toLowerCase()||null,country:input.country||null,estimatedParticipants:input.estimatedParticipants??null,planCode:input.planCode||null,useCase:input.useCase||input.message||null,locale:input.locale}});
  await this.db.legalInteraction.create({data:{documentVersionId:privacy.id,actorType:"PUBLIC_VISITOR",actorRef:emailLookup,action:"ACKNOWLEDGE",locale:input.locale,evidence:{channel:input.mode==="START"?"public-start":"public-demo",commercialRequestId:request.id,purpose:"commercial_request"}}});
  if(input.marketingConsent){const marketing=await this.db.legalDocumentVersion.findFirst({where:{document:{key:"marketing-consent"},locale:input.locale,active:true},orderBy:{effectiveAt:"desc"}});if(marketing)await this.db.legalInteraction.create({data:{documentVersionId:marketing.id,actorType:"PUBLIC_VISITOR",actorRef:emailLookup,action:"CONSENT",locale:input.locale,evidence:{channel:"public-commercial",commercialRequestId:request.id,purpose:"marketing_updates",separateControl:true}}});}
  await this.db.outboxEvent.create({data:{type:"SEND_EMAIL",payload:{to:"sales@proofline.local",subject:`${input.mode==="START"?"Start request":"Demo request"} · ${input.company}`,text:`${input.name} · ${email}\n${input.company}\n${input.country??""}\nParticipants: ${input.estimatedParticipants??"n/a"}\nPlan: ${input.planCode??"n/a"}\n\n${input.useCase??input.message??""}`,category:input.mode==="START"?"commercial_start":"commercial_demo"}}});return{ok:true,id:request.id,stage:request.stage};
 }
 async list(req:HeaderRequest){requireInternalCapability(req,"sales.read");const rows=await this.db.commercialRequest.findMany({include:{organization:{select:{id:true,name:true,slug:true}}},orderBy:{createdAt:"desc"}});return rows.map(r=>({...r,email:decryptText(r.emailEncrypted),emailEncrypted:undefined}))}
 async updateStage(req:HeaderRequest,id:string,stage:string,lostReason?:string){const ctx=requireInternalCapability(req,"sales.manage");if(!["NEW","QUALIFIED","DEMO_SCHEDULED","EVALUATION","PROPOSAL","CONTRACT_PENDING","WON","LOST","PROVISIONED"].includes(stage))throw new BadRequestException("Invalid commercial stage");const current=await this.db.commercialRequest.findUnique({where:{id}});if(!current)throw new NotFoundException("Commercial request not found");const updated=await this.db.commercialRequest.update({where:{id},data:{stage:stage as any,lostReason:stage==="LOST"?lostReason?.trim()||"Not specified":null}});await this.audit.record({actorType:"INTERNAL",actorId:ctx.identity.email,action:"COMMERCIAL_STAGE_CHANGED",targetType:"CommercialRequest",targetId:id,metadata:{from:current.stage,to:stage}});return updated}
 private async uniqueSlug(company:string){const base=slugBase(company);let slug=base,i=1;while(await this.db.organization.findUnique({where:{slug}})){i+=1;slug=`${base}-${i}`}return slug}
 async provision(req:HeaderRequest,id:string,evaluation:boolean){
  const ctx=requireInternalCapability(req,"sales.manage");
  const request=await this.db.commercialRequest.findUnique({where:{id}});
  if(!request)throw new NotFoundException("Commercial request not found");
  const plan=request.planCode?await this.db.plan.findUnique({where:{code:request.planCode}}):await this.db.plan.findFirst({orderBy:{monthlyAmountCents:"asc"}});
  if(!plan)throw new BadRequestException("No plan is configured");
  const entitlements=plan.entitlementsJson&&typeof plan.entitlementsJson==="object"&&!Array.isArray(plan.entitlementsJson)?plan.entitlementsJson as Record<string,unknown>:{};

  if(request.organizationId){
    if(evaluation)return{ok:true,organizationId:request.organizationId,alreadyProvisioned:true,evaluation:true};
    if(request.stage==="PROVISIONED")return{ok:true,organizationId:request.organizationId,alreadyProvisioned:true};
    if(request.stage!=="WON")throw new BadRequestException("An evaluation can only be converted to paid after the opportunity is WON");
    const organization=await this.db.organization.findUnique({where:{id:request.organizationId}});
    if(!organization)throw new NotFoundException("Provisioned organization not found");
    await this.db.$transaction(async tx=>{
      const subscription=await tx.subscription.findFirst({where:{organizationId:organization.id,status:{in:["TRIAL","ACTIVE"]}},orderBy:{createdAt:"desc"}});
      if(subscription)await tx.subscription.update({where:{id:subscription.id},data:{planId:plan.id,status:"ACTIVE",externalRef:`contract:${request.id}`,renewsAt:null}});
      else await tx.subscription.create({data:{organizationId:organization.id,planId:plan.id,status:"ACTIVE",externalRef:`contract:${request.id}`,renewsAt:null}});
      await tx.entitlement.deleteMany({where:{organizationId:organization.id,key:{startsWith:"plan."}}});
      for(const[key,value]of Object.entries(entitlements))await tx.entitlement.create({data:{organizationId:organization.id,key:`plan.${key}`,value:value as any,source:"plan"}});
      await tx.commercialRequest.update({where:{id},data:{stage:"PROVISIONED",evaluationExpiresAt:null}});
    });
    const email=decryptText(request.emailEncrypted);
    await this.db.outboxEvent.create({data:{type:"SEND_EMAIL",payload:{to:email,subject:`Proofline · ${organization.name} · servicio activado`,text:`${organization.name} ya ha pasado de evaluación a servicio activo de Proofline.\n\nPlan: ${plan.name}\nEstado: ACTIVE\n\nPuedes continuar utilizando el mismo Workspace y tus datos de evaluación se conservan.`,category:"commercial_trial_converted"}}});
    await this.audit.record({organizationId:organization.id,actorType:"INTERNAL",actorId:ctx.identity.email,action:"EVALUATION_CONVERTED_TO_PAID",targetType:"Organization",targetId:organization.id,metadata:{commercialRequestId:id,planCode:plan.code,preservedWorkspace:true}});
    return{ok:true,organizationId:organization.id,convertedFromEvaluation:true,status:"ACTIVE"};
  }

  if(!evaluation&&request.stage!=="WON")throw new BadRequestException("A paid organization can only be provisioned after the opportunity is WON");
  const email=decryptText(request.emailEncrypted),slug=await this.uniqueSlug(request.company),expires=evaluation?new Date(Date.now()+14*86_400_000):null;
  const result=await this.db.$transaction(async tx=>{
    const organization=await tx.organization.create({data:{name:request.company,legalName:request.legalName||request.company,taxId:request.taxId,billingEmail:request.billingEmail||email,country:request.country,contractOwnerEmail:email,slug,defaultLocale:request.locale}});
    const user=await tx.user.upsert({where:{email},update:{displayName:request.name},create:{email,displayName:request.name,locale:request.locale,accountStatus:"PENDING_VERIFICATION"}});
    await tx.membership.upsert({where:{organizationId_userId:{organizationId:organization.id,userId:user.id}},update:{role:"OWNER"},create:{organizationId:organization.id,userId:user.id,role:"OWNER"}});
    await tx.subscription.create({data:{organizationId:organization.id,planId:plan.id,status:evaluation?"TRIAL":"ACTIVE",externalRef:evaluation?`evaluation:${request.id}`:`contract:${request.id}`,renewsAt:evaluation?expires:null}});
    for(const[key,value]of Object.entries(entitlements))await tx.entitlement.create({data:{organizationId:organization.id,key:`plan.${key}`,value:value as any,source:evaluation?"evaluation":"plan"}});
    await tx.commercialRequest.update({where:{id},data:{organizationId:organization.id,stage:evaluation?"EVALUATION":"PROVISIONED",evaluationExpiresAt:expires}});
    return{organization,user};
  });
  const activation=await this.auth.createActivation(result.user.id,result.user.email,request.locale);
  await this.audit.record({organizationId:result.organization.id,actorType:"INTERNAL",actorId:ctx.identity.email,action:evaluation?"EVALUATION_WORKSPACE_PROVISIONED":"CUSTOMER_ORGANIZATION_PROVISIONED",targetType:"Organization",targetId:result.organization.id,metadata:{commercialRequestId:id,planCode:plan.code,evaluationExpiresAt:expires?.toISOString()??null}});
  return{ok:true,organizationId:result.organization.id,activationUrl:process.env.NODE_ENV==="production"?undefined:activation.activationUrl,evaluationExpiresAt:expires};
 }
 async createInternalUser(req:HeaderRequest,input:{email:string;displayName:string;role:string}){const ctx=requireInternalCapability(req,"security.manage");const allowed=["INTERNAL_OPERATIONS","INTERNAL_FINANCE","INTERNAL_TRUST","INTERNAL_SUPPORT","INTERNAL_ANALYST"];if(!allowed.includes(input.role))throw new BadRequestException("Invalid internal role");const email=input.email.trim().toLowerCase();const existing=await this.db.internalUser.findUnique({where:{email}});if(existing)throw new BadRequestException("Internal user already exists");const placeholder=hashPassword(randomBytes(32).toString("base64url"));const user=await this.db.internalUser.create({data:{email,displayName:input.displayName,role:input.role,passwordHash:placeholder,status:"PENDING_ACTIVATION"}});const activation=await this.auth.createInternalActivation(user.id,email);await this.audit.record({actorType:"INTERNAL",actorId:ctx.identity.email,action:"INTERNAL_USER_CREATED",targetType:"InternalUser",targetId:user.id,metadata:{email,role:input.role}});return{ok:true,id:user.id,activationUrl:process.env.NODE_ENV==="production"?undefined:activation.activationUrl}}
}
