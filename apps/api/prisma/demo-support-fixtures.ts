import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { randomBytes, scryptSync } from "node:crypto";
import { blindIndex, encryptText, randomPseudonym, sha256 } from "../src/security/crypto.js";
import { ReportService } from "../src/reports/report.service.js";
import { AuditService } from "../src/audit/audit.service.js";

const LOCAL_DATABASE_URL = "postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline?schema=public";
const url = process.env.PROOFLINE_DATABASE_URL ?? LOCAL_DATABASE_URL;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const audit = new AuditService(db as any);
const reports = new ReportService(db as any, audit);

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${digest}`;
}
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

async function ensurePlan() {
  return db.plan.upsert({
    where: { code: "PROFESSIONAL" },
    update: {},
    create: { code: "PROFESSIONAL", name: "Proofline Professional", monthlyAmountCents: 150000, currency: "EUR", entitlementsJson: { activeAssessments: 10, participantCreditsPerYear: 10000, workspaceUsers: 10, marketplace: true, branding: true } },
  });
}

async function ensureOwner(org: { id: string }, email: string, displayName: string) {
  const user = await db.user.upsert({
    where: { email },
    update: { displayName, accountStatus: "ACTIVE", emailVerifiedAt: new Date() },
    create: { email, displayName, locale: "es", passwordHash: hashPassword("proofline-demo"), accountStatus: "ACTIVE", emailVerifiedAt: new Date() },
  });
  if (!user.passwordHash) await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword("proofline-demo") } });
  await db.membership.upsert({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, update: { role: "OWNER" }, create: { organizationId: org.id, userId: user.id, role: "OWNER" } });
  return user;
}

async function ensureOrg(input: { name: string; slug: string; legalName: string; taxId: string; country: string; billingEmail: string; ownerEmail: string; ownerName: string }) {
  const org = await db.organization.upsert({
    where: { slug: input.slug },
    update: { name: input.name, legalName: input.legalName, taxId: input.taxId, country: input.country, billingEmail: input.billingEmail, contractOwnerEmail: input.ownerEmail },
    create: { name: input.name, slug: input.slug, legalName: input.legalName, taxId: input.taxId, country: input.country, billingEmail: input.billingEmail, contractOwnerEmail: input.ownerEmail, defaultLocale: "es" },
  });
  const owner = await ensureOwner(org, input.ownerEmail, input.ownerName);
  const plan = await ensurePlan();
  if (!await db.subscription.findFirst({ where: { organizationId: org.id, status: { in: ["ACTIVE","TRIAL"] } } })) await db.subscription.create({ data: { organizationId: org.id, planId: plan.id, status: "ACTIVE", externalRef: `demo-contract:${input.slug}`, renewsAt: new Date(Date.now() + 365 * 86_400_000) } });
  for (const [key, value] of Object.entries({ "assessments.active.max": 10, "participants.year.max": 10000, "workspace.users.max": 10, "branding.custom": true, "marketplace.access": true })) await db.entitlement.upsert({ where: { organizationId_key: { organizationId: org.id, key } }, update: { value: value as any, source: "demo-fixture" }, create: { organizationId: org.id, key, value: value as any, source: "demo-fixture" } });
  return { org, owner };
}

async function ensurePaymentMethod(orgId: string, input: { provider: "REDSYS" | "PAYPAL" | "BANK_TRANSFER"; maskedLabel: string; brand?: string; last4?: string; paymentTermsDays?: number; bankReference?: string }) {
  const existing = await db.paymentMethod.findFirst({ where: { organizationId: orgId, provider: input.provider, status: "ACTIVE" } });
  if (existing) return existing;
  await db.paymentMethod.updateMany({ where: { organizationId: orgId, isDefault: true, status: "ACTIVE" }, data: { status: "REPLACED", isDefault: false, replacedAt: new Date() } });
  const method = await db.paymentMethod.create({ data: { organizationId: orgId, provider: input.provider, type: input.provider === "REDSYS" ? "CARD" : input.provider === "PAYPAL" ? "PAYPAL" : "BANK_TRANSFER", status: "ACTIVE", isDefault: true, maskedLabel: input.maskedLabel, brand: input.brand ?? null, last4: input.last4 ?? null, paymentTermsDays: input.paymentTermsDays ?? 0, bankReference: input.bankReference ?? null, createdByType: "SYSTEM", createdBy: "demo-functional-fixture", activatedAt: new Date() } });
  await db.paymentMethodEvent.create({ data: { organizationId: orgId, paymentMethodId: method.id, eventType: "DEMO_METHOD_ACTIVATED", actorType: "SYSTEM", actorId: "demo-functional-fixture", metadata: { provider: input.provider, safeFixture: true } } });
  return method;
}

async function ensureAssessment(orgId: string, input: { title: string; objective: string; status: "ACTIVE" | "CLOSED" }) {
  let assessment = await db.assessment.findFirst({ where: { organizationId: orgId, title: input.title } });
  if (!assessment) assessment = await db.assessment.create({ data: { organizationId: orgId, title: input.title, objective: input.objective, status: input.status, locale: "es", privacyMode: "CONFIDENTIAL", minCohortSize: 5, readinessScore: 92, launchedAt: daysAgo(input.status === "ACTIVE" ? 8 : 28), closedAt: input.status === "CLOSED" ? daysAgo(3) : null, launchedVersion: 1 } });
  else assessment = await db.assessment.update({ where: { id: assessment.id }, data: { objective: input.objective, status: input.status, launchedAt: assessment.launchedAt ?? daysAgo(8), closedAt: input.status === "CLOSED" ? assessment.closedAt ?? daysAgo(3) : null } });
  const questions = [
    [1,"LIKERT","Tengo claridad sobre las prioridades que deben guiar mis decisiones.","Claridad"],
    [2,"LIKERT","Mi responsable comunica el contexto necesario para ejecutar con autonomía.","Liderazgo"],
    [3,"LIKERT","Los equipos colaboran con confianza cuando existen dependencias entre áreas.","Colaboración"],
    [4,"LIKERT","Los desacuerdos relevantes se resuelven de forma oportuna y transparente.","Confianza"],
    [5,"LIKERT","La organización convierte feedback en acciones visibles.","Ejecución"],
  ] as const;
  for (const [order,type,prompt,dimension] of questions) await db.question.upsert({ where: { assessmentId_order: { assessmentId: assessment.id, order } }, update: { type, prompt, dimension, required: true, config: { min: 1, max: 5, labels: ["Muy en desacuerdo","En desacuerdo","Neutral","De acuerdo","Muy de acuerdo"] } }, create: { assessmentId: assessment.id, order, type, prompt, dimension, required: true, config: { min: 1, max: 5, labels: ["Muy en desacuerdo","En desacuerdo","Neutral","De acuerdo","Muy de acuerdo"] } } });
  if (!await db.assessmentAudienceTarget.findFirst({ where: { assessmentId: assessment.id, type: "ALL" } })) await db.assessmentAudienceTarget.create({ data: { assessmentId: assessment.id, type: "ALL" } });
  return assessment;
}

async function ensureParticipants(assessmentId: string, orgSlug: string, completed: number, started: number, invited: number) {
  const questions = await db.question.findMany({ where: { assessmentId }, orderBy: { order: "asc" } });
  const total = completed + started + invited;
  for (let i = 0; i < total; i++) {
    const rawToken = `demo-${orgSlug}-${i+1}`;
    const tokenHash = sha256(rawToken);
    const status = i < completed ? "COMPLETED" : i < completed + started ? "STARTED" : "INVITED";
    let participant = await db.participant.findUnique({ where: { tokenHash } });
    if (!participant) participant = await db.participant.create({ data: { assessmentId, pseudonym: randomPseudonym(), tokenHash, status, startedAt: status === "INVITED" ? null : daysAgo(2), completedAt: status === "COMPLETED" ? daysAgo(1) : null } });
    else participant = await db.participant.update({ where: { id: participant.id }, data: { assessmentId, status, startedAt: status === "INVITED" ? null : participant.startedAt ?? daysAgo(2), completedAt: status === "COMPLETED" ? participant.completedAt ?? daysAgo(1) : null } });
    const email = `participant.${i+1}@${orgSlug}.local`;
    await db.participantIdentity.upsert({ where: { participantId: participant.id }, update: { emailEncrypted: encryptText(email), emailLookup: blindIndex(email), nameEncrypted: encryptText(`Participante ${i+1}`) }, create: { participantId: participant.id, emailEncrypted: encryptText(email), emailLookup: blindIndex(email), nameEncrypted: encryptText(`Participante ${i+1}`) } });
    if (status !== "INVITED") {
      const response = await db.response.upsert({ where: { participantId: participant.id }, update: { completedAt: status === "COMPLETED" ? participant.completedAt ?? daysAgo(1) : null }, create: { participantId: participant.id, startedAt: participant.startedAt ?? daysAgo(2), completedAt: status === "COMPLETED" ? participant.completedAt ?? daysAgo(1) : null } });
      for (const [j,q] of questions.entries()) await db.answer.upsert({ where: { responseId_questionId: { responseId: response.id, questionId: q.id } }, update: { value: Math.max(2, 5 - ((i + j) % 4)) }, create: { responseId: response.id, questionId: q.id, value: Math.max(2, 5 - ((i + j) % 4)) } });
    }
  }
}

async function ensureCompletedReport(assessment: { id: string }, orgName: string, recipients: Array<{ name: string; email: string; role: string }>) {
  const result = {
    overallScore: 78,
    dimensionScores: { Claridad: 82, Liderazgo: 74, Colaboración: 80, Confianza: 71, Ejecución: 83 },
    highlights: [
      `${orgName} muestra una señal sólida en claridad y ejecución, con oportunidad de mejora en confianza transversal.`,
      "La colaboración es consistente, pero pierde fuerza cuando existen desacuerdos entre áreas.",
      "La participación permite una lectura ejecutiva estable dentro de los límites configurados.",
    ],
    qualitativeThemes: [
      { theme: "Priorización", mentions: 8 },
      { theme: "Coordinación entre áreas", mentions: 6 },
      { theme: "Feedback visible", mentions: 5 },
    ],
    choiceDistributions: {}, rankingResults: {}, allocationResults: {}, matrixDistributions: {},
  };
  const existingRun = await db.analysisRun.findFirst({ where: { assessmentId: assessment.id, status: "COMPLETED" }, orderBy: { createdAt: "desc" } });
  if (!existingRun) await db.analysisRun.create({ data: { assessmentId: assessment.id, status: "COMPLETED", engineVersion: "demo-fixture-1.0", result: result as any, startedAt: daysAgo(2), completedAt: daysAgo(2) } });
  for (const r of recipients) await db.resultRecipient.upsert({ where: { assessmentId_emailLookup: { assessmentId: assessment.id, emailLookup: blindIndex(r.email) } }, update: { displayName: r.name, emailEncrypted: encryptText(r.email), roleLabel: r.role, active: true }, create: { assessmentId: assessment.id, displayName: r.name, emailEncrypted: encryptText(r.email), emailLookup: blindIndex(r.email), roleLabel: r.role, locale: "es", active: true } });
  let report = await db.report.findFirst({ where: { assessmentId: assessment.id, kind: "EXECUTIVE" }, orderBy: { version: "desc" } });
  if (!report) report = await reports.generate(assessment.id, "EXECUTIVE");
  if (report.status === "DRAFT") report = await reports.approve(report.id);
  const deliveryCount = await db.reportDelivery.count({ where: { reportId: report.id } });
  if (!deliveryCount) await reports.distribute(report.id);
  return report;
}

async function ensureAudit(ticketId: string, orgId: string, action: string, actorId: string, actorType: string, metadata: Record<string, unknown>, createdAt: Date) {
  if (await db.auditEvent.findFirst({ where: { targetType: "SupportTicket", targetId: ticketId, action } })) return;
  await db.auditEvent.create({ data: { organizationId: orgId, actorType, actorId, action, targetType: "SupportTicket", targetId: ticketId, metadata: metadata as any, createdAt } });
}

async function ensureTicket(input: { orgId: string; requesterId: string; assigneeId?: string; subject: string; description: string; category: any; priority: any; status: any; slaDueAt: Date; messages: Array<{ internal?: boolean; body: string; visibility?: "CUSTOMER" | "INTERNAL" }> }) {
  let ticket = await db.supportTicket.findFirst({ where: { organizationId: input.orgId, subject: input.subject } });
  if (!ticket) ticket = await db.supportTicket.create({ data: { organizationId: input.orgId, requesterUserId: input.requesterId, assigneeInternalUserId: input.assigneeId ?? null, subject: input.subject, description: input.description, category: input.category, priority: input.priority, status: input.status, slaDueAt: input.slaDueAt, assignedAt: input.assigneeId ? daysAgo(1) : null, resolvedAt: input.status === "RESOLVED" || input.status === "CLOSED" ? daysAgo(1) : null, closedAt: input.status === "CLOSED" ? new Date(Date.now() - 12 * 3_600_000) : null, lastCustomerReplyAt: daysAgo(1), lastInternalReplyAt: input.assigneeId ? new Date(Date.now() - 18 * 3_600_000) : null } });
  if (!await db.supportMessage.findFirst({ where: { ticketId: ticket.id } })) {
    await db.supportMessage.create({ data: { ticketId: ticket.id, userId: input.requesterId, visibility: "CUSTOMER", body: input.description, createdAt: daysAgo(2) } });
    for (const [i,m] of input.messages.entries()) await db.supportMessage.create({ data: { ticketId: ticket.id, ...(m.internal ? { internalUserId: input.assigneeId } : { userId: input.requesterId }), visibility: m.visibility ?? "CUSTOMER", body: m.body, createdAt: new Date(Date.now() - (30 - i * 5) * 3_600_000) } });
  }
  await ensureAudit(ticket.id, input.orgId, "SUPPORT_TICKET_CREATED", "demo-fixture", "SYSTEM", { category: input.category, priority: input.priority }, daysAgo(2));
  if (input.assigneeId) await ensureAudit(ticket.id, input.orgId, "SUPPORT_TICKET_ASSIGNED", "sofia.support@proofline.local", "INTERNAL", { assignee: "sofia.support@proofline.local" }, daysAgo(1));
  if (input.status === "RESOLVED" || input.status === "CLOSED") await ensureAudit(ticket.id, input.orgId, "CONTROL_SUPPORT_STATUS_CHANGED", "sofia.support@proofline.local", "INTERNAL", { to: input.status }, daysAgo(1));
  return ticket;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("demo:support-fixtures is forbidden in production");
  const support = await db.internalUser.upsert({
    where: { email: "sofia.support@proofline.local" },
    update: { displayName: "Sofía Navarro", role: "INTERNAL_SUPPORT", status: "ACTIVE", emailVerifiedAt: new Date() },
    create: { email: "sofia.support@proofline.local", displayName: "Sofía Navarro", role: "INTERNAL_SUPPORT", status: "ACTIVE", passwordHash: hashPassword("proofline-support-demo"), emailVerifiedAt: new Date() },
  });
  if (!support.passwordHash) await db.internalUser.update({ where: { id: support.id }, data: { passwordHash: hashPassword("proofline-support-demo") } });

  const nova = await ensureOrg({ name: "Nova Retail Iberia", slug: "nova-retail-iberia", legalName: "Nova Retail Iberia, S.L.", taxId: "B-21870451", country: "España", billingEmail: "finance@nova.local", ownerEmail: "ines.owner@nova.local", ownerName: "Inés Romero" });
  const novaAssessment = await ensureAssessment(nova.org.id, { title: "Clima, Liderazgo & Prioridades 2026", objective: "Detectar dónde la claridad de prioridades y el liderazgo están favoreciendo o frenando la ejecución entre tiendas, operaciones y oficinas centrales.", status: "ACTIVE" });
  await ensureParticipants(novaAssessment.id, "nova-retail-iberia", 7, 2, 3);
  await ensurePaymentMethod(nova.org.id, { provider: "REDSYS", maskedLabel: "Visa corporativa •••• 4821", brand: "Visa", last4: "4821" });

  const orbis = await ensureOrg({ name: "Orbis Health Iberia", slug: "orbis-health-iberia", legalName: "Orbis Health Iberia, S.A.", taxId: "A-77310428", country: "España", billingEmail: "billing@orbis.local", ownerEmail: "marcos.owner@orbis.local", ownerName: "Marcos Vidal" });
  const orbisAssessment = await ensureAssessment(orbis.org.id, { title: "Colaboración, Confianza & Ejecución 2026", objective: "Evaluar cómo la confianza, la coordinación entre áreas y la disciplina de ejecución afectan a la experiencia de los equipos y a la entrega operativa.", status: "CLOSED" });
  await ensureParticipants(orbisAssessment.id, "orbis-health-iberia", 12, 0, 0);
  await ensureCompletedReport(orbisAssessment, orbis.org.name, [
    { name: "Marcos Vidal", email: "marcos.owner@orbis.local", role: "Executive Sponsor" },
    { name: "Laura Méndez", email: "direccion.personas@orbis.local", role: "People Director" },
  ]);
  await ensurePaymentMethod(orbis.org.id, { provider: "BANK_TRANSFER", maskedLabel: "Transferencia SEPA", paymentTermsDays: 30, bankReference: "ORBIT-2026" });
  const acme = await db.organization.findUnique({ where: { slug: "acme-europe" } });
  if (acme) await ensurePaymentMethod(acme.id, { provider: "PAYPAL", maskedLabel: "Cuenta PayPal corporativa" });

  await ensureTicket({ orgId: nova.org.id, requesterId: nova.owner.id, subject: "No podemos añadir un nuevo Assessment Manager", description: "Al intentar invitar a una responsable regional como Assessment Manager la pantalla vuelve al listado sin completar el alta.", category: "ACCESS", priority: "HIGH", status: "OPEN", slaDueAt: hoursFromNow(1), messages: [] });
  const orbisBillingTicket = await ensureTicket({ orgId: orbis.org.id, requesterId: orbis.owner.id, assigneeId: support.id, subject: "Validar cambio del email de facturación", description: "Necesitamos que las próximas facturas y avisos contractuales se envíen al nuevo buzón central de administración.", category: "ACCOUNT_CHANGE", priority: "NORMAL", status: "IN_PROGRESS", slaDueAt: hoursFromNow(3), messages: [{ internal: true, visibility: "INTERNAL", body: "He comprobado que el solicitante es Owner. Falta validar el nuevo buzón con Finanzas." }, { internal: true, visibility: "CUSTOMER", body: "Estamos validando el cambio con el equipo de facturación. Te confirmaremos desde este mismo ticket." }] });
  if (!await db.accountChangeRequest.findUnique({ where: { supportTicketId: orbisBillingTicket.id } })) await db.accountChangeRequest.create({ data: { organizationId: orbis.org.id, requestedByUserId: orbis.owner.id, supportTicketId: orbisBillingTicket.id, type: "BILLING_EMAIL", status: "IN_REVIEW", summary: "Cambiar el email de facturación y avisos contractuales al nuevo buzón central.", requestedData: { requestedValue: "administracion@orbis.local" }, reviewedBy: "sofia.support@proofline.local", reviewedAt: new Date() } });
  await ensureTicket({ orgId: nova.org.id, requesterId: nova.owner.id, assigneeId: support.id, subject: "Consulta sobre destinatarios del informe ejecutivo", description: "Queríamos confirmar si el PDF se envía sólo a los destinatarios configurados antes del cierre del assessment.", category: "FUNCTIONAL", priority: "LOW", status: "CLOSED", slaDueAt: daysAgo(1), messages: [{ internal: true, visibility: "CUSTOMER", body: "Sí. La distribución utiliza exclusivamente los Result Recipients activos del assessment y queda auditada por entrega." }] });

  console.log("C2.2.2 functional demo fixtures ready");
  console.log("Support Console: sofia.support@proofline.local / proofline-support-demo");
  console.log("Nova Workspace: ines.owner@nova.local / proofline-demo · ACTIVE assessment");
  console.log("Orbis Workspace: marcos.owner@orbis.local / proofline-demo · CLOSED assessment + report emails queued");
  console.log("Mailpit: http://localhost:4280");
}
main().finally(() => db.$disconnect());
