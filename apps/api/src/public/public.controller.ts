import { Body, Controller, Post, Inject } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service.js";
import { blindIndex, encryptText } from "../security/crypto.js";

const LeadSchema = z.object({
  name:z.string().min(2).max(120),
  email:z.string().email(),
  company:z.string().min(2).max(160),
  message:z.string().max(2000).optional().default(""),
  locale:z.enum(["es","en"]).default("es"),
  marketingConsent:z.boolean().default(false)
});

@Controller("v1/public")
export class PublicController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Post("leads")
  async lead(@Body() body: unknown) {
    const value = LeadSchema.parse(body);
    const privacy = await this.db.legalDocumentVersion.findFirstOrThrow({
      where:{document:{key:"privacy"},locale:value.locale,active:true},
      orderBy:{effectiveAt:"desc"}
    });
    const actorRef = blindIndex(value.email);
    const lead = await this.db.lead.create({
      data:{
        name:value.name,
        emailEncrypted:encryptText(value.email),
        emailLookup:actorRef,
        company:value.company,
        message:value.message,
        locale:value.locale,
        marketingConsent:value.marketingConsent,
        privacyNoticeVersion:`${privacy.version}:${privacy.id}`
      }
    });
    await this.db.legalInteraction.create({data:{
      documentVersionId:privacy.id,
      actorType:"PUBLIC_VISITOR",
      actorRef,
      action:"ACKNOWLEDGE",
      locale:value.locale,
      evidence:{channel:"public-contact",leadId:lead.id,purpose:"respond_to_contact_request"}
    }});
    if(value.marketingConsent){
      const marketing = await this.db.legalDocumentVersion.findFirstOrThrow({
        where:{document:{key:"marketing-consent"},locale:value.locale,active:true},
        orderBy:{effectiveAt:"desc"}
      });
      await this.db.legalInteraction.create({data:{
        documentVersionId:marketing.id,
        actorType:"PUBLIC_VISITOR",
        actorRef,
        action:"CONSENT",
        locale:value.locale,
        evidence:{channel:"public-contact",leadId:lead.id,purpose:"marketing_updates",separateControl:true}
      }});
    }
    await this.db.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: {
      to: "sales@proofline.local",
      subject: `New Proofline lead: ${value.company}`,
      text: `Lead ${value.name} from ${value.company}. Reply to ${value.email}.\n\n${value.message}`,
      category:"public_lead"
    } } });
    return { ok: true, id: lead.id };
  }
}
