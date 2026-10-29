import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { applyLocalDefaults } from "./local-env.js";
import { WorkspaceController } from "./workspace.controller.js";
import { AssessmentsController } from "./assessments/assessments.controller.js";
import { RespondController } from "./respond/respond.controller.js";
import { ReportsController } from "./reports/reports.controller.js";
import { ReportService } from "./reports/report.service.js";
import { PrismaService } from "./database/prisma.service.js";
import type { HeaderRequest } from "./auth/dev-auth.js";

applyLocalDefaults();

const ownerReq: HeaderRequest = { headers: { "x-proofline-user": "ana@acme.local", "x-proofline-role": "OWNER" } };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function fail(message: string): never { throw new Error(message); }
function ensure(condition: unknown, message: string): asserts condition { if (!condition) fail(message); }
const unique = <T>(items: T[]) => [...new Set(items)];

function tokenFromText(text: string) {
  return text.match(/\/(?:es|en)\/(pl_[A-Za-z0-9_-]+)/)?.[1] ?? null;
}

async function tokensFromOutbox(db: PrismaService, assessmentId: string) {
  const jobs = await db.outboxEvent.findMany({ where: { type: "SEND_EMAIL" }, orderBy: { createdAt: "desc" }, take: 250 });
  const tokens: string[] = [];
  for (const job of jobs) {
    const payload = job.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : {};
    if (payload.category !== "participant-invite" || payload.assessmentId !== assessmentId || typeof payload.text !== "string") continue;
    const token = tokenFromText(payload.text);
    if (token) tokens.push(token);
  }
  return unique(tokens);
}

async function tokensFromMailpit(subject: string) {
  const base = process.env.MAILPIT_WEB_URL ?? "http://127.0.0.1:4280";
  const response = await fetch(`${base}/api/v1/messages`).catch(() => null);
  if (!response?.ok) return [] as string[];
  const body = await response.json().catch(() => ({})) as any;
  const messages = Array.isArray(body?.messages) ? body.messages.filter((message: any) => message?.Subject === subject && message?.ID) : [];
  const tokens: string[] = [];
  for (const message of messages.slice(0, 20)) {
    const textResponse = await fetch(`${base}/view/${encodeURIComponent(String(message.ID))}.txt`).catch(() => null);
    if (!textResponse?.ok) continue;
    const token = tokenFromText(await textResponse.text());
    if (token) tokens.push(token);
  }
  return unique(tokens);
}

