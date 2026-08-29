import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { applyLocalDefaults } from "./local-env.js";
import { HealthController } from "./health/health.controller.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { RespondController } from "./respond/respond.controller.js";
import { LegalController } from "./legal/legal.controller.js";
import { AssessmentsController } from "./assessments/assessments.controller.js";
import { WorkspaceController } from "./workspace.controller.js";
import { InternalController } from "./internal/internal.controller.js";
import { ReportService } from "./reports/report.service.js";
import { ImportService } from "./imports/import.service.js";
import { PrismaService } from "./database/prisma.service.js";
import { requireCapability } from "./auth/access-control.js";
import { sha256 } from "./security/crypto.js";
import { PaymentService } from "./payments/payment.service.js";
import type { HeaderRequest } from "./auth/dev-auth.js";

applyLocalDefaults();
const req=(email:string,claimedRole="OWNER"):HeaderRequest=>({headers:{"x-proofline-user":email,"x-proofline-role":claimedRole}});
const ownerReq=req("ana@acme.local");
const analystReq=req("luis@acme.local","OWNER");
const billingReq=req("billing@acme.local","OWNER");
const managerReq=req("marta@acme.local","OWNER");

const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
let tempAssessmentId:string|undefined;
let tempParticipantPseudonym:string|undefined;
let tempResponseId:string|undefined;
let tempReportId:string|undefined;
let tempAnalysisRunId:string|undefined;
let tempImportedAssessmentId:string|undefined;
let tempImportSourceRecordId:string|undefined;
let tempDeleteAssessmentId:string|undefined;
try{
  const health=app.get(HealthController),dashboard=app.get(DashboardController),respond=app.get(RespondController),legal=app.get(LegalController),assessments=app.get(AssessmentsController),workspace=app.get(WorkspaceController),internal=app.get(InternalController),reports=app.get(ReportService),imports=app.get(ImportService),payments=app.get(PaymentService),db=app.get(PrismaService);
  const ready=await health.health();if(!ready?.ok||ready.database!=="ready")throw new Error("HealthController did not report database ready");
  const dash=await dashboard.get("es",ownerReq);if(!(dash as any)?.organization?.slug||!Array.isArray((dash as any)?.activeAssessments)||typeof(dash as any)?.summary?.teamMembers!=="number")throw new Error("DashboardController did not return B2 workspace data");
  const team=await workspace.team(ownerReq);if(!Array.isArray((team as any)?.members)||(team as any).members.length===0)throw new Error("WorkspaceController did not return seeded team");
  const frameworks=await workspace.frameworks(ownerReq);if(!Array.isArray(frameworks)||frameworks.length<35)throw new Error("WorkspaceController framework catalog is incomplete");

  // Draft lifecycle cleanup: never-launched assessments can be deleted, while execution history remains protected.
  const disposable=await workspace.create(ownerReq,{title:"Runtime disposable assessment",objective:"Verify safe deletion of a never-launched assessment."}) as any;
  tempDeleteAssessmentId=String(disposable.assessmentId);
  const deleted=await assessments.removeAssessment(ownerReq,tempDeleteAssessmentId) as any;if(!deleted?.deleted)throw new Error("Never-launched assessment deletion did not complete");
  if(await db.assessment.findUnique({where:{id:tempDeleteAssessmentId}}))throw new Error("Deleted assessment still exists");
  await db.auditEvent.deleteMany({where:{targetId:tempDeleteAssessmentId,action:"ASSESSMENT_DELETED"}}).catch(()=>undefined);tempDeleteAssessmentId=undefined;

  // B2.4 import -> proposal -> editable assessment. Original source bytes must remain attached to an immutable record.
  const importText=`Diagnóstico de cambio\n¿Comprendes por qué se está realizando este cambio?\nValora en una escala tu confianza en la dirección del cambio.\n¿Dispones de las herramientas necesarias para adoptar el cambio?\n¿Qué debería recibir atención prioritaria y por qué?\n¿La comunicación llega con suficiente claridad?`;
  const analyzedImport=await imports.analyze((dash as any).organization.id,{fileName:"runtime-change-questionnaire.txt",mimeType:"text/plain",base64:Buffer.from(importText).toString("base64"),extractedText:importText});
  if(!analyzedImport?.id||!Array.isArray(analyzedImport.questions)||analyzedImport.questions.length<4)throw new Error("Assessment import did not produce a usable proposal");
  tempImportSourceRecordId=analyzedImport.sourceRecordId;
  const importRecord=await db.documentRecord.findUnique({where:{id:analyzedImport.sourceRecordId},include:{blob:true}});if(!importRecord?.blob?.bytes?.length||!importRecord.immutable)throw new Error("Imported source document was not retained as an immutable record");
  const appliedImport=await imports.apply((dash as any).organization.id,analyzedImport.id,"runtime@proofline.local");tempImportedAssessmentId=appliedImport.assessmentId;
  const importedAssessment=await db.assessment.findUnique({where:{id:appliedImport.assessmentId},include:{questions:true,imports:true}});if(!importedAssessment||importedAssessment.status!=="PREPARATION"||importedAssessment.questions.length<4||importedAssessment.imports[0]?.status!=="APPLIED")throw new Error("Analyzed document was not converted into an editable assessment");

  // Critical Library -> editable assessment flow. This is intentionally executed, verified and cleaned up.
  const framework=(frameworks as any[]).find(f=>Array.isArray(f?.latestVersion?.questionBlueprint)&&f.latestVersion.questionBlueprint.length>0)??frameworks[0];
  const started=await workspace.start(ownerReq,framework.id) as any;
  if(!started?.assessmentId||started.questionCount<1)throw new Error("Library 'Use as base' did not create an assessment");
  const createdAssessmentId=String(started.assessmentId);
  tempAssessmentId=createdAssessmentId;
  const created=await db.assessment.findUnique({where:{id:createdAssessmentId},include:{questions:{include:{translations:true}},translations:true,frameworkVersion:true}});
  if(!created||created.status!=="PREPARATION"||created.questions.length<1||!created.translations.some(t=>t.locale==="es")||created.questions.some(q=>!q.translations.some(t=>t.locale==="es")))throw new Error("Framework assessment clone is incomplete");
  const synthetic=await reports.snapshot(createdAssessmentId,true);
  if(!synthetic.synthetic||!synthetic.dimensions.length||synthetic.overallScore==null)throw new Error("Synthetic report preview is incomplete for a framework assessment");

  // Participant flow on the temporary cloned assessment.
  const noticeText="Runtime B2.3 participant notice";
  const notice=await db.participantNoticeVersion.create({data:{assessmentId:createdAssessmentId,version:"runtime-1",locale:"es",title:"Antes de comenzar",content:noticeText,contentHash:sha256(noticeText),active:true}});
  const token=`runtime-framework-${Date.now()}`;
  const participant=await db.participant.create({data:{assessmentId:createdAssessmentId,pseudonym:`runtime-${Date.now()}`,tokenHash:sha256(token),status:"INVITED"}});
  tempParticipantPseudonym=participant.pseudonym;
  const participantView=await respond.get(token,"es") as any;
  if(!participantView?.id||participantView.questions.length!==created.questions.length)throw new Error("Participant preview did not receive cloned framework questions");
  const answers=Object.fromEntries(participantView.questions.filter((q:any)=>q.type!=="INFO").map((q:any)=>[q.id,q.type==="LONG_TEXT"||q.type==="SHORT_TEXT"?"Prueba runtime de Proofline":4]));
  const submitted=await respond.submit(token,{noticeVersionId:notice.id,locale:"es",answers}) as any;
  if(!submitted?.ok||!submitted.analysisQueued)throw new Error("Participant submission did not complete or queue analysis");
  const completedParticipant=await db.participant.findUnique({where:{id:participant.id},include:{response:true}});
  if(completedParticipant?.status!=="COMPLETED"||!completedParticipant.response)throw new Error("Participant response was not persisted");
  tempResponseId=completedParticipant.response.id;
  const usage=await db.usageEvent.findUnique({where:{idempotencyKey:`response-completed:${completedParticipant.response.id}`}});
  if(!usage?.billable)throw new Error("Completed participant response did not reach usage ledger");

  const assessmentList=await assessments.list(ownerReq);if(!Array.isArray(assessmentList)||assessmentList.length===0)throw new Error("AssessmentsController did not return seeded assessments");
  const workspaceOrganizationId=String((dash as any).organization.id);
  if((assessmentList as any[]).some(a=>a.organizationId!==workspaceOrganizationId))throw new Error("Workspace assessment list leaked data across organizations");
  const active=(assessmentList as any[]).find(a=>a.status==="ACTIVE")??assessmentList[0];
  const launchGate=await assessments.cl(ownerReq,active.id) as any;if(typeof launchGate?.brandingConfigured!=="boolean"||typeof launchGate?.visualPreviewApproved!=="boolean"||typeof launchGate?.subscriptionReady!=="boolean"||typeof launchGate?.entitlementsReady!=="boolean"||!Array.isArray(launchGate?.missing))throw new Error("Assessment launch-governance gates are incomplete");
  let executionDeleteDenied=false;try{await assessments.removeAssessment(ownerReq,active.id)}catch{executionDeleteDenied=true}if(!executionDeleteDenied)throw new Error("Assessment with execution history was unexpectedly deletable");
  const analystMembership=await db.membership.findFirst({where:{organizationId:workspaceOrganizationId,user:{email:"luis@acme.local"}},include:{assessmentAccesses:{where:{assessment:{organizationId:workspaceOrganizationId}}}}});
  if(!analystMembership)throw new Error("Runtime analyst membership is missing");
  const analystAllowedIds=new Set(analystMembership.assessmentAccesses.map(g=>g.assessmentId));
  const analystList=await assessments.list(analystReq);
  if(!Array.isArray(analystList)||analystList.some((a:any)=>a.organizationId!==workspaceOrganizationId||!analystAllowedIds.has(a.id))||analystList.length!==analystAllowedIds.size)throw new Error("Analyst assessment scope is not enforced");
  let denied=false;try{await workspace.billing(analystReq)}catch{denied=true}if(!denied)throw new Error("Analyst unexpectedly accessed billing");
  const billing=await workspace.billing(billingReq);if(!(billing as any)?.visible)throw new Error("Billing Admin could not access billing");
  const paymentSummary=await payments.workspaceSummary(billingReq) as any;if(!Array.isArray(paymentSummary?.methods)||!Array.isArray(paymentSummary?.history)||!Array.isArray(paymentSummary?.transactions)||!Array.isArray(paymentSummary?.providers)||!paymentSummary.providers.includes("REDSYS")||!paymentSummary.providers.includes("PAYPAL")||!paymentSummary.providers.includes("BANK_TRANSFER"))throw new Error("Workspace payment foundation is incomplete");
  denied=false;try{await assessments.list(billingReq)}catch{denied=true}if(!denied)throw new Error("Billing Admin unexpectedly accessed assessments");
  denied=false;try{await requireCapability(db,managerReq,"assessment.approve",active.id)}catch{denied=true}if(!denied)throw new Error("Assessment Manager unexpectedly received approval capability");

  // Segmentation must reach analytics payload for confidential/pseudonymous assessments.
  const analysisPayload=await internal.payload(active.id) as any;
  if(!Array.isArray(analysisPayload?.responses)||!analysisPayload.responses.length)throw new Error("Analysis payload has no completed responses");
  if(active.privacyMode!=="ANONYMOUS"&&!analysisPayload.responses.some((r:any)=>typeof r?.segments?.department==="string"))throw new Error("Department segmentation did not propagate to analytics payload");

  // Results -> immutable report snapshot -> PDF -> approval -> queued distribution.
  const injectedResult={engine:{name:"runtime-check",version:"1",aiUsed:false},assessmentId:active.id,objective:active.objective,completedResponses:6,overallScore:71.4,dimensionScores:{Confianza:75,Comunicación:67.8},questionScores:{},dualGaps:[],qualitativeThemes:[{theme:"claridad",mentions:3,example:"Más claridad en prioridades."}],cohorts:{},highlights:["Confianza es la dimensión con mayor puntuación: 75/100."],evidencePolicy:"Sólo observación; prueba runtime.",generatedAt:new Date().toISOString()};
  const injected=await db.analysisRun.create({data:{assessmentId:active.id,status:"COMPLETED",result:injectedResult as any,completedAt:new Date()}});tempAnalysisRunId=injected.id;
  const report=await reports.generate(active.id,"EXECUTIVE");tempReportId=report.id;
  if(!report.snapshotHash)throw new Error("Generated report does not preserve snapshot hash");
  const pdf=await reports.pdf(report.id);if(pdf.subarray(0,4).toString()!=="%PDF")throw new Error("Generated report is not a valid PDF stream");
  const approved=await reports.approve(report.id);if(approved.status!=="APPROVED")throw new Error("Report approval failed");
  const distribution=await reports.distribute(report.id) as any;if(!distribution?.ok||distribution.queued<1)throw new Error("Report distribution was not queued for authorized recipients");
  const deliveries=await db.reportDelivery.findMany({where:{reportId:report.id}});if(!deliveries.length||deliveries.some(d=>d.status!=="PENDING"))throw new Error("Report delivery records are incomplete");

  const demo=await respond.get("demo-token-2026","es");if(!(demo as any)?.id||!Array.isArray((demo as any)?.questions))throw new Error("RespondController did not resolve demo participant");
  const docs=await legal.publicDocs();if(!Array.isArray(docs)||docs.length===0)throw new Error("LegalController did not return seeded legal documents");
  console.log(`[OK] Critical runtime C2 client plane · Workspace + Respond · delete=safe · import=${importedAssessment.questions.length}q · libraryClone=${created.questions.length}q · participant=completed · ledger=billable · report=PDF+approved+${distribution.queued} queued · payments=ready · launchGovernance=ready · frameworks=${frameworks.length}`);
}finally{
  const db=app.get(PrismaService);
  // Remove only artifacts created by this runtime check. Product/seed data remains untouched.
  if(tempDeleteAssessmentId){await db.auditEvent.deleteMany({where:{targetId:tempDeleteAssessmentId}}).catch(()=>undefined);await db.assessment.delete({where:{id:tempDeleteAssessmentId}}).catch(()=>undefined);}
  if(tempReportId){
    const jobs=await db.outboxEvent.findMany({where:{type:"SEND_EMAIL",status:{in:["PENDING","PROCESSING"]}}});
    const ids=jobs.filter(j=>(j.payload as any)?.reportId===tempReportId).map(j=>j.id);
    if(ids.length)await db.outboxEvent.deleteMany({where:{id:{in:ids}}});
    await db.report.delete({where:{id:tempReportId}}).catch(()=>undefined);
  }
  if(tempAnalysisRunId)await db.analysisRun.delete({where:{id:tempAnalysisRunId}}).catch(()=>undefined);
  if(tempImportedAssessmentId)await db.assessment.delete({where:{id:tempImportedAssessmentId}}).catch(()=>undefined);
  if(tempImportSourceRecordId)await db.documentRecord.delete({where:{id:tempImportSourceRecordId}}).catch(()=>undefined);
  if(tempAssessmentId){
    const jobs=await db.outboxEvent.findMany({where:{status:{in:["PENDING","PROCESSING"]}}});
    const ids=jobs.filter(j=>(j.payload as any)?.assessmentId===tempAssessmentId).map(j=>j.id);
    if(ids.length)await db.outboxEvent.deleteMany({where:{id:{in:ids}}});
    if(tempParticipantPseudonym){await db.legalInteraction.deleteMany({where:{actorRef:tempParticipantPseudonym}}).catch(()=>undefined);await db.auditEvent.deleteMany({where:{actorId:tempParticipantPseudonym}}).catch(()=>undefined);}
    if(tempResponseId)await db.usageEvent.deleteMany({where:{idempotencyKey:`response-completed:${tempResponseId}`}}).catch(()=>undefined);
    await db.auditEvent.deleteMany({where:{targetId:tempAssessmentId}}).catch(()=>undefined);
    await db.assessment.delete({where:{id:tempAssessmentId}}).catch(()=>undefined);
  }
  await app.close();
}
