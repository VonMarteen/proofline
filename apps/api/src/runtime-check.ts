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
let tempReportIds:string[]=[];
let tempAnalysisRunId:string|undefined;
let tempImportedAssessmentId:string|undefined;
let tempImportSourceRecordId:string|undefined;
let tempDeleteAssessmentId:string|undefined;
let tempResultRecipientId:string|undefined;
try{
  const health=app.get(HealthController),dashboard=app.get(DashboardController),respond=app.get(RespondController),legal=app.get(LegalController),assessments=app.get(AssessmentsController),workspace=app.get(WorkspaceController),internal=app.get(InternalController),reports=app.get(ReportService),imports=app.get(ImportService),payments=app.get(PaymentService),db=app.get(PrismaService);
  const ready=await health.health();if(!ready?.ok||ready.database!=="ready")throw new Error("HealthController did not report database ready");
  const dash=await dashboard.get("es",ownerReq);if(!(dash as any)?.organization?.slug||!Array.isArray((dash as any)?.activeAssessments)||typeof(dash as any)?.summary?.teamMembers!=="number")throw new Error("DashboardController did not return B2 workspace data");
  const team=await workspace.team(ownerReq);if(!Array.isArray((team as any)?.members)||(team as any).members.length===0)throw new Error("WorkspaceController did not return seeded team");
  const directoryMeta=await workspace.dirMeta(ownerReq) as any;if(!directoryMeta?.totalActive||!Array.isArray(directoryMeta.units))throw new Error("Directory metadata is incomplete");
  const directoryPage=await workspace.dirTable(ownerReq,"1","25",undefined,undefined) as any;if(!Array.isArray(directoryPage?.items)||directoryPage.items.length>25||directoryPage.pagination?.pageSize!==25)throw new Error("Directory server-side pagination contract failed");
  const searchProbe=directoryPage.items[0];if(searchProbe?.name){const firstToken=String(searchProbe.name).split(/\s+/).find(Boolean)??String(searchProbe.name);const q=firstToken.slice(0,Math.max(2,Math.min(5,firstToken.length)));const searched=await workspace.dirTable(ownerReq,"1","25",q,undefined) as any;if(!searched.items.some((row:any)=>row.id===searchProbe.id))throw new Error("Encrypted directory search index did not return the expected person");}
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
  const started=await workspace.start(ownerReq,framework.id,{level:"L2"}) as any;
  if(!started?.assessmentId||started.questionCount<1)throw new Error("Library 'Use as base' did not create an assessment");
  const createdAssessmentId=String(started.assessmentId);
  tempAssessmentId=createdAssessmentId;
  const created=await db.assessment.findUnique({where:{id:createdAssessmentId},include:{questions:{include:{translations:true}},translations:true,frameworkVersion:true}});
  if(!created||created.status!=="PREPARATION"||created.questions.length<1||!created.translations.some(t=>t.locale==="es")||created.questions.some(q=>!q.translations.some(t=>t.locale==="es")))throw new Error("Framework assessment clone is incomplete");
  const synthetic=await reports.preview(createdAssessmentId,true,"L1_EXECUTIVE");
  if(!synthetic.synthetic||!synthetic.dimensions.length||synthetic.overallScore==null||synthetic.level!=="L1_EXECUTIVE")throw new Error("Synthetic report preview is incomplete for a framework assessment");

  // C2.5.2 participant flow: autosave -> resume -> atomic/idempotent final submission.
  const noticeText="Runtime C2.5.2 participant notice";
  const notice=await db.participantNoticeVersion.create({data:{assessmentId:createdAssessmentId,version:"runtime-1",locale:"es",title:"Antes de comenzar",content:noticeText,contentHash:sha256(noticeText),active:true}});
  await db.assessment.update({where:{id:createdAssessmentId},data:{status:"ACTIVE"}});
  const token=`runtime-framework-${Date.now()}`;
  const participant=await db.participant.create({data:{assessmentId:createdAssessmentId,pseudonym:`runtime-${Date.now()}`,tokenHash:sha256(token),status:"INVITED",segmentSnapshot:{department:"Runtime QA"}}});
  tempParticipantPseudonym=participant.pseudonym;
  const participantView=await respond.get(token,"es") as any;
  if(!participantView?.id||participantView.questions.length!==created.questions.length)throw new Error("Participant preview did not receive cloned framework questions");
  const answers=Object.fromEntries(participantView.questions.filter((q:any)=>q.type!=="INFO").map((q:any)=>[q.id,q.type==="LONG_TEXT"||q.type==="SHORT_TEXT"?"Prueba runtime de Proofline":4]));
  const firstAnswer=Object.entries(answers).slice(0,1);
  const draftAnswers=Object.fromEntries(firstAnswer);
  const saved=await respond.save(token,{noticeVersionId:notice.id,locale:"es",answers:draftAnswers}) as any;
  if(!saved?.ok||saved.alreadyCompleted)throw new Error("Respond autosave did not persist a draft");
  const startedParticipant=await db.participant.findUnique({where:{id:participant.id},include:{response:{include:{answers:true}}}});
  if(startedParticipant?.status!=="STARTED"||!startedParticipant.startedAt||startedParticipant.response?.answers.length!==firstAnswer.length)throw new Error("Autosave did not persist STARTED state and draft answers atomically");
  const resumed=await respond.get(token,"es") as any;
  if(!resumed?.draft||Object.keys(resumed.draft.answers??{}).length!==firstAnswer.length)throw new Error("Respond resume did not return the persisted draft");
  const submitted=await respond.submit(token,{noticeVersionId:notice.id,locale:"es",answers}) as any;
  if(!submitted?.ok||submitted.analysisQueued!==false||submitted.alreadyCompleted)throw new Error("Participant submission did not complete with analysis deferred until assessment close");
  const repeated=await respond.submit(token,{noticeVersionId:notice.id,locale:"es",answers}) as any;
  if(!repeated?.ok||!repeated.alreadyCompleted)throw new Error("Participant submission retry is not idempotent");
  const saveAfterCompletion=await respond.save(token,{noticeVersionId:notice.id,locale:"es",answers:draftAnswers}) as any;
  if(!saveAfterCompletion?.ok||!saveAfterCompletion.alreadyCompleted)throw new Error("Autosave modified or rejected an already completed response instead of remaining idempotent");
  const completedParticipant=await db.participant.findUnique({where:{id:participant.id},include:{response:{include:{answers:true}}}});
  if(completedParticipant?.status!=="COMPLETED"||!completedParticipant.response||completedParticipant.response.answers.length!==Object.keys(answers).length)throw new Error("Participant final response was not persisted completely");
  tempResponseId=completedParticipant.response.id;
  const usage=await db.usageEvent.findUnique({where:{idempotencyKey:`response-completed:${completedParticipant.response.id}`}});
  if(!usage?.billable)throw new Error("Completed participant response did not reach usage ledger");
  const completionEvents=await db.auditEvent.count({where:{actorId:participant.pseudonym,action:"ASSESSMENT_COMPLETED",targetId:createdAssessmentId}});
  const startEvents=await db.auditEvent.count({where:{actorId:participant.pseudonym,action:"ASSESSMENT_STARTED",targetId:createdAssessmentId}});
  if(completionEvents!==1||startEvents!==1)throw new Error("Respond start/completion audit evidence is missing or duplicated");
  const expiredToken=`runtime-expired-${Date.now()}`;
  await db.participant.create({data:{assessmentId:createdAssessmentId,pseudonym:`runtime-expired-${Date.now()}`,tokenHash:sha256(expiredToken),status:"INVITED",expiresAt:new Date(Date.now()-60_000)}});
  let expiredDenied=false;try{await respond.get(expiredToken,"es")}catch{expiredDenied=true}if(!expiredDenied)throw new Error("Expired Respond invitation remained usable");
  const closedToken=`runtime-closed-${Date.now()}`;
  await db.participant.create({data:{assessmentId:createdAssessmentId,pseudonym:`runtime-closed-${Date.now()}`,tokenHash:sha256(closedToken),status:"INVITED"}});
  await db.assessment.update({where:{id:createdAssessmentId},data:{status:"CLOSED"}});
  let closedDenied=false;try{await respond.save(closedToken,{noticeVersionId:notice.id,locale:"es",answers:{}})}catch{closedDenied=true}if(!closedDenied)throw new Error("Closed assessment accepted Respond autosave");
  await db.assessment.update({where:{id:createdAssessmentId},data:{status:"ACTIVE"}});

  const assessmentList=await assessments.list(ownerReq);if(!Array.isArray(assessmentList)||assessmentList.length===0)throw new Error("AssessmentsController did not return seeded assessments");
  const workspaceOrganizationId=String((dash as any).organization.id);
  if((assessmentList as any[]).some(a=>a.organizationId!==workspaceOrganizationId))throw new Error("Workspace assessment list leaked data across organizations");
  const active=(assessmentList as any[]).find(a=>a.status==="ACTIVE")??assessmentList[0];
  const launchGate=await assessments.launchChecklist(ownerReq,active.id) as any;if(typeof launchGate?.brandingConfigured!=="boolean"||typeof launchGate?.visualPreviewApproved!=="boolean"||typeof launchGate?.subscriptionReady!=="boolean"||typeof launchGate?.entitlementsReady!=="boolean"||!Array.isArray(launchGate?.missing))throw new Error("Assessment launch-governance gates are incomplete");
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
  if(typeof analysisPayload.sourceHash!=="string"||analysisPayload.sourceHash.length!==64)throw new Error("Analysis payload sourceHash is missing or invalid");

  // C2.5.3 deterministic scoring: same source must produce the same scoring hash and metadata.
  const analyticsUrl=process.env.ANALYTICS_URL??"http://127.0.0.1:4281";
  const analyzeOnce=async()=>{const response=await fetch(`${analyticsUrl}/analyze`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(analysisPayload)});if(!response.ok)throw new Error(`Analytics runtime failed ${response.status}: ${await response.text()}`);return response.json() as Promise<any>};
  const scoredA=await analyzeOnce(),scoredB=await analyzeOnce();
  if(scoredA.sourceHash!==analysisPayload.sourceHash||scoredB.sourceHash!==analysisPayload.sourceHash)throw new Error("Analytics did not preserve sourceHash");
  if(typeof scoredA.calculationHash!=="string"||scoredA.calculationHash.length!==64||scoredA.calculationHash!==scoredB.calculationHash)throw new Error("Deterministic calculationHash is missing or changed for the same source");
  if(JSON.stringify(scoredA.questionScores)!==JSON.stringify(scoredB.questionScores)||JSON.stringify(scoredA.dimensionScores)!==JSON.stringify(scoredB.dimensionScores)||scoredA.overallScore!==scoredB.overallScore)throw new Error("Deterministic scoring changed for the same source");
  if(!scoredA.sampleMetadata||typeof scoredA.sampleMetadata.completedResponses!=="number"||!scoredA.sampleMetadata.questions)throw new Error("Scoring sample metadata is incomplete");
  if(scoredA.gapConvention!=="target-minus-observed"||!scoredA.questionTargets||!scoredA.questionGaps)throw new Error("Scoring target/gap contract is incomplete");

  // C2.5.4 Results -> one canonical immutable snapshot -> L1/L2/L3/L4 -> PDF/export -> approval -> queued distribution.
  const injectedResult={
    engine:{name:"runtime-check",version:"1",aiUsed:false},assessmentId:active.id,assessmentVersionId:analysisPayload.assessmentVersionId,assessmentVersion:analysisPayload.assessmentVersion,assessmentLevel:analysisPayload.assessmentLevel,
    sourceHash:analysisPayload.sourceHash,calculationHash:"a".repeat(64),objective:active.objective,completedResponses:6,
    overallScore:71.4,overallTarget:80,overallGap:8.6,gapConvention:"target-minus-observed",
    dimensionScores:{Confianza:75,Comunicación:67.8},dimensionTargets:{Confianza:82,Comunicación:78},dimensionGaps:{Confianza:7,Comunicación:10.2},
    questionScores:{},questionTargets:{},questionGaps:{},sampleMetadata:{completedResponses:6,overallN:6,questions:{},dimensions:{Confianza:6,Comunicación:6}},
    dualGaps:[],qualitativeThemes:[{theme:"claridad",mentions:3,example:"Más claridad en prioridades."}],
    cohorts:{"department:Operaciones":{suppressed:false,n:6,score:69.8},"department:Grupo reducido":{suppressed:true,n:2}},
    highlights:["Confianza es la dimensión con mayor puntuación: 75/100.","Comunicación presenta la mayor brecha frente al target."],
    evidencePolicy:"Sólo observación; prueba runtime.",generatedAt:new Date().toISOString()
  };
  const injected=await db.analysisRun.create({data:{assessmentId:active.id,assessmentVersionId:analysisPayload.assessmentVersionId??null,sourceHash:analysisPayload.sourceHash,status:"COMPLETED",result:injectedResult as any,completedAt:new Date()}});tempAnalysisRunId=injected.id;
  const reportLevels=["L1_EXECUTIVE","L2_DIAGNOSTIC","L3_ANALYTICAL","L4_STRATEGIC"] as const;
  const generatedReports=[];
  for(const level of reportLevels){
    const generated=await reports.generate(active.id,level);tempReportIds.push(generated.id);generatedReports.push(generated);
    if(!generated.snapshotHash)throw new Error(`Generated ${level} report does not preserve snapshot hash`);
    const pdf=await reports.pdf(generated.id);if(pdf.subarray(0,4).toString()!=="%PDF")throw new Error(`Generated ${level} report is not a valid PDF stream`);
    const json=JSON.parse((await reports.exportJson(generated.id)).toString("utf8"));if(json.snapshotHash!==generated.snapshotHash||json.level!==level)throw new Error(`${level} JSON export is not tied to the report snapshot`);
    const csv=(await reports.exportCsv(generated.id)).toString("utf8");if(!csv.includes(generated.snapshotHash)||!csv.includes(level))throw new Error(`${level} CSV export is not tied to the report snapshot`);
  }
  if(new Set(generatedReports.map(report=>report.snapshotHash)).size!==1)throw new Error("L1-L4 reports did not use the same canonical snapshot");
  const storedView=await reports.view(generatedReports[3]!.id) as any;
  if(storedView.snapshotHash!==generatedReports[0]?.snapshotHash||storedView.level!=="L4_STRATEGIC")throw new Error("Workspace report view is not derived from the same stored canonical snapshot");
  const report=generatedReports[0]!;
  const approved=await reports.approve(report.id);if(approved.status!=="APPROVED")throw new Error("Report approval failed");
  const runtimeRecipientEmail=`runtime-report-${Date.now()}@proofline.local`;
  const runtimeRecipient=await workspace.addrec(ownerReq,active.id,{displayName:"Runtime Report Recipient",email:runtimeRecipientEmail,roleLabel:"Runtime QA",locale:"es"}) as any;
  tempResultRecipientId=String(runtimeRecipient.id);
  const distribution=await reports.distribute(report.id) as any;if(!distribution?.ok||distribution.queued<1||distribution.snapshotHash!==report.snapshotHash)throw new Error("Report distribution was not queued from the canonical snapshot");
  const deliveries=await db.reportDelivery.findMany({where:{reportId:report.id}});if(!deliveries.length||deliveries.some(d=>d.status!=="PENDING"))throw new Error("Report delivery records are incomplete");

  const demo=await respond.get("demo-token-2026","es");if(!(demo as any)?.id||!Array.isArray((demo as any)?.questions))throw new Error("RespondController did not resolve demo participant");
  const docs=await legal.publicDocs();if(!Array.isArray(docs)||docs.length===0)throw new Error("LegalController did not return seeded legal documents");
  console.log(`[OK] Critical runtime C2 client plane · Workspace + Respond · delete=safe · import=${importedAssessment.questions.length}q · libraryClone=${created.questions.length}q · participant=autosave+resume+idempotent-submit · scoring=deterministic+sourceHash · ledger=billable · report=L1-L4+canonical-snapshot+PDF+JSON+CSV+approved+${distribution.queued} queued · payments=foundation-declared · launchGovernance=ready · frameworks=${frameworks.length}`);
}finally{
  const db=app.get(PrismaService);
  // Remove only artifacts created by this runtime check. Product/seed data remains untouched.
  if(tempDeleteAssessmentId){await db.auditEvent.deleteMany({where:{targetId:tempDeleteAssessmentId}}).catch(()=>undefined);await db.assessment.delete({where:{id:tempDeleteAssessmentId}}).catch(()=>undefined);}
  if(tempReportIds.length){
    const deliveries=await db.reportDelivery.findMany({where:{reportId:{in:tempReportIds}},select:{id:true}}).catch(()=>[] as Array<{id:string}>);
    const jobs=await db.outboxEvent.findMany({where:{type:"SEND_EMAIL"}});
    const reportIdSet=new Set(tempReportIds);
    const ids=jobs.filter(j=>reportIdSet.has(String((j.payload as any)?.reportId??""))).map(j=>j.id);
    if(ids.length)await db.outboxEvent.deleteMany({where:{id:{in:ids}}});
    const auditTargets=[...tempReportIds,...deliveries.map(d=>d.id)];
    if(auditTargets.length)await db.auditEvent.deleteMany({where:{targetId:{in:auditTargets}}}).catch(()=>undefined);
    await db.report.deleteMany({where:{id:{in:tempReportIds}}}).catch(()=>undefined);
  }
  if(tempResultRecipientId)await db.resultRecipient.delete({where:{id:tempResultRecipientId}}).catch(()=>undefined);
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