async function cleanupPilotMailpitMessages() {
  if (process.env.PILOT_KEEP_EMAILS === "1") return 0;
  const base = process.env.MAILPIT_WEB_URL ?? "http://127.0.0.1:4280";
  const response = await fetch(`${base}/api/v1/messages?start=0&limit=200`).catch(() => null);
  if (!response?.ok) return 0;
  const body = await response.json().catch(() => ({})) as any;
  const ids = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((message: any) => typeof message?.Subject === "string" && message.Subject.includes("Pilot E2E") && message?.ID)
    .map((message: any) => String(message.ID));
  if (!ids.length) return 0;
  const deleted = await fetch(`${base}/api/v1/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: ids }),
  }).catch(() => null);
  return deleted?.ok ? ids.length : 0;
}

async function waitForInviteTokens(db: PrismaService, assessmentId: string, subject: string, expected: number, timeoutMs = 30000): Promise<string[]> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tokens = unique([...(await tokensFromOutbox(db, assessmentId)), ...(await tokensFromMailpit(subject))]);
    if (tokens.length >= expected) return tokens.slice(0, expected);
    await sleep(500);
  }
  throw new Error(`Pilot E2E could not recover ${expected} participant invitation tokens from Outbox/Mailpit`);
}

async function waitForAnalysis(db: PrismaService, analysisRunId: string, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await db.analysisRun.findUnique({ where: { id: analysisRunId } });
    if (run?.status === "COMPLETED") return run;
    if (run?.status === "FAILED") fail(`Pilot analysis failed: ${run.error ?? "unknown error"}`);
    await sleep(750);
  }
  throw new Error("Pilot analysis did not complete before timeout; verify worker and analytics services");
}

async function waitForReportDelivery(db: PrismaService, reportId: string, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const report = await db.report.findUnique({ where: { id: reportId }, include: { deliveries: true } });
    if (report?.deliveries.length && report.deliveries.every((delivery) => delivery.status === "SENT") && report.status === "DISTRIBUTED") return report;
    if (report?.deliveries.some((delivery) => delivery.status === "FAILED")) fail("Pilot report delivery failed");
    await sleep(500);
  }
  throw new Error("Pilot report distribution did not complete before timeout; verify worker and Mailpit");
}

function answersFor(view: any, participantIndex: number) {
  const answers: Record<string, unknown> = {};
  for (const [index, question] of (view.questions ?? []).entries()) {
    if (question.type === "INFO") continue;
    if (question.type === "LONG_TEXT" || question.type === "SHORT_TEXT") answers[question.id] = `Pilot E2E evidence ${participantIndex + 1}: claridad, coordinación y prioridades observables.`;
    else answers[question.id] = 4 + ((participantIndex + index) % 2);
  }
  return answers;
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
let assessmentId: string | undefined;
let mutatedPerson: { id: string; unitId: string | null; attributes: unknown } | undefined;
const reportIds: string[] = [];
let analysisRunId: string | undefined;
let temporarySubscriptionId: string | undefined;
try {
  const workspace = app.get(WorkspaceController);
  const assessments = app.get(AssessmentsController);
  const respond = app.get(RespondController);
  const reportsController = app.get(ReportsController);
  const reports = app.get(ReportService);
  const db = app.get(PrismaService);

  const clearedPilotEmails = await cleanupPilotMailpitMessages();
  if (clearedPilotEmails) console.log(`[INFO] Pilot E2E cleaned ${clearedPilotEmails} stale Mailpit messages before the run`);

  const branding = await workspace.getBranding(ownerReq) as any;
  ensure(branding?.configured && branding?.launchEligible, "Pilot gate requires configured organization branding with logo and accessible colors");

  const directory = await workspace.dir(ownerReq) as any;
  ensure(Array.isArray(directory?.people) && directory.people.length >= 6, "Pilot gate requires at least six active directory people");
  const selectedPeople = directory.people.slice(0, 6);

  const stamp = Date.now();
  const title = `Pilot E2E ${stamp}`;
  const created = await workspace.create(ownerReq, { title, objective: "Verify the complete Proofline pilot lifecycle with deterministic scoring and traceable reporting." }) as any;
  assessmentId = String(created.assessmentId);

  // The pilot gate is local and repeatable: if the demo seed trial expired, create a
  // temporary ACTIVE subscription only for this E2E run. Product launch governance
  // remains unchanged and the fixture is deleted in finally.
  const pilotAssessment = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { organizationId: true } });
  const currentSubscription = await db.subscription.findFirst({
    where: { organizationId: pilotAssessment.organizationId, status: { in: ["TRIAL", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
  });
  const currentSubscriptionEligible = Boolean(currentSubscription && (currentSubscription.status !== "TRIAL" || !currentSubscription.renewsAt || currentSubscription.renewsAt > new Date()));
  if (!currentSubscriptionEligible) {
    const pilotPlan = await db.plan.findUnique({ where: { code: "PROFESSIONAL" } }) ?? await db.plan.findFirst({ orderBy: { createdAt: "asc" } });
    ensure(pilotPlan, "Pilot gate requires at least one local plan fixture");
    const temporarySubscription = await db.subscription.create({
      data: {
        organizationId: pilotAssessment.organizationId,
        planId: pilotPlan.id,
        status: "ACTIVE",
        externalRef: `pilot-e2e:${stamp}`,
        renewsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    temporarySubscriptionId = temporarySubscription.id;
  }

  await assessments.governance(ownerReq, assessmentId, { privacyMode: "CONFIDENTIAL", minCohortSize: 5, locale: "es" });
  await assessments.configure(ownerReq, assessmentId, { level: "L1", scoringConfig: { version: 1, scale: "0-100", dimensionWeights: { Confianza: 1.2, Comunicación: 1 } } });

  const prompts = [
    ["Comprendo con claridad las prioridades actuales de la organización.", "Comunicación", "POSITIVE", 5],
    ["Recibo información suficiente para tomar decisiones en mi trabajo.", "Comunicación", "POSITIVE", 5],
    ["Las responsabilidades entre equipos están claramente definidas.", "Comunicación", "POSITIVE", 5],
    ["Los cambios relevantes se comunican con el contexto necesario.", "Comunicación", "POSITIVE", 5],
    ["Sé dónde encontrar la información que necesito para avanzar.", "Comunicación", "POSITIVE", 5],
    ["Confío en que los compromisos acordados se cumplen.", "Confianza", "POSITIVE", 5],
    ["Puedo plantear riesgos sin temor a consecuencias negativas.", "Confianza", "POSITIVE", 5],
    ["Las decisiones importantes tienen criterios comprensibles.", "Confianza", "POSITIVE", 5],
    ["Percibo coherencia entre lo que se comunica y lo que se hace.", "Confianza", "POSITIVE", 5],
    ["La incertidumbre bloquea con frecuencia mi capacidad de actuar.", "Confianza", "REVERSE", 1],
  ] as const;
  for (const [prompt, dimension, polarity, target] of prompts) {
    await assessments.addQuestion(ownerReq, assessmentId, { prompt, type: "LIKERT", dimension, required: true, scored: true, weight: 1, polarity, config: { min: 1, max: 5, minLabel: "Nada de acuerdo", maxLabel: "Totalmente de acuerdo", target } });
  }
  await assessments.addQuestion(ownerReq, assessmentId, { prompt: "¿Qué evidencia concreta debería revisar la organización después de este diagnóstico?", type: "LONG_TEXT", dimension: "Evidencia", required: true, scored: false, weight: 1, polarity: "POSITIVE", config: {} });

  await assessments.legal(ownerReq, assessmentId, { controllerName: "ACME Europe", purpose: "Evaluar señales organizacionales para orientar decisiones internas y acciones de mejora.", legalBasis: "Interés legítimo declarado para diagnóstico organizacional interno", participationMode: "VOLUNTARY", confidentiality: "PSEUDONYMOUS_CONFIDENTIAL", retentionDays: 365, dpoContact: "", approve: true, locale: "es" });
  const populationResult = await workspace.setpop(ownerReq, assessmentId, { all: false, unitIds: [], personIds: selectedPeople.map((person: any) => person.id), excludePersonIds: [] }) as any;
  ensure(populationResult.resolvedCount === 6, `Pilot population resolved ${populationResult.resolvedCount}, expected 6`);
  await workspace.addrec(ownerReq, assessmentId, { displayName: "Pilot Result Recipient", email: `pilot-results-${stamp}@proofline.local`, roleLabel: "Pilot QA", locale: "es" });
  await assessments.approveVisual(ownerReq, assessmentId);

  const prooflineCheck = await assessments.checkPost(ownerReq, assessmentId) as any;
  ensure(Number(prooflineCheck?.score) >= 80, `Proofline Check returned ${prooflineCheck?.score ?? "no score"}; pilot requires >=80`);

  await assessments.status(ownerReq, assessmentId, { status: "REVIEW" });
  const readyTransition = await assessments.status(ownerReq, assessmentId, { status: "READY" }) as any;
  ensure(readyTransition?.version, "READY transition did not freeze an assessment version");
  const checklist = await assessments.launchChecklist(ownerReq, assessmentId) as any;
  ensure(checklist?.canLaunch === true, `Launch checklist blocked pilot: ${(checklist?.missing ?? []).join(", ")}`);

  const frozenVersion = await db.assessmentVersion.findFirst({ where: { assessmentId }, orderBy: { version: "desc" } });
  ensure(frozenVersion?.snapshot, "Frozen assessment version snapshot is missing");
  const frozenQuestionIds = ((frozenVersion!.snapshot as any)?.questions ?? []).map((question: any) => String(question.id));

  const activeTransition = await assessments.status(ownerReq, assessmentId, { status: "ACTIVE" }) as any;
  ensure(activeTransition?.launch?.resolved === 6, "ACTIVE transition did not launch the frozen six-person population");

  const participants = await db.participant.findMany({ where: { assessmentId }, include: { identity: true }, orderBy: { createdAt: "asc" } });
  ensure(participants.length === 6, `Launch created ${participants.length} participants, expected 6`);
  ensure(participants.every((participant) => participant.assessmentVersionId === activeTransition.launch.versionId), "Participant version binding is inconsistent");
  ensure(participants.every((participant) => participant.segmentSnapshot && typeof participant.segmentSnapshot === "object"), "Participant segment snapshot is missing");

  // Historical population must not change when the live directory changes after launch.
  const populationBefore = await workspace.pop(ownerReq, assessmentId) as any;
  const selected = selectedPeople[0];
  const originalPerson = await db.directoryPerson.findUniqueOrThrow({ where: { id: selected.id } });
  mutatedPerson = { id: originalPerson.id, unitId: originalPerson.unitId, attributes: originalPerson.attributes };
  const alternativeUnit = directory.units.find((unit: any) => unit.id !== originalPerson.unitId);
  await db.directoryPerson.update({ where: { id: originalPerson.id }, data: { unitId: alternativeUnit?.id ?? originalPerson.unitId, attributes: { ...(originalPerson.attributes as any ?? {}), location: "Pilot mutated location" } } });
  const populationAfter = await workspace.pop(ownerReq, assessmentId) as any;
  const beforeEntry = populationBefore.people.find((person: any) => person.email === selected.email);
  const afterEntry = populationAfter.people.find((person: any) => person.email === selected.email);
  ensure(beforeEntry && afterEntry && JSON.stringify(beforeEntry.segments) === JSON.stringify(afterEntry.segments), "Frozen population changed after directory mutation");
  await db.directoryPerson.update({ where: { id: originalPerson.id }, data: { unitId: mutatedPerson.unitId, attributes: mutatedPerson.attributes as any } });
  mutatedPerson = undefined;

  const subject = `Proofline · ${title}`;
  const tokens: string[] = await waitForInviteTokens(db, assessmentId, subject, 6);
  ensure(tokens.length === 6, "Individual invitations were not recoverable from the real email flow");

  const firstView = await respond.get(tokens[0]!, "es") as any;
  ensure(firstView.assessmentVersionId === activeTransition.launch.versionId, "Respond is not bound to the launched version");
  ensure(JSON.stringify(firstView.questions.map((question: any) => String(question.id))) === JSON.stringify(frozenQuestionIds), "Respond questions differ from the frozen preview/version");

  for (let index = 0; index < 5; index++) {
    const token = tokens[index]!;
    const view = await respond.get(token, "es") as any;
    const answers = answersFor(view, index);
    if (index === 0) {
      const partial = Object.fromEntries(Object.entries(answers).slice(0, 2));
      const saved = await respond.save(token, { noticeVersionId: view.notice.id, locale: "es", answers: partial }) as any;
      ensure(saved?.ok && !saved.alreadyCompleted, "Pilot autosave did not persist");
      const resumed = await respond.get(token, "es") as any;
      ensure(Object.keys(resumed?.draft?.answers ?? {}).length === 2, "Pilot resume did not restore autosaved answers");
    }
    const submitted = await respond.submit(token, { noticeVersionId: view.notice.id, locale: "es", answers }) as any;
    ensure(submitted?.ok && !submitted.alreadyCompleted, `Participant ${index + 1} did not submit successfully`);
    if (index === 0) {
      const retry = await respond.submit(token, { noticeVersionId: view.notice.id, locale: "es", answers }) as any;
      ensure(retry?.ok && retry.alreadyCompleted, "Participant retry is not idempotent");
    }
  }

  const liveAssessment = await db.assessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { analysisRuns: true, reports: true, participants: true } });
  ensure(liveAssessment.status === "ACTIVE" && liveAssessment.analysisRuns.length === 0 && liveAssessment.reports.length === 0, "Final results became available while assessment was LIVE");
  ensure(liveAssessment.participants.filter((participant) => participant.status === "COMPLETED").length === 5, "Expected five completed pilot responses before close");

  const closed = await assessments.status(ownerReq, assessmentId, { status: "CLOSED" }) as any;
  analysisRunId = String(closed.analysisRunId ?? "");
  ensure(analysisRunId, "Closing the assessment did not queue analysis");

  const sixthView = await respond.get(tokens[5]!, "es") as any;
  let closedRejected = false;
  try {
    await respond.save(tokens[5]!, { noticeVersionId: sixthView.notice.id, locale: "es", answers: Object.fromEntries(Object.entries(answersFor(sixthView, 5)).slice(0, 1)) });
  } catch (error) {
    closedRejected = /no longer accepting responses/i.test(error instanceof Error ? error.message : String(error));
  }
  ensure(closedRejected, "CLOSED assessment still accepted participant autosave");

  const analysis = await waitForAnalysis(db, analysisRunId);
  const result = (analysis.result ?? {}) as any;
  ensure(typeof analysis.sourceHash === "string" && analysis.sourceHash.length === 64, "Completed analysis sourceHash is missing");
  ensure(typeof result.calculationHash === "string" && result.calculationHash.length === 64, "Completed analysis calculationHash is missing");
  ensure(result.sampleMetadata?.completedResponses === 5, "Analysis sample metadata does not match completed responses");
  ensure(result.questionTargets && result.questionGaps && result.dimensionTargets && result.dimensionGaps, "Target/gap contract is incomplete in completed analysis");
  const cohortRows = Object.values(result.cohorts ?? {}) as any[];
  ensure(cohortRows.length > 0 && cohortRows.every((cohort) => cohort.suppressed === true || Number(cohort.n ?? 0) >= 5), "Cohort suppression exposed a sub-threshold cohort");

  const levels = ["L1_EXECUTIVE", "L2_DIAGNOSTIC", "L3_ANALYTICAL", "L4_STRATEGIC"] as const;
  const generated: any[] = [];
  for (const level of levels) {
    const report = await reportsController.generate(ownerReq, assessmentId, { level }) as any;
    reportIds.push(String(report.id));
    generated.push(report);
    const pdf = await reports.pdf(report.id);
    ensure(pdf.subarray(0, 4).toString() === "%PDF", `${level} did not generate a valid PDF stream`);
    const exported = JSON.parse((await reports.exportJson(report.id)).toString("utf8"));
    const csv = (await reports.exportCsv(report.id)).toString("utf8");
    ensure(exported.snapshotHash === report.snapshotHash && exported.level === level, `${level} JSON export is not tied to its snapshot`);
    ensure(csv.includes(report.snapshotHash) && csv.includes(level), `${level} CSV export is not tied to its snapshot`);
  }
  ensure(new Set(generated.map((report) => report.snapshotHash)).size === 1, "L1-L4 do not share one canonical snapshot");

  const primaryReport = generated[0]!;
  await reportsController.approve(ownerReq, primaryReport.id);
  const distribution = await reportsController.distribute(ownerReq, primaryReport.id) as any;
  ensure(distribution?.queued === 1, `Expected one authorized report recipient, queued ${distribution?.queued ?? 0}`);
  const distributedReport = await waitForReportDelivery(db, primaryReport.id);
  const deliveryIds = distributedReport.deliveries.map((delivery) => delivery.id);

  const usage = await db.usageEvent.findMany({ where: { assessmentId } });
  ensure(usage.some((event) => event.eventType === "ASSESSMENT_LAUNCHED" && event.billable === false), "Assessment launch usage event is missing");
  ensure(usage.filter((event) => event.eventType === "RESPONSE_COMPLETED" && event.billable === true).length === 5, "Billable response ledger does not match completed responses");

  const audit = await db.auditEvent.findMany({ where: { organizationId: liveAssessment.organizationId }, orderBy: { createdAt: "desc" }, take: 500 });
  const relevant = audit.filter((event) => {
    const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown>
      : {};
    return event.targetId === assessmentId
      || event.targetId === analysisRunId
      || reportIds.includes(String(event.targetId))
      || deliveryIds.includes(String(event.targetId))
      || metadata.assessmentId === assessmentId
      || participants.some((participant) => participant.pseudonym === event.actorId);
  });
  const actions = new Set(relevant.map((event) => event.action));
  for (const action of ["ASSESSMENT_GOVERNANCE_UPDATED", "ASSESSMENT_VISUAL_PREVIEW_APPROVED", "ASSESSMENT_STATUS_CHANGED", "ASSESSMENT_SCORING_QUEUED", "ASSESSMENT_SCORING_COMPLETED", "ASSESSMENT_COMPLETED", "REPORT_GENERATED", "REPORT_APPROVED", "REPORT_DISTRIBUTION_QUEUED", "REPORT_DELIVERY_SENT"]) {
    ensure(actions.has(action), `Audit trail is missing ${action}`);
  }

  const completedInviteJobs = await db.outboxEvent.findMany({ where: { type: "SEND_EMAIL", status: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 300 });
  const correlatedInvites = completedInviteJobs.filter((job) => {
    const payload = job.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : {};
    return payload.category === "participant-invite" && payload.assessmentId === assessmentId;
  });
  ensure(correlatedInvites.length === 6, "Completed invitation outbox events lost assessment correlation");
  ensure(correlatedInvites.every((job) => {
    const payload = job.payload as Record<string, unknown>;
    return payload.scrubbed === true && payload.to === undefined && payload.text === undefined;
  }), "Completed invitation outbox retained sensitive recipient/token payload");

  const checks = [
    "create", "method+governance", "questions", "population", "privacy+notice", "visual-approval", "proofline-check", "freeze", "launch", "individual-invites",
    "respond-autosave+resume", "respond-submit+idempotency", "live-no-final-results", "close-lock", "worker-analysis", "deterministic-scoring", "cohort-suppression", "canonical-L1-L4", "authorized-distribution", "audit+ledger",
  ];
  const cleanedPilotEmails = await cleanupPilotMailpitMessages();
  console.log(`[OK] PROOFLINE C2.5.5 Pilot E2E · ${checks.length}/${checks.length} gates · ${checks.join(" · ")}`);
  if (cleanedPilotEmails) console.log(`[INFO] Pilot E2E cleaned ${cleanedPilotEmails} Mailpit messages generated by the run`);
  console.log(`[OK] Pilot evidence · assessment=${assessmentId} · version=${activeTransition.launch.version} · participants=6 · completed=5 · sourceHash=${analysis.sourceHash} · snapshotHash=${primaryReport.snapshotHash}`);
} finally {
  const db = app.get(PrismaService);
  if (mutatedPerson) await db.directoryPerson.update({ where: { id: mutatedPerson.id }, data: { unitId: mutatedPerson.unitId, attributes: mutatedPerson.attributes as any } }).catch(() => undefined);
  if (assessmentId) {
    const participants = await db.participant.findMany({ where: { assessmentId }, select: { pseudonym: true } }).catch(() => [] as Array<{ pseudonym: string }>);
    const pseudonyms = participants.map((participant) => participant.pseudonym);
    if (pseudonyms.length) {
      await db.legalInteraction.deleteMany({ where: { actorRef: { in: pseudonyms } } }).catch(() => undefined);
      await db.auditEvent.deleteMany({ where: { actorId: { in: pseudonyms } } }).catch(() => undefined);
    }
    const jobs = await db.outboxEvent.findMany({ where: { type: { in: ["SEND_EMAIL", "RUN_ANALYSIS"] } } }).catch(() => [] as any[]);
    const jobIds = jobs.filter((job) => {
      const payload = job.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : {};
      return payload.assessmentId === assessmentId || (typeof payload.reportId === "string" && reportIds.includes(payload.reportId)) || payload.analysisRunId === analysisRunId;
    }).map((job) => job.id);
    if (jobIds.length) await db.outboxEvent.deleteMany({ where: { id: { in: jobIds } } }).catch(() => undefined);
    await db.usageEvent.deleteMany({ where: { assessmentId } }).catch(() => undefined);
    const targetIds = [assessmentId, analysisRunId, ...reportIds].filter((value): value is string => Boolean(value));
    if (targetIds.length) await db.auditEvent.deleteMany({ where: { targetId: { in: targetIds } } }).catch(() => undefined);
    await db.assessment.delete({ where: { id: assessmentId } }).catch(() => undefined);
  }
  if (temporarySubscriptionId) await db.subscription.delete({ where: { id: temporarySubscriptionId } }).catch(() => undefined);
  await app.close();
}
