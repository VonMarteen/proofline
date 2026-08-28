import { Body, Controller, Get, Param, Post, UseGuards, Inject } from "@nestjs/common";
import { z } from "zod";
import { ServiceTokenGuard } from "../auth/dev-auth.js";
import { PrismaService } from "../database/prisma.service.js";
import { redactFreeTextPII } from "../security/pii.js";
import { SupportService } from "../support/support.service.js";

const Completion=z.object({ok:z.boolean(),result:z.unknown().optional(),error:z.string().optional()});
@Controller("v1/internal")
@UseGuards(ServiceTokenGuard)
export class InternalController{
 constructor(@Inject(PrismaService) private readonly db:PrismaService,@Inject(SupportService) private readonly support:SupportService){}
 @Post("support/escalate-due") async supportEscalations(){return this.support.processSlaEscalations();}
 @Get("jobs/next") async next(){
  const now=new Date();
  return this.db.$transaction(async tx=>{
   const job=await tx.outboxEvent.findFirst({where:{status:"PENDING",availableAt:{lte:now}},orderBy:{createdAt:"asc"}}); if(!job)return null;
   return tx.outboxEvent.update({where:{id:job.id},data:{status:"PROCESSING",lockedAt:now,attempts:{increment:1}}});
  });
 }
 @Get("analysis-payload/:assessmentId") async payload(@Param("assessmentId") assessmentId:string){
  const a=await this.db.assessment.findUniqueOrThrow({where:{id:assessmentId},include:{questions:{orderBy:{order:"asc"}},participants:{where:{status:"COMPLETED"},include:{identity:true,response:{include:{answers:true}}}}}});
  const questionType=new Map(a.questions.map(q=>[q.id,q.type] as const));const safe=(qid:string,v:unknown)=>{const t=questionType.get(qid);return (t==="LONG_TEXT"||t==="SHORT_TEXT")&&typeof v==="string"?redactFreeTextPII(v):v};
  const responses=[] as any[];for(const p of a.participants){if(!p.response)continue;let segments:Record<string,string>={};if(a.privacyMode!=="ANONYMOUS"&&p.identity){const person=await this.db.directoryPerson.findFirst({where:{organizationId:a.organizationId,emailLookup:p.identity.emailLookup},include:{unit:true}});if(person?.unit)segments.department=person.unit.name;const attrs=(person?.attributes??{}) as Record<string,unknown>;for(const [k,v] of Object.entries(attrs))if(typeof v==="string")segments[k]=v;}responses.push({participant:p.pseudonym,segments,answers:Object.fromEntries(p.response.answers.map(x=>[x.questionId,safe(x.questionId,x.value)]))});}
  return {assessmentId:a.id,title:a.title,objective:a.objective,locale:a.locale,minCohortSize:a.minCohortSize,questions:a.questions.map(q=>({id:q.id,type:q.type,prompt:q.prompt,dimension:q.dimension,weight:q.weight,reverseScore:q.reverseScore,config:q.config})),responses};
 }
 @Post("jobs/:id/complete") async complete(@Param("id") id:string,@Body() body:unknown){
  const value=Completion.parse(body); const job=await this.db.outboxEvent.findUniqueOrThrow({where:{id}}); const payload=job.payload as Record<string,unknown>;
  if(job.type==="RUN_ANALYSIS"&&typeof payload.analysisRunId==="string"){
   await this.db.analysisRun.update({where:{id:payload.analysisRunId},data:value.ok?{status:"COMPLETED",result:value.result as any,completedAt:new Date()}:{status:"FAILED",error:value.error??"Unknown error",completedAt:new Date()}});
  }
  if(job.type==="SEND_EMAIL"&&typeof payload.reportDeliveryId==="string"){
    const delivery=await this.db.reportDelivery.update({where:{id:payload.reportDeliveryId},data:value.ok?{status:"SENT",sentAt:new Date(),error:null}:{status:"FAILED",error:value.error??"Unknown error"}}).catch(()=>undefined);
    if(delivery&&value.ok){const remaining=await this.db.reportDelivery.count({where:{reportId:delivery.reportId,status:{not:"SENT"}}});if(remaining===0)await this.db.report.update({where:{id:delivery.reportId},data:{status:"DISTRIBUTED",distributedAt:new Date()}}).catch(()=>undefined);}
  }
  const completedData = job.type==="SEND_EMAIL"
    ? {status:"COMPLETED" as const,result:value.result as any,payload:{category:(payload.category as string|undefined)??"email",scrubbed:true}}
    : {status:"COMPLETED" as const,result:value.result as any};
  await this.db.outboxEvent.update({where:{id},data:value.ok?completedData:{status:"FAILED",error:value.error??"Unknown error"}});
  return {ok:true};
 }
}
