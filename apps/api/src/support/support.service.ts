import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { requireCapability } from "../auth/access-control.js";
import type { HeaderRequest } from "../auth/dev-auth.js";
import { requireInternalCapability } from "../control/internal-access.js";
import { parsePagination, paged, clampedPagination } from "../common/pagination.js";
import { supportFilters } from "../control/p4-filters.js";
import { canReadAccountChanges, workspaceSupportTicketScope } from "./workspace-support-visibility.js";
import { canTransitionAccountChange, canTransitionSupportTicket } from "./support-s3-invariants.js";

const DEFAULT_SLA_MS = 4 * 60 * 60_000;
const SLA_MS: Readonly<Record<string, number>> = { URGENT: 15 * 60_000, HIGH: 60 * 60_000, NORMAL: DEFAULT_SLA_MS, LOW: 24 * 60 * 60_000 };
const openStatuses = new Set(["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]);
const dueAtFor = (priority: string) => new Date(Date.now() + (SLA_MS[priority] ?? DEFAULT_SLA_MS));
const minutesUntil = (value: Date) => Math.max(0, Math.ceil((value.getTime() - Date.now()) / 60_000));
const SUPPORT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const SUPPORT_ATTACHMENT_ALLOWED = new Map<string, string[]>([
  ["application/pdf", [".pdf"]],
  ["image/png", [".png"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/webp", [".webp"]],
]);
function safeSupportFileName(value:string){
  const cleaned=value.replace(/[\\/:*?"<>|\x00-\x1f]/g,"_").replace(/\s+/g," ").trim();
  return (cleaned||"documento").slice(0,180);
}
function validSupportAttachmentSignature(mimeType:string,bytes:Buffer){
  if(mimeType==="application/pdf")return bytes.length>=5&&bytes.subarray(0,5).toString("ascii")==="%PDF-";
  if(mimeType==="image/png")return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mimeType==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mimeType==="image/webp")return bytes.length>=12&&bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP";
  return false;
}

function normalized(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function tokenSet(value:string){return new Set(normalized(value).split(" ").filter(x=>x.length>2&&!new Set(["para","por","con","una","uno","unos","unas","que","del","las","los","the","and","for","with","this","that","from"]).has(x)))}
function similarity(a:string,b:string){const aa=tokenSet(a),bb=tokenSet(b);if(!aa.size||!bb.size)return 0;let common=0;for(const t of aa)if(bb.has(t))common+=1;return common/(aa.size+bb.size-common)}
function canCustomerReply(ticket:{status:string;lastCustomerReplyAt:Date|null;lastInternalReplyAt:Date|null}){if(ticket.status==="CLOSED")return false;const internal=ticket.lastInternalReplyAt?.getTime()??0,customer=ticket.lastCustomerReplyAt?.getTime()??0;return internal>customer}

const supportEmailEscapes:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};
function emailEscape(value:string){return value.replace(/[&<>"']/g,ch=>supportEmailEscapes[ch]??ch)}
function supportEmailHtml(input:{kicker:string;title:string;intro:string;body:string;actionUrl?:string;actionLabel?:string}){
  const body=emailEscape(input.body).replace(/\n/g,"<br/>"),action=input.actionUrl?`<p style="margin:26px 0 0"><a href="${emailEscape(input.actionUrl)}" style="display:inline-block;background:#f2f4f7;color:#0e141b;text-decoration:none;font-size:14px;font-weight:800;padding:12px 18px;border-radius:10px">${emailEscape(input.actionLabel??"Abrir ticket")}</a></p>`:"";
  return `<!doctype html><html><body style="margin:0;background:#0e141b;font-family:Inter,Arial,sans-serif;color:#f2f4f7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e141b;padding:32px 14px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#151d26;border:1px solid #2a3743;border-radius:18px;overflow:hidden"><tr><td style="padding:26px 30px 16px;border-bottom:1px solid #2a3743"><div style="font-size:11px;letter-spacing:.16em;color:#22d3a8;font-weight:800">${emailEscape(input.kicker)}</div><div style="margin-top:7px;font-size:13px;color:#a3adc1">PROOFLINE · Signal & Structure</div></td></tr><tr><td style="padding:30px"><h1 style="margin:0 0 12px;font-size:25px;line-height:1.25;color:#f2f4f7">${emailEscape(input.title)}</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#a3adc1">${emailEscape(input.intro)}</p><div style="padding:18px 20px;border-radius:14px;background:#0e141b;border:1px solid #2d3d49;font-size:15px;line-height:1.7;color:#f2f4f7">${body}</div>${action}</td></tr><tr><td style="padding:16px 30px;border-top:1px solid #2a3743;font-size:11px;color:#7d8995">PROOFLINE · ARMAR TECHNOLOGIES</td></tr></table></td></tr></table></body></html>`;
}


@Injectable()
export class SupportService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}


  private async aiDuplicateCandidate(input:{subject:string;description:string;category:string},candidates:Array<{id:string;subject:string;description:string;category:string;status:string}>){
    const url=process.env.SUPPORT_DUPLICATE_AI_URL?.trim();if(!url||!candidates.length)return null;
    try{const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...(process.env.SUPPORT_DUPLICATE_AI_TOKEN?{authorization:`Bearer ${process.env.SUPPORT_DUPLICATE_AI_TOKEN}`}:{})},body:JSON.stringify({task:"support-duplicate-detection",input,candidates}),signal:AbortSignal.timeout(1800)});if(!response.ok)return null;const data=await response.json()as{duplicateTicketId?:string;score?:number};const ticket=candidates.find(c=>c.id===data.duplicateTicketId),score=Number(data.score??0);return ticket&&score>=0.72?{ticket,score}:null}catch{return null}
  }

  private async guardNewTicket(organizationId:string,requesterUserId:string,input:{subject:string;description:string;category:string}){
    const thirtyDaysAgo=new Date(Date.now()-30*86_400_000),twentyMinutesAgo=new Date(Date.now()-20*60_000);
    const [open,recent]=await Promise.all([
      this.db.supportTicket.findMany({where:{organizationId,requesterUserId,status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]},createdAt:{gte:thirtyDaysAgo},...(input.category!=="ACCOUNT_CHANGE"?{AND:[{category:{not:"ACCOUNT_CHANGE" as const}},{accountChangeRequest:{is:null}}]}:{})},select:{id:true,subject:true,description:true,category:true,status:true,slaDueAt:true,createdAt:true},orderBy:{updatedAt:"desc"},take:30}),
      this.db.supportTicket.count({where:{organizationId,requesterUserId,createdAt:{gte:twentyMinutesAgo}}}),
    ]);
    let best:{ticket:(typeof open)[number];score:number}|null=null;
    const ai=await this.aiDuplicateCandidate(input,open.map(t=>({id:t.id,subject:t.subject,description:t.description,category:t.category,status:t.status})));if(ai){const ticket=open.find(t=>t.id===ai.ticket.id);if(ticket)best={ticket,score:ai.score}}
    const incoming=`${input.subject} ${input.description}`;
    for(const ticket of open){const subjectScore=similarity(input.subject,ticket.subject),bodyScore=similarity(incoming,`${ticket.subject} ${ticket.description}`),categoryBoost=ticket.category===input.category?0.12:0,score=Math.min(1,Math.max(subjectScore,bodyScore)+categoryBoost);if(!best||score>best.score)best={ticket,score}}
    if(best&&best.score>=0.62){
      await this.audit.record({organizationId,actorType:"USER",actorId:requesterUserId,action:"SUPPORT_DUPLICATE_BLOCKED",targetType:"SupportTicket",targetId:best.ticket.id,metadata:{similarity:Number(best.score.toFixed(3)),incomingSubject:input.subject}});
      throw new BadRequestException({code:"SUPPORT_DUPLICATE",message:"A similar open ticket already exists.",existingTicketId:best.ticket.id,existingSubject:best.ticket.subject,existingStatus:best.ticket.status,etaMinutes:minutesUntil(best.ticket.slaDueAt)});
    }
    if(recent>=5){
      await this.audit.record({organizationId,actorType:"USER",actorId:requesterUserId,action:"SUPPORT_BURST_BLOCKED",targetType:"Organization",targetId:organizationId,metadata:{ticketsIn20Minutes:recent,incomingSubject:input.subject}});
      throw new BadRequestException({code:"SUPPORT_RATE_LIMIT",message:"Too many support requests were created in a short period.",retryAfterMinutes:20});
    }
    if(recent>=3)await this.audit.record({organizationId,actorType:"USER",actorId:requesterUserId,action:"SUPPORT_BURST_DETECTED",targetType:"Organization",targetId:organizationId,metadata:{ticketsIn20Minutes:recent+1,incomingSubject:input.subject}});
  }


  async workspaceQueuePage(req: HeaderRequest,input:{page?:string;pageSize?:string;q?:string;status?:string}) {
    const ctx=await requireCapability(this.db,req,"support.use"),pg=parsePagination(input);
    const search=(input.q??"").trim().slice(0,120);
    const allowed=["OPEN","ASSIGNED","IN_PROGRESS","WAITING","RESOLVED","ESCALATED","CLOSED"];
    const where:any=workspaceSupportTicketScope(ctx);
    if(search)where.OR=[{subject:{contains:search,mode:"insensitive"}},{category:{contains:search,mode:"insensitive"}}];
    if(input.status&&allowed.includes(input.status))where.status=input.status;
    const [total,tickets,changes,activeCount,unreadRows]=await Promise.all([
      this.db.supportTicket.count({where}),
      this.db.supportTicket.findMany({where,skip:pg.skip,take:pg.take,include:{assignee:{select:{displayName:true}},readStates:{where:{userId:ctx.user.id},select:{lastReadAt:true},take:1},_count:{select:{messages:true}}},orderBy:[{updatedAt:"desc"},{id:"asc"}]}),
      canReadAccountChanges(ctx)?this.db.accountChangeRequest.findMany({where:{organizationId:ctx.organization.id},include:{supportTicket:{select:{subject:true,status:true}}},orderBy:{createdAt:"desc"},take:25}):Promise.resolve([]),
      this.db.supportTicket.count({where:{...workspaceSupportTicketScope(ctx),status:{notIn:["RESOLVED","CLOSED"]}}}),
      this.db.supportTicket.findMany({where:workspaceSupportTicketScope(ctx),select:{lastInternalReplyAt:true,lastCustomerReplyAt:true,readStates:{where:{userId:ctx.user.id},select:{lastReadAt:true},take:1}}}),
    ]);
    const items=tickets.map(ticket=>{const{readStates,...safeTicket}=ticket,explicitReadAt=readStates[0]?.lastReadAt?.getTime()??0,customerReplyAt=ticket.lastCustomerReplyAt?.getTime()??0,internalReplyAt=ticket.lastInternalReplyAt?.getTime()??0,unread=internalReplyAt>Math.max(explicitReadAt,customerReplyAt);return{...safeTicket,unread,canReply:canCustomerReply(ticket),waitingFor:canCustomerReply(ticket)?"CUSTOMER":"PROOFLINE"}});
    const unreadCount=unreadRows.filter(ticket=>(ticket.lastInternalReplyAt?.getTime()??0)>Math.max(ticket.readStates[0]?.lastReadAt?.getTime()??0,ticket.lastCustomerReplyAt?.getTime()??0)).length;
    return{...paged(items,total,pg.page,pg.pageSize),tickets:items,changes,activeCount,unreadCount,canRequestAccountChange:ctx.capabilities.includes("account.change.request")};
  }

  async workspaceQueue(req: HeaderRequest) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const [tickets, changes] = await Promise.all([
      this.db.supportTicket.findMany({
        where: workspaceSupportTicketScope(ctx),
        include: {
          assignee: { select: { displayName: true } },
          readStates: {
            where: { userId: ctx.user.id },
            select: { lastReadAt: true },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      canReadAccountChanges(ctx) ? this.db.accountChangeRequest.findMany({
        where: { organizationId: ctx.organization.id },
        include: { supportTicket: { select: { subject: true, status: true } } },
        orderBy: { createdAt: "desc" },
      }) : Promise.resolve([]),
    ]);

    const mappedTickets = tickets.map((ticket) => {
      const { readStates, ...safeTicket } = ticket;
      const explicitReadAt = readStates[0]?.lastReadAt?.getTime() ?? 0;
      const customerReplyAt = ticket.lastCustomerReplyAt?.getTime() ?? 0;
      const internalReplyAt = ticket.lastInternalReplyAt?.getTime() ?? 0;
      const unread = internalReplyAt > Math.max(explicitReadAt, customerReplyAt);
      const canReply = canCustomerReply(ticket);

      return {
        ...safeTicket,
        unread,
        canReply,
        waitingFor: canReply ? "CUSTOMER" : "PROOFLINE",
      };
    });

    return {
      tickets: mappedTickets,
      unreadCount: mappedTickets.filter((ticket) => ticket.unread).length,
      changes,
      canRequestAccountChange: ctx.capabilities.includes("account.change.request"),
    };
  }

  async workspaceTicket(req: HeaderRequest, id: string) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const ticket = await this.db.supportTicket.findFirst({
      where: { id, ...workspaceSupportTicketScope(ctx) },
      include: {
        assignee: { select: { displayName: true } },
        readStates: {
          where: { userId: ctx.user.id },
          select: { lastReadAt: true },
          take: 1,
        },
        messages: {
          where: { visibility: "CUSTOMER" },
          include: {
            user: { select: { displayName: true } },
            internalUser: { select: { displayName: true } },
            attachments: { select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        documentRequests: {
          where: { status: "OPEN" },
          include: { requestedBy: { select: { displayName: true, role: true } }, attachment: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        accountChangeRequest: true,
      },
    });

    if (!ticket) throw new NotFoundException("Support ticket not found");

    const { readStates, ...safeTicket } = ticket;
    const explicitReadAt = readStates[0]?.lastReadAt?.getTime() ?? 0;
    const customerReplyAt = ticket.lastCustomerReplyAt?.getTime() ?? 0;
    const internalReplyAt = ticket.lastInternalReplyAt?.getTime() ?? 0;
    const unread = internalReplyAt > Math.max(explicitReadAt, customerReplyAt);
    const canReply = canCustomerReply(ticket);

    return {
      ...safeTicket,
      unread,
      canReply,
      waitingFor: canReply ? "CUSTOMER" : "PROOFLINE",
    };
  }

  async markWorkspaceTicketRead(req: HeaderRequest, id: string) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const ticket = await this.db.supportTicket.findFirst({
      where: { id, ...workspaceSupportTicketScope(ctx) },
      select: { id: true },
    });

    if (!ticket) throw new NotFoundException("Support ticket not found");

    const now = new Date();

    await this.db.supportTicketReadState.upsert({
      where: {
        ticketId_userId: {
          ticketId: id,
          userId: ctx.user.id,
        },
      },
      create: {
        ticketId: id,
        userId: ctx.user.id,
        lastReadAt: now,
      },
      update: {
        lastReadAt: now,
      },
    });

    return { ok: true, ticketId: id, lastReadAt: now.toISOString() };
  }
  async createWorkspaceTicket(req: HeaderRequest, input: { subject: string; description: string; category: string; priority: string }) {
    const ctx = await requireCapability(this.db, req, "support.use");
    if (!["TECHNICAL","BILLING","ACCESS","PRIVACY","SECURITY","FUNCTIONAL","OTHER"].includes(input.category)) throw new BadRequestException("Invalid support category");
    if (!["LOW","NORMAL","HIGH","URGENT"].includes(input.priority)) throw new BadRequestException("Invalid support priority");
    await this.guardNewTicket(ctx.organization.id, ctx.user.id, input);
    // The ticket, its initial CUSTOMER message and audit must commit together.
    return this.db.$transaction(async tx => {
      const ticket = await tx.supportTicket.create({ data: {
        organizationId: ctx.organization.id, requesterUserId: ctx.user.id,
        subject: input.subject.trim(), description: input.description.trim(),
        category: input.category as any, priority: input.priority as any,
        slaDueAt: dueAtFor(input.priority), lastCustomerReplyAt: new Date(),
        messages: { create: { userId: ctx.user.id, visibility: "CUSTOMER", body: input.description.trim() } },
      } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email,
        action: "SUPPORT_TICKET_CREATED", targetType: "SupportTicket", targetId: ticket.id,
        metadata: { category: input.category, priority: input.priority, slaDueAt: ticket.slaDueAt.toISOString() },
      } });
      return ticket;
    });
  }
  async addWorkspaceMessage(req: HeaderRequest, ticketId: string, body: string) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const ticket = await this.db.supportTicket.findFirst({ where: { id: ticketId, ...workspaceSupportTicketScope(ctx) } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    if (ticket.status === "CLOSED") throw new BadRequestException("Closed tickets cannot receive new messages");
    if(!canCustomerReply(ticket))throw new BadRequestException({code:"SUPPORT_WAIT_FOR_REPLY",message:"Please wait for a Proofline response before adding another message to this ticket.",ticketId});
    // Claim the exact version seen by the customer before writing the reply.
    // The message, ticket state and audit either commit together or not at all.
    const now = new Date();
    return this.db.$transaction(async tx => {
      const claimed = await tx.supportTicket.updateMany({
        where: { id: ticketId, status: ticket.status, updatedAt: ticket.updatedAt,
          lastCustomerReplyAt: ticket.lastCustomerReplyAt, lastInternalReplyAt: ticket.lastInternalReplyAt },
        data: { lastCustomerReplyAt: now, status: "IN_PROGRESS" },
      });
      if (claimed.count !== 1) throw new ConflictException("Ticket changed concurrently; refresh before replying");
      await tx.supportMessage.create({ data: { ticketId, userId: ctx.user.id, visibility: "CUSTOMER", body: body.trim() } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email,
        action: "SUPPORT_CUSTOMER_REPLIED", targetType: "SupportTicket", targetId: ticketId, metadata: {},
      } });
      return { ok: true };
    });
  }
  async uploadWorkspaceDocument(req: HeaderRequest, ticketId: string, input: { requestId: string; fileName: string; mimeType: string; base64: string; note?: string }) {
    const ctx = await requireCapability(this.db, req, "support.use");
    const request = await this.db.supportDocumentRequest.findFirst({
      where: { id: input.requestId, ticketId, status: "OPEN", ticket: workspaceSupportTicketScope(ctx) },
      include: { ticket: true, attachment: true },
    });
    if (!request) throw new BadRequestException({ code: "SUPPORT_DOCUMENT_REQUEST_NOT_OPEN", message: "There is no active document request for this ticket." });
    if (request.attachment) throw new BadRequestException({ code: "SUPPORT_DOCUMENT_ALREADY_UPLOADED", message: "The requested document has already been uploaded." });
    if (request.ticket.status === "CLOSED") throw new BadRequestException("Closed tickets cannot receive documents");

    const fileName = safeSupportFileName(input.fileName);
    const mimeType = input.mimeType.trim().toLowerCase();
    const extensions = SUPPORT_ATTACHMENT_ALLOWED.get(mimeType);
    if (!extensions || !extensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
      throw new BadRequestException({ code: "SUPPORT_DOCUMENT_TYPE", message: "Allowed formats: PDF, JPG, PNG and WEBP." });
    }
    if (input.base64.length > Math.ceil(request.maxFileSizeBytes * 4 / 3) + 32) {
      throw new BadRequestException({ code: "SUPPORT_DOCUMENT_TOO_LARGE", message: "The document exceeds the 5 MB limit." });
    }
    const bytes = Buffer.from(input.base64, "base64");
    if (!bytes.length || bytes.length > request.maxFileSizeBytes || bytes.length > SUPPORT_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException({ code: "SUPPORT_DOCUMENT_TOO_LARGE", message: "The document exceeds the 5 MB limit." });
    }
    if (!validSupportAttachmentSignature(mimeType, bytes)) {
      throw new BadRequestException({ code: "SUPPORT_DOCUMENT_INVALID", message: "The file content does not match its declared format." });
    }

    const note = (input.note ?? "").trim().slice(0, 1000);
    const now = new Date();
    const hash = createHash("sha256").update(bytes).digest("hex");
    const locale = ctx.user.locale === "en" ? "en" : "es";

    const result = await this.db.$transaction(async tx => {
      // Single-use document request: claim before storing any bytes or messages.
      const claimedRequest = await tx.supportDocumentRequest.updateMany({
        where: { id: request.id, ticketId, status: "OPEN" },
        data: { status: "FULFILLED", fulfilledAt: now },
      });
      if (claimedRequest.count !== 1) throw new ConflictException("Document request already fulfilled or cancelled");
      const claimedTicket = await tx.supportTicket.updateMany({
        where: { id: ticketId, status: request.ticket.status, updatedAt: request.ticket.updatedAt },
        data: { lastCustomerReplyAt: now, status: "IN_PROGRESS" },
      });
      if (claimedTicket.count !== 1) throw new ConflictException("Ticket changed concurrently; refresh before uploading");
      const record = await tx.documentRecord.create({
        data: {
          organizationId: ctx.organization.id,
          recordClass: "SUPPORT",
          documentType: "SUPPORT_ATTACHMENT",
          title: fileName,
          fileName,
          mimeType,
          contentHash: hash,
          immutable: true,
          metadata: { supportTicketId: ticketId, supportDocumentRequestId: request.id, uploadedByUserId: ctx.user.id },
          blob: { create: { bytes } },
        },
      });

      const messageBody = note
        ? (locale === "es" ? `Documento adjuntado: ${fileName}\n\n${note}` : `Document attached: ${fileName}\n\n${note}`)
        : (locale === "es" ? `Documento adjuntado: ${fileName}` : `Document attached: ${fileName}`);

      const message = await tx.supportMessage.create({
        data: { ticketId, userId: ctx.user.id, visibility: "CUSTOMER", body: messageBody },
      });

      const attachment = await tx.supportAttachment.create({
        data: {
          ticketId,
          requestId: request.id,
          messageId: message.id,
          documentRecordId: record.id,
          uploadedByUserId: ctx.user.id,
          originalFileName: fileName,
          mimeType,
          sizeBytes: bytes.length,
        },
      });

      await tx.auditEvent.create({ data: {
        organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email,
        action: "SUPPORT_DOCUMENT_UPLOADED", targetType: "SupportTicket", targetId: ticketId,
        metadata: { requestId: request.id, attachmentId: attachment.id,
          documentRecordId: record.id, messageId: message.id, fileName, mimeType, sizeBytes: bytes.length },
      } });
      return { attachment, messageId: message.id };
    });

    return { ok: true, attachmentId: result.attachment.id, messageId: result.messageId };
  }

  async workspaceAttachment(req: HeaderRequest, ticketId: string, attachmentId: string, mode: "view" | "download" = "view") {
    const ctx = await requireCapability(this.db, req, "support.use");
    const attachment = await this.db.supportAttachment.findFirst({
      where: { id: attachmentId, ticketId, ticket: workspaceSupportTicketScope(ctx) },
      include: { documentRecord: { include: { blob: true } } },
    });
    if (!attachment?.documentRecord.blob || ["BLOCKED", "ANONYMIZED", "DESTROYED"].includes(attachment.documentRecord.status)) throw new NotFoundException("Support attachment not found");
    await this.audit.record({
      organizationId: ctx.organization.id,
      actorType: "USER",
      actorId: ctx.identity.email,
      action: mode === "download" ? "SUPPORT_DOCUMENT_DOWNLOADED" : "SUPPORT_DOCUMENT_VIEWED",
      targetType: "SupportAttachment",
      targetId: attachment.id,
      metadata: { ticketId, fileName: attachment.originalFileName },
    });
    return { fileName: attachment.originalFileName, mimeType: attachment.mimeType, bytes: Buffer.from(attachment.documentRecord.blob.bytes) };
  }

  async internalAttachment(req: HeaderRequest, attachmentId: string, mode: "view" | "download" = "view") {
    const ctx = requireInternalCapability(req, "support.read");
    const attachment = await this.db.supportAttachment.findUnique({
      where: { id: attachmentId },
      include: { documentRecord: { include: { blob: true } }, ticket: { select: { id: true, organizationId: true } } },
    });
    if (!attachment?.documentRecord.blob || ["BLOCKED", "ANONYMIZED", "DESTROYED"].includes(attachment.documentRecord.status)) throw new NotFoundException("Support attachment not found");
    await this.internalTicket(req, attachment.ticketId);
    await this.audit.record({
      organizationId: attachment.ticket.organizationId,
      actorType: "INTERNAL",
      actorId: ctx.identity.email,
      action: mode === "download" ? "SUPPORT_DOCUMENT_DOWNLOADED" : "SUPPORT_DOCUMENT_VIEWED",
      targetType: "SupportAttachment",
      targetId: attachment.id,
      metadata: { ticketId: attachment.ticketId, fileName: attachment.originalFileName, actorRole: ctx.identity.role },
    });
    return { fileName: attachment.originalFileName, mimeType: attachment.mimeType, bytes: Buffer.from(attachment.documentRecord.blob.bytes) };
  }

  async requestAccountChange(req: HeaderRequest, input: { type: string; summary: string; requestedData: Record<string, unknown> }) {
    const ctx = await requireCapability(this.db, req, "account.change.request");
    if (!["LEGAL_NAME","TAX_ID","BILLING_EMAIL","CONTRACT_OWNER","PRIMARY_OWNER","OTHER"].includes(input.type)) throw new BadRequestException("Invalid account change type");
    const existing = await this.db.accountChangeRequest.findFirst({ where: {
      organizationId: ctx.organization.id, type: input.type as any,
      status: { in: ["REQUESTED","IN_REVIEW","NEEDS_INFO","APPROVED"] },
    }, include: { supportTicket: true }, orderBy: { createdAt: "desc" } });
    if (existing) throw new BadRequestException({ code: "SUPPORT_DUPLICATE", message: "An open request for this account change already exists.", existingTicketId: existing.supportTicketId, existingSubject: existing.supportTicket.subject, existingStatus: existing.supportTicket.status, etaMinutes: minutesUntil(existing.supportTicket.slaDueAt) });
    await this.guardNewTicket(ctx.organization.id, ctx.user.id, { subject: `Account change ${input.type}`, description: input.summary, category: "ACCOUNT_CHANGE" });
    // Serializable + repeat the predicate read INSIDE the transaction. A preflight
    // lookup alone cannot prevent two concurrent requests for the same type.
    try {
      return await this.db.$transaction(async tx => {
        const concurrent = await tx.accountChangeRequest.findFirst({ where: {
          organizationId: ctx.organization.id, type: input.type as any,
          status: { in: ["REQUESTED", "IN_REVIEW", "NEEDS_INFO", "APPROVED"] },
        }, include: { supportTicket: true }, orderBy: { createdAt: "desc" } });
        if (concurrent) throw new BadRequestException({ code: "SUPPORT_DUPLICATE",
          message: "An open request for this account change already exists.",
          existingTicketId: concurrent.supportTicketId,
          existingSubject: concurrent.supportTicket.subject,
          existingStatus: concurrent.supportTicket.status,
          etaMinutes: minutesUntil(concurrent.supportTicket.slaDueAt) });
        const ticket = await tx.supportTicket.create({ data: {
        organizationId: ctx.organization.id, requesterUserId: ctx.user.id,
        subject: `Account change · ${input.type}`, description: input.summary,
        category: "ACCOUNT_CHANGE", priority: "NORMAL", slaDueAt: dueAtFor("NORMAL"),
        lastCustomerReplyAt: new Date(),
        messages: { create: { userId: ctx.user.id, visibility: "CUSTOMER", body: input.summary } },
      } });
      const change = await tx.accountChangeRequest.create({ data: {
        organizationId: ctx.organization.id, requestedByUserId: ctx.user.id,
        supportTicketId: ticket.id, type: input.type as any,
        summary: input.summary, requestedData: input.requestedData as any,
      } });
      await tx.auditEvent.create({ data: {
        organizationId: ctx.organization.id, actorType: "USER", actorId: ctx.user.email,
        action: "ACCOUNT_CHANGE_REQUESTED", targetType: "AccountChangeRequest", targetId: change.id,
        metadata: { type: input.type, supportTicketId: ticket.id },
      } });
        return { ok: true, id: change.id, ticketId: ticket.id };
      }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2034") {
        throw new ConflictException({ code: "SUPPORT_CONCURRENT_REQUEST",
          message: "A concurrent account change was detected; refresh the requests and retry." });
      }
      throw error;
    }
  }


  async internalQueuePage(req: HeaderRequest, input:{page?:string;pageSize?:string;view?:string;q?:string;priority?:string;status?:string}) {
    const ctx=requireInternalCapability(req,"support.read");
    const agent=await this.db.internalUser.findUnique({where:{email:ctx.identity.email},select:{id:true,role:true,createdAt:true}});
    if(!agent)throw new ForbiddenException("Internal support identity is not provisioned");
    const historyScope:any=agent.role==="INTERNAL_SUPPORT"?{OR:[{status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"] as any}},{createdAt:{gte:agent.createdAt}},{assigneeInternalUserId:agent.id},{messages:{some:{internalUserId:agent.id}}}]}:{};
    const view=input.view??"open",nowDate=new Date();let viewWhere:any={};
    if(view==="mine")viewWhere={assigneeInternalUserId:agent.id,status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]}};
    else if(view==="unassigned")viewWhere={assigneeInternalUserId:null,status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]}};
    else if(view==="overdue")viewWhere={slaDueAt:{lt:nowDate},status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]}};
    else if(view==="history")viewWhere={status:{in:["RESOLVED","CLOSED"]}};
    else if(view!=="all")viewWhere={status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]}};
    // Keep the agent's history scope intact while applying bounded database filters.
    const {q,priority,status}=supportFilters(input);
    const filters:any[]=[historyScope,viewWhere];
    if(q)filters.push({OR:[{id:{contains:q,mode:"insensitive"}},{subject:{contains:q,mode:"insensitive"}},{organization:{name:{contains:q,mode:"insensitive"}}}]});
    if(priority)filters.push({priority});
    if(status)filters.push({status});
    const where:any={AND:filters};
    const total=await this.db.supportTicket.count({where});
    const pg=clampedPagination(total,input);
    const openWhere:any={AND:[historyScope,{status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]}}]};
    const [tickets,open,unassigned,overdue,resolved,groups]=await Promise.all([
      this.db.supportTicket.findMany({where,skip:pg.skip,take:pg.take,include:{organization:true,requester:{select:{id:true,displayName:true,email:true}},assignee:{select:{id:true,displayName:true,email:true}},accountChangeRequest:true,_count:{select:{messages:true}}},orderBy:view==="history"?[{closedAt:"desc" as const},{resolvedAt:"desc" as const},{id:"asc" as const}]:[{status:"asc" as const},{priority:"desc" as const},{slaDueAt:"asc" as const},{id:"asc" as const}]}),
      this.db.supportTicket.count({where:openWhere}),
      this.db.supportTicket.count({where:{AND:[historyScope,{status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]},assigneeInternalUserId:null}]}}),
      this.db.supportTicket.count({where:{AND:[historyScope,{status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]},slaDueAt:{lt:nowDate}}]}}),
      this.db.supportTicket.count({where:{AND:[historyScope,{status:{in:["RESOLVED","CLOSED"]}}]}}),
      this.db.supportTicket.groupBy({by:["requesterUserId"],where:{AND:[historyScope,{status:{in:["OPEN","ASSIGNED","IN_PROGRESS","WAITING","ESCALATED"]},requesterUserId:{not:null}}]},_count:{_all:true}} as any),
    ]);
    const counts=new Map<string,number>();for(const g of groups as any[]){if(g.requesterUserId)counts.set(g.requesterUserId,g._count._all)}
    const now=Date.now(),items=tickets.map(t=>({...t,sla:{overdue:openStatuses.has(t.status)&&t.slaDueAt.getTime()<now,minutesRemaining:Math.round((t.slaDueAt.getTime()-now)/60000)},risk:{possibleSaturation:Boolean(t.requesterUserId&&(counts.get(t.requesterUserId)??0)>=4),requesterOpenTickets:t.requesterUserId?(counts.get(t.requesterUserId)??0):0}}));
    return{...paged(items,total,pg.page,pg.pageSize),historyVisibleFrom:agent.role==="INTERNAL_SUPPORT"?agent.createdAt:null,metrics:{open,unassigned,overdue,resolved,saturationRisk:[...counts.values()].filter(n=>n>=4).length}};
  }

  async internalQueue(req: HeaderRequest) {
    const ctx = requireInternalCapability(req, "support.read");
    const agent = await this.db.internalUser.findUnique({
      where: { email: ctx.identity.email },
      select: { id: true, role: true, createdAt: true },
    });
    if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");

    const supportHistoryScope = agent.role === "INTERNAL_SUPPORT"
      ? {
          OR: [
            { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"] as any } },
            { createdAt: { gte: agent.createdAt } },
            { assigneeInternalUserId: agent.id },
            { messages: { some: { internalUserId: agent.id } } },
          ],
        }
      : {};

    const now = Date.now();
    const tickets = await this.db.supportTicket.findMany({
      where: supportHistoryScope as any,
      include: {
        organization: true,
        requester: { select: { id: true, displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        accountChangeRequest: true,
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { slaDueAt: "asc" }],
    });

    const requesterCounts = new Map<string, number>();
    for (const t of tickets) {
      if (t.requesterUserId && openStatuses.has(t.status)) requesterCounts.set(t.requesterUserId, (requesterCounts.get(t.requesterUserId) ?? 0) + 1);
    }

    const rows = tickets.map(t => ({
      ...t,
      sla: {
        overdue: openStatuses.has(t.status) && t.slaDueAt.getTime() < now,
        minutesRemaining: Math.round((t.slaDueAt.getTime() - now) / 60_000),
      },
      risk: {
        possibleSaturation: Boolean(t.requesterUserId && (requesterCounts.get(t.requesterUserId) ?? 0) >= 4),
        requesterOpenTickets: t.requesterUserId ? (requesterCounts.get(t.requesterUserId) ?? 0) : 0,
      },
    }));

    return {
      tickets: rows,
      historyVisibleFrom: agent.role === "INTERNAL_SUPPORT" ? agent.createdAt : null,
      metrics: {
        open: rows.filter(t => openStatuses.has(t.status)).length,
        unassigned: rows.filter(t => openStatuses.has(t.status) && !t.assignee).length,
        overdue: rows.filter(t => t.sla.overdue).length,
        resolved: rows.filter(t => ["RESOLVED", "CLOSED"].includes(t.status)).length,
        saturationRisk: rows.filter(t => t.risk.possibleSaturation).length,
      },
    };
  }

  async internalTicket(req: HeaderRequest, id: string) {
    const ctx = requireInternalCapability(req, "support.read");
    const agent = await this.db.internalUser.findUnique({
      where: { email: ctx.identity.email },
      select: { id: true, role: true, createdAt: true },
    });
    if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");

    const ticket = await this.db.supportTicket.findUnique({
      where: { id },
      include: {
        organization: true,
        requester: { select: { displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        messages: {
          include: {
            user: { select: { displayName: true } },
            internalUser: { select: { displayName: true, role: true } },
            attachments: { select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        documentRequests: {
          include: {
            requestedBy: { select: { displayName: true, role: true } },
            attachment: { select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        accountChangeRequest: true,
      },
    });
    if (!ticket) throw new NotFoundException("Support ticket not found");

    if (agent.role === "INTERNAL_SUPPORT") {
      const isActive = openStatuses.has(ticket.status);
      const belongsToVisibleHistory =
        ticket.createdAt >= agent.createdAt ||
        ticket.assigneeInternalUserId === agent.id ||
        ticket.messages.some(m => m.internalUserId === agent.id);
      if (!isActive && !belongsToVisibleHistory) throw new NotFoundException("Support ticket not found");
    }

    const targets: Array<{ targetType: string; targetId: string }> = [
      { targetType: "SupportTicket", targetId: id },
    ];
    if (ticket.accountChangeRequest) {
      targets.push({ targetType: "AccountChangeRequest", targetId: ticket.accountChangeRequest.id });
    }

    const history = await this.db.auditEvent.findMany({
      where: {
        OR: targets,
        ...(agent.role === "INTERNAL_SUPPORT" ? { createdAt: { gte: agent.createdAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 300,
    });

    return {
      ...ticket,
      history,
      historyVisibleFrom: agent.role === "INTERNAL_SUPPORT" ? agent.createdAt : null,
    };
  }
  async assignToMe(req: HeaderRequest, ticketId: string) {
    const ctx = requireInternalCapability(req, "support.manage");
    const [ticket, agent] = await Promise.all([
      this.db.supportTicket.findUnique({ where: { id: ticketId } }),
      this.db.internalUser.findUnique({ where: { email: ctx.identity.email } }),
    ]);
    if (!ticket) throw new NotFoundException("Support ticket not found");
    if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");
    if (ticket.assigneeInternalUserId === agent.id) return ticket; // idempotent repeat
    if (ticket.assigneeInternalUserId || !openStatuses.has(ticket.status)) {
      throw new ConflictException("Ticket is already assigned or no longer open; refresh before assigning");
    }
    const now = new Date();
    return this.db.$transaction(async tx => {
      const claimed = await tx.supportTicket.updateMany({
        // Compare-and-swap: prevents the last agent from silently stealing a ticket.
        where: { id: ticketId, assigneeInternalUserId: null, status: ticket.status, updatedAt: ticket.updatedAt },
        data: {
          assigneeInternalUserId: agent.id,
          assignedAt: now,
          status: (["OPEN", "ESCALATED"] as string[]).includes(ticket.status) ? "ASSIGNED" : ticket.status as any,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("Ticket was modified by another agent; refresh and retry");
      await tx.auditEvent.create({ data: {
        organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
        action: "SUPPORT_TICKET_ASSIGNED", targetType: "SupportTicket", targetId: ticketId,
        metadata: { assignee: agent.email, from: ticket.status },
      } });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    });
  }
  async updateStatus(req: HeaderRequest, ticketId: string, status: string) {
    const ctx = requireInternalCapability(req, "support.manage");
    if (!["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING", "RESOLVED", "ESCALATED", "CLOSED"].includes(status)) {
      throw new BadRequestException("Invalid ticket status");
    }
    const ticket = await this.db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { where: { visibility: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    if (status === ticket.status) return ticket;
    if (!canTransitionSupportTicket(ticket.status, status)) {
      throw new ConflictException("Invalid ticket transition; refresh and choose an allowed state");
    }
    if (["RESOLVED", "CLOSED"].includes(status)) {
      const latestCustomer = ticket.messages.find((m: any) => Boolean(m.userId));
      const latestInternal = ticket.messages.find((m: any) => Boolean(m.internalUserId));
      if (!latestInternal || (latestCustomer && latestInternal.createdAt < latestCustomer.createdAt)) {
        throw new BadRequestException({ code: "SUPPORT_RESOLUTION_MESSAGE_REQUIRED", message: "Send a customer-visible response before resolving or closing the ticket." });
      }
    }
    const now = new Date();
    return this.db.$transaction(async tx => {
      const changed = await tx.supportTicket.updateMany({
        where: { id: ticketId, status: ticket.status as any, updatedAt: ticket.updatedAt },
        data: {
          status: status as any,
          resolvedAt: status === "RESOLVED" ? now : ["OPEN", "IN_PROGRESS"].includes(status) ? null : ticket.resolvedAt,
          closedAt: status === "CLOSED" ? now : null,
        },
      });
      if (changed.count !== 1) throw new ConflictException("Ticket state changed concurrently; refresh and retry");
      await tx.auditEvent.create({ data: {
        organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
        action: "SUPPORT_TICKET_STATUS_CHANGED", targetType: "SupportTicket", targetId: ticketId,
        metadata: { from: ticket.status, to: status },
      } });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    });
  }
  async addInternalMessage(req: HeaderRequest, ticketId: string, body: string, visibility: string) {
    const ctx = requireInternalCapability(req, "support.manage");
    const [ticket, agent] = await Promise.all([
      this.db.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          requester: { select: { displayName: true, email: true } },
          organization: { select: { name: true, defaultLocale: true } },
        },
      }),
      this.db.internalUser.findUnique({ where: { email: ctx.identity.email } }),
    ]);

    if (!ticket) throw new NotFoundException("Support ticket not found");
    if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");
    const messageBody = body.trim();
    if (!messageBody) throw new BadRequestException("Message is required");
    if (ticket.status === "CLOSED") throw new BadRequestException("Closed tickets cannot receive new messages");

    const safeVisibility = visibility === "INTERNAL" ? "INTERNAL" : "CUSTOMER";
    const now = new Date();
    const clientBase = (process.env.CLIENT_APP_URL ?? "http://localhost:4202").replace(/\/$/,"");
    const locale = ticket.organization.defaultLocale === "en" ? "en" : "es";
    const actionUrl = `${clientBase}/${locale}/support/${ticketId}`;

    const message = await this.db.$transaction(async tx => {
      const created = await tx.supportMessage.create({
        data: {
          ticketId,
          internalUserId: agent.id,
          visibility: safeVisibility as any,
          body: messageBody,
        },
      });

      if (safeVisibility === "CUSTOMER") {
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: { lastInternalReplyAt: now, status: "WAITING" },
        });

        if (ticket.requester?.email) {
          await tx.outboxEvent.create({
            data: {
              type: "SEND_EMAIL",
              payload: {
                to: ticket.requester.email,
                subject: locale === "es" ? `PROOFLINE Support · ${ticket.subject}` : `PROOFLINE Support · ${ticket.subject}`,
                text: locale === "es"
                  ? `Hola ${ticket.requester.displayName ?? ""},\n\nProofline ha respondido a tu ticket “${ticket.subject}”.\n\n${messageBody}\n\nPuedes responder desde el mismo ticket en tu Workspace:\n${actionUrl}\n\nPROOFLINE Support`
                  : `Hello ${ticket.requester.displayName ?? ""},\n\nProofline has replied to your ticket “${ticket.subject}”.\n\n${messageBody}\n\nYou can reply in the same ticket in your Workspace:\n${actionUrl}\n\nPROOFLINE Support`,
                html: supportEmailHtml({
                  kicker: locale === "es" ? "SOPORTE · RESPUESTA" : "SUPPORT · REPLY",
                  title: locale === "es" ? "Proofline ha respondido a tu ticket" : "Proofline replied to your ticket",
                  intro: `Ticket: ${ticket.subject}`,
                  body: messageBody,
                  actionUrl,
                  actionLabel: locale === "es" ? "Abrir ticket" : "Open ticket",
                }),
                category: "support_customer_reply",
                locale,
                organizationId: ticket.organizationId,
                ticketId,
              },
            },
          });
        }
      }

      return created;
    });

    await this.audit.record({
      organizationId: ticket.organizationId,
      actorType: "INTERNAL",
      actorId: ctx.identity.email,
      action: safeVisibility === "CUSTOMER" ? "SUPPORT_INTERNAL_REPLIED" : "SUPPORT_INTERNAL_NOTE_ADDED",
      targetType: "SupportTicket",
      targetId: ticketId,
      metadata: {
        visibility: safeVisibility,
        actorRole: ctx.identity.role,
        messageId: message.id,
        deliveredToCustomer: safeVisibility === "CUSTOMER",
      },
    });

    return { ok: true, messageId: message.id };
  }

  async requestInformation(req: HeaderRequest, ticketId: string, body: string, requestDocument = false) {
    const ctx = requireInternalCapability(req, "support.manage");
    const requestBody = body.trim();
    if (requestBody.length < 3) throw new BadRequestException("Explain what information is required");

    const [ticket, agent] = await Promise.all([
      this.db.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          requester: { select: { displayName: true, email: true } },
          organization: { select: { name: true, defaultLocale: true } },
          accountChangeRequest: true,
        },
      }),
      this.db.internalUser.findUnique({ where: { email: ctx.identity.email } }),
    ]);

    if (!ticket) throw new NotFoundException("Support ticket not found");
    if (!agent) throw new ForbiddenException("Internal support identity is not provisioned");
    if (ticket.status === "CLOSED") throw new BadRequestException("Closed tickets cannot request more information");
    if (ticket.accountChangeRequest && !canTransitionAccountChange(ticket.accountChangeRequest.status, "NEEDS_INFO")) {
      throw new ConflictException("Account change is final; cannot request more information");
    }

    const now = new Date();
    const messageBody = requestDocument
      ? `Solicitud de documento\n\n${requestBody}\n\nAdjunta el documento solicitado desde este ticket. Formatos permitidos: PDF, JPG, PNG o WEBP. Máximo 5 MB.`
      : `Solicitud de información adicional\n\n${requestBody}`;
    const clientBase = (process.env.CLIENT_APP_URL ?? "http://localhost:4202").replace(/\/$/,"");
    const locale = ticket.organization.defaultLocale === "en" ? "en" : "es";
    const actionUrl = `${clientBase}/${locale}/support/${ticketId}`;

    const transactionResult = await this.db.$transaction(async tx => {
      const created = await tx.supportMessage.create({
        data: {
          ticketId,
          internalUserId: agent.id,
          visibility: "CUSTOMER",
          body: messageBody,
        },
      });

      let documentRequestId: string | null = null;
      if (requestDocument) {
        await tx.supportDocumentRequest.updateMany({
          where: { ticketId, status: "OPEN" },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        const documentRequest = await tx.supportDocumentRequest.create({
          data: {
            ticketId,
            requestedByInternalUserId: agent.id,
            messageId: created.id,
            instructions: requestBody,
            maxFileSizeBytes: SUPPORT_ATTACHMENT_MAX_BYTES,
          },
        });
        documentRequestId = documentRequest.id;
      }

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { lastInternalReplyAt: now, status: "WAITING" },
      });

      if (ticket.accountChangeRequest) {
        // Always compare against the observed state, including repeat NEEDS_INFO
        // requests. Otherwise a concurrent APPLIED could be followed by a new
        // document request and customer email for an already completed change.
        const changed = await tx.accountChangeRequest.updateMany({
          where: {
            id: ticket.accountChangeRequest.id,
            status: ticket.accountChangeRequest.status,
            updatedAt: ticket.accountChangeRequest.updatedAt,
          },
          data: { status: "NEEDS_INFO", resolutionNote: null, reviewedBy: ctx.identity.email, reviewedAt: now },
        });
        if (changed.count !== 1) throw new ConflictException("Account change was modified concurrently; refresh and retry");
      }

      if (ticket.requester?.email) {
        await tx.outboxEvent.create({
          data: {
            type: "SEND_EMAIL",
            payload: {
              to: ticket.requester.email,
              subject: requestDocument
                ? (locale === "es" ? `PROOFLINE · Documento solicitado · ${ticket.subject}` : `PROOFLINE · Document requested · ${ticket.subject}`)
                : (locale === "es" ? `PROOFLINE · Necesitamos información adicional · ${ticket.subject}` : `PROOFLINE · Additional information required · ${ticket.subject}`),
              text: locale === "es"
                ? (requestDocument
                    ? `Hola ${ticket.requester.displayName ?? ""},\n\nPara continuar con tu solicitud “${ticket.subject}”, necesitamos que adjuntes un documento:\n\n${requestBody}\n\nEl botón para adjuntar estará habilitado únicamente dentro de este ticket. Formatos: PDF, JPG, PNG o WEBP. Máximo 5 MB.\n\n${actionUrl}\n\nPROOFLINE Support`
                    : `Hola ${ticket.requester.displayName ?? ""},\n\nPara continuar con tu solicitud “${ticket.subject}”, necesitamos la siguiente información:\n\n${requestBody}\n\nResponde desde el mismo ticket en tu Workspace:\n${actionUrl}\n\nPROOFLINE Support`)
                : (requestDocument
                    ? `Hello ${ticket.requester.displayName ?? ""},\n\nTo continue with “${ticket.subject}”, please attach the requested document:\n\n${requestBody}\n\nThe attachment control is enabled only inside this ticket. Formats: PDF, JPG, PNG or WEBP. Maximum 5 MB.\n\n${actionUrl}\n\nPROOFLINE Support`
                    : `Hello ${ticket.requester.displayName ?? ""},\n\nTo continue with your request “${ticket.subject}”, we need the following information:\n\n${requestBody}\n\nReply in the same ticket in your Workspace:\n${actionUrl}\n\nPROOFLINE Support`),
              html: supportEmailHtml({
                kicker: locale === "es" ? "SOPORTE · ACCIÓN REQUERIDA" : "SUPPORT · ACTION REQUIRED",
                title: requestDocument ? (locale === "es" ? "Necesitamos un documento" : "We need a document") : (locale === "es" ? "Necesitamos información adicional" : "We need additional information"),
                intro: requestDocument
                  ? (locale === "es" ? `Para continuar con “${ticket.subject}”, adjunta el documento solicitado desde el mismo ticket.` : `To continue with “${ticket.subject}”, attach the requested document from the same ticket.`)
                  : (locale === "es" ? `Para continuar con “${ticket.subject}”, responde a la solicitud desde el mismo ticket.` : `To continue with “${ticket.subject}”, reply to the request in the same ticket.`),
                body: requestBody,
                actionUrl,
                actionLabel: requestDocument ? (locale === "es" ? "Adjuntar documento" : "Attach document") : (locale === "es" ? "Responder en el ticket" : "Reply in ticket"),
              }),
              category: "support_information_request",
              locale,
              organizationId: ticket.organizationId,
              ticketId,
            },
          },
        });
      }

      await tx.auditEvent.create({ data: {
        organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
        action: "SUPPORT_INFORMATION_REQUESTED", targetType: "SupportTicket", targetId: ticketId,
        metadata: {
          actorRole: ctx.identity.role, messageId: created.id,
          accountChangeRequestId: ticket.accountChangeRequest?.id ?? null,
          workspaceVisible: true, emailQueued: Boolean(ticket.requester?.email),
          requestDocument, documentRequestId,
        },
      } });
      if (requestDocument && documentRequestId) {
        await tx.auditEvent.create({ data: {
          organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
          action: "SUPPORT_DOCUMENT_REQUESTED", targetType: "SupportDocumentRequest", targetId: documentRequestId,
          metadata: { ticketId, messageId: created.id, maxFileSizeBytes: SUPPORT_ATTACHMENT_MAX_BYTES, actorRole: ctx.identity.role },
        } });
      }
      if (ticket.accountChangeRequest && ticket.accountChangeRequest.status !== "NEEDS_INFO") {
        await tx.auditEvent.create({ data: {
          organizationId: ticket.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
          action: "ACCOUNT_CHANGE_STATUS_CHANGED", targetType: "AccountChangeRequest", targetId: ticket.accountChangeRequest.id,
          metadata: {
            from: ticket.accountChangeRequest.status, to: "NEEDS_INFO",
            supportTicketId: ticketId, source: "SUPPORT_INFORMATION_REQUESTED",
          },
        } });
      }
      return { created, documentRequestId };
    });

    const message = transactionResult.created;

    return { ok: true, messageId: message.id, documentRequestId: transactionResult.documentRequestId };
  }


  async updateAccountChange(req: HeaderRequest, id: string, status: string, resolutionNote?: string, requestDocument = false) {
    const ctx = requireInternalCapability(req, "support.manage");
    if (!["REQUESTED", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "APPLIED"].includes(status)) {
      throw new BadRequestException("Invalid account change status");
    }
    if (status === "APPLIED") requireInternalCapability(req, "account.change.apply");
    const change = await this.db.accountChangeRequest.findUnique({ where: { id } });
    if (!change) throw new NotFoundException("Account change request not found");
    const note = resolutionNote?.trim() ?? "";
    const sameStatus = status === change.status;
    if (!sameStatus && !canTransitionAccountChange(change.status, status)) {
      throw new ConflictException("Invalid account change transition; refresh before continuing");
    }
    if (status === "NEEDS_INFO") {
      // A renewed information request is meaningful even while already NEEDS_INFO.
      if (!note) throw new BadRequestException("Explain what information the customer must provide");
      await this.requestInformation(req, change.supportTicketId, note, requestDocument);
      return this.db.accountChangeRequest.findUnique({ where: { id } });
    }
    if (sameStatus) {
      if (!note || note === (change.resolutionNote ?? "")) return change; // safe repeat
      // Preserve editing review notes while actively handling a request.
      if (["APPLIED", "REJECTED"].includes(status)) throw new ConflictException("Final account changes cannot be edited");
    }
    const now = new Date();
    // Domain mutation, status, and audit must commit or roll back together.
    return this.db.$transaction(async tx => {
      const claimed = await tx.accountChangeRequest.updateMany({
        where: { id, status: change.status as any, updatedAt: change.updatedAt },
        data: {
          status: status as any, resolutionNote: note || null,
          reviewedBy: ctx.identity.email, reviewedAt: now,
          appliedAt: status === "APPLIED" ? now : change.appliedAt,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("Account change was modified concurrently; refresh and retry");
      if (status === "APPLIED") {
        const requested = change.requestedData && typeof change.requestedData === "object" && !Array.isArray(change.requestedData)
          ? change.requestedData as Record<string, unknown> : {};
        const value = String(requested.requestedValue ?? "").trim();
        if (["LEGAL_NAME", "TAX_ID", "BILLING_EMAIL", "CONTRACT_OWNER", "PRIMARY_OWNER"].includes(change.type) && !value) {
          throw new BadRequestException("Requested value is required before applying this change");
        }
        if (change.type === "LEGAL_NAME") await tx.organization.update({ where: { id: change.organizationId }, data: { legalName: value } });
        if (change.type === "TAX_ID") await tx.organization.update({ where: { id: change.organizationId }, data: { taxId: value } });
        if (change.type === "BILLING_EMAIL") await tx.organization.update({ where: { id: change.organizationId }, data: { billingEmail: value.toLowerCase() } });
        if (change.type === "CONTRACT_OWNER") await tx.organization.update({ where: { id: change.organizationId }, data: { contractOwnerEmail: value.toLowerCase() } });
        if (change.type === "PRIMARY_OWNER") {
          const target = await tx.user.findUnique({ where: { email: value.toLowerCase() }, include: { memberships: true } });
          const membership = target?.memberships.find(m => m.organizationId === change.organizationId);
          if (!membership) throw new BadRequestException("The requested Owner must already be a member of the organization");
          await tx.membership.updateMany({
            where: { organizationId: change.organizationId, role: "OWNER", id: { not: membership.id } }, data: { role: "ADMIN" },
          });
          await tx.membership.update({ where: { id: membership.id }, data: { role: "OWNER" } });
        }
      }
      await tx.auditEvent.create({ data: {
        organizationId: change.organizationId, actorType: "INTERNAL", actorId: ctx.identity.email,
        action: "ACCOUNT_CHANGE_STATUS_CHANGED", targetType: "AccountChangeRequest", targetId: id,
        metadata: { from: change.status, to: status, applied: status === "APPLIED", supportTicketId: change.supportTicketId, actorRole: ctx.identity.role },
      } });
      return tx.accountChangeRequest.findUniqueOrThrow({ where: { id } });
    });
  }
  async processSlaEscalations() {
    // A worker may run in parallel with another worker or an agent action.
    // Only the transaction that claims a still-due, still-active ticket may
    // persist its escalation, audit record and notification outbox entries.
    const now = new Date();
    const activeStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"] as const;
    const due = await this.db.supportTicket.findMany({
      where: { status: { in: [...activeStatuses] }, slaDueAt: { lte: now }, escalatedAt: null },
      include: { organization: { select: { name: true, defaultLocale: true } } },
      orderBy: [{ slaDueAt: "asc" }, { id: "asc" }],
      take: 100,
    });
    if (!due.length) return { escalated: 0 };

    const internalRecipients = await this.db.internalUser.findMany({
      where: { status: "ACTIVE", role: { in: ["INTERNAL_SUPPORT", "INTERNAL_OPERATIONS", "INTERNAL_PLATFORM_OWNER"] } },
      select: { email: true, role: true },
    });
    // Do not silently mark a ticket escalated when no operational contact can
    // receive the alert. The next worker check can retry when provisioned.
    const uniqueRecipients = new Map<string, (typeof internalRecipients)[number]>();
    for (const recipient of internalRecipients) {
      const key = recipient.email.trim().toLowerCase();
      if (!key) continue;
      const previous = uniqueRecipients.get(key);
      if (!previous || recipient.role === "INTERNAL_PLATFORM_OWNER") {
        uniqueRecipients.set(key, recipient);
      }
    }
    if (!uniqueRecipients.size) throw new Error("SUPPORT_SLA_NO_RECIPIENTS: provision an active internal support/operations/owner recipient");

    let escalated = 0;
    for (const ticket of due) {
      const didEscalate = await this.db.$transaction(async tx => {
        const changed = await tx.supportTicket.updateMany({
          where: {
            id: ticket.id,
            escalatedAt: null,
            slaDueAt: { lte: now },
            status: ticket.status,
            assigneeInternalUserId: ticket.assigneeInternalUserId,
            updatedAt: ticket.updatedAt,
          },
          data: {
            escalatedAt: now,
            // The SLA escalation should not replace the current agent's
            // workflow state or discard an assigned agent.
            ...(ticket.status === "OPEN" && ticket.assigneeInternalUserId === null
              ? { status: "ESCALATED" as const }
              : {}),
          },
        });
        if (changed.count !== 1) return false; // Already claimed or no longer due.

        const locale = ticket.organization.defaultLocale === "en" ? "en" : "es";
        const assigned = ticket.assigneeInternalUserId !== null;
        const subject = locale === "es"
          ? `PROOFLINE Soporte · SLA vencido · ${ticket.organization.name}`
          : `PROOFLINE Support · Overdue SLA · ${ticket.organization.name}`;
        const body = locale === "es"
          ? `El ticket ${ticket.id} (${ticket.priority}) ha superado su SLA.\n\n${ticket.subject}\n\n${assigned ? "El ticket tiene un agente asignado y requiere seguimiento." : "El ticket no tiene agente asignado y requiere adjudicación."}`
          : `Ticket ${ticket.id} (${ticket.priority}) has exceeded its SLA.\n\n${ticket.subject}\n\n${assigned ? "The ticket is assigned and needs follow-up." : "The ticket is unassigned and needs an owner."}`;

        await tx.auditEvent.create({ data: {
          organizationId: ticket.organizationId,
          actorType: "SYSTEM", actorId: "support-sla",
          action: "SUPPORT_TICKET_SLA_ESCALATED", targetType: "SupportTicket", targetId: ticket.id,
          metadata: {
            slaDueAt: ticket.slaDueAt.toISOString(), priority: ticket.priority,
            statusBefore: ticket.status, assigned, assigneeInternalUserId: ticket.assigneeInternalUserId,
            recipientCount: uniqueRecipients.size,
          },
        } });
        for (const recipient of uniqueRecipients.values()) {
          await tx.outboxEvent.create({ data: {
            type: "SEND_EMAIL",
            payload: {
              to: recipient.email.trim(), subject, text: body, locale,
              organizationId: ticket.organizationId, ticketId: ticket.id,
              category: recipient.role === "INTERNAL_PLATFORM_OWNER" ? "support_sla_owner" : "support_sla_escalation",
            },
          } });
        }
        return true;
      });
      if (didEscalate) escalated += 1;
    }
    return { escalated };
  }
}
