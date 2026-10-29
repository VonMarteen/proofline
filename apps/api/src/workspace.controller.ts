import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "./audit/audit.service.js";
import { accessContext, permittedAssessmentIds, requireCapability, roleCapabilities } from "./auth/access-control.js";
import { ClientDevAuthGuard, type HeaderRequest } from "./auth/dev-auth.js";
import { PrismaService } from "./database/prisma.service.js";
import { blindIndex, decryptText, encryptText } from "./security/crypto.js";
import { buildDirectorySearchIndex, directorySearchQueryTokens, DIRECTORY_SEARCH_INDEX_VERSION } from "./security/directory-search.js";
import { BrandingService } from "./branding/branding.service.js";
import { AuthService } from "./auth/auth.service.js";
import { parsePagination, paged } from "./common/pagination.js";
import { workspaceUsageWhere } from "./common/workspace-usage-query.js";

const roles=["ADMIN","BILLING_ADMIN","ASSESSMENT_MANAGER","REVIEWER","ANALYST","VIEWER"] as const;
const Invite=z.object({email:z.string().email(),displayName:z.string().min(2),role:z.enum(roles)});
const Role=z.object({role:z.enum(roles)});
const AccessScope=z.object({assessmentIds:z.array(z.string()).max(200)});
const Create=z.object({title:z.string().min(4).max(160),objective:z.string().min(12).max(1600),level:z.enum(["L1","L2","L3","L4"]).default("L2"),locale:z.enum(["es","en"]).default("es")});
const Unit=z.object({name:z.string().min(2),code:z.string().optional().or(z.literal("")),type:z.enum(["DEPARTMENT","BUSINESS_UNIT","TEAM","LOCATION","OTHER"]).default("DEPARTMENT")});
const Person=z.object({name:z.string().min(2),email:z.string().email(),employeeCode:z.string().optional().or(z.literal("")),jobTitle:z.string().optional().or(z.literal("")),unitId:z.string().optional().nullable(),locale:z.enum(["es","en"]).default("es"),attributes:z.record(z.string(),z.string()).optional().default({})});
const Import=z.object({rows:z.array(Person).min(1).max(1000)});
const Audience=z.object({all:z.boolean().default(false),unitIds:z.array(z.string()).default([]),personIds:z.array(z.string()).default([]),excludePersonIds:z.array(z.string()).default([])});
const Recipient=z.object({displayName:z.string().min(2),email:z.string().email(),roleLabel:z.string().optional().or(z.literal("")),locale:z.enum(["es","en"]).default("es")});
const privilegedTeamRoles=new Set(["ADMIN","BILLING_ADMIN","OWNER"]);
const Branding=z.object({enabled:z.boolean().optional().default(true),primaryColor:z.string(),backgroundColor:z.string(),surfaceColor:z.string(),textColor:z.string(),logoAltText:z.string().max(180).optional().nullable(),removeLogo:z.boolean().optional().default(false),logo:z.object({fileName:z.string().min(1).max(180),mimeType:z.string(),base64:z.string().min(1).max(1_500_000)}).optional().nullable()});

@Controller("v1/workspace")
@UseGuards(ClientDevAuthGuard)
export class WorkspaceController {
  constructor(@Inject(PrismaService) private db:PrismaService,@Inject(AuditService) private audit:AuditService,@Inject(BrandingService) private branding:BrandingService,@Inject(AuthService) private auth:AuthService){}
  private ctx(req:HeaderRequest){return accessContext(this.db,req)}

  @Get("branding") async getBranding(@Req()req:HeaderRequest){const{organization:org}=await requireCapability(this.db,req,"workspace.read");const branding=await this.branding.get(org.id,true);return{...branding,organization:{id:org.id,name:org.name}}}
  @Post("branding") async saveBranding(@Req()req:HeaderRequest,@Body()b:unknown){const p=Branding.parse(b),{organization:org,identity}=await requireCapability(this.db,req,"branding.manage");return this.branding.update(org.id,identity.email,p)}

  @Get("team") async team(@Req()req:HeaderRequest){const {organization:org,membership:m}=await requireCapability(this.db,req,"team.manage");const[ms,assessments]=await Promise.all([this.db.membership.findMany({where:{organizationId:org.id},include:{user:true,assessmentAccesses:{include:{assessment:true}}},orderBy:{createdAt:"asc"}}),this.db.assessment.findMany({where:{organizationId:org.id,status:{not:"ARCHIVED"}},select:{id:true,title:true,status:true},orderBy:{updatedAt:"desc"}})]);return{organization:{id:org.id,name:org.name},currentRole:m.role,currentMembershipId:m.id,assignableAssessments:assessments,members:ms.map(x=>({id:x.id,name:x.user.displayName,email:x.user.email,role:x.role,locale:x.user.locale,accountStatus:x.user.accountStatus,emailVerifiedAt:x.user.emailVerifiedAt,isOwner:x.role==="OWNER",capabilities:roleCapabilities[x.role]??[],assessmentAccesses:x.assessmentAccesses.map(g=>({id:g.assessmentId,title:g.assessment.title}))})),roles:Object.entries(roleCapabilities).filter(([role])=>role!=="PARTNER_ADMIN").map(([role,capabilities])=>({role,capabilities}))}}
  private ensureTeamChange(actor:{role:string;user:{id:string}},targetRole:string|undefined,targetUserId:string|undefined,nextRole?:string){
    if(targetUserId===actor.user.id)throw new ForbiddenException("Cannot modify your own organization membership");
    if(targetRole==="OWNER")throw new ForbiddenException("Owner membership is protected");
    if(actor.role!=="OWNER" && (privilegedTeamRoles.has(targetRole??"") || privilegedTeamRoles.has(nextRole??"")))
      throw new ForbiddenException("Only the owner can manage administrator or billing roles");
  }
  @Post("team/invite") async invite(@Req()req:HeaderRequest,@Body()b:unknown){
    const p=Invite.parse(b),ctx=await requireCapability(this.db,req,"team.manage"),{identity,organization:org}=ctx,email=p.email.trim().toLowerCase();
    this.ensureTeamChange(ctx,undefined,undefined,p.role);
    const previous=await this.db.user.findUnique({where:{email},select:{id:true,email:true,locale:true,passwordHash:true,accountStatus:true}});
    if(previous){
      const existing=await this.db.membership.findUnique({where:{organizationId_userId:{organizationId:org.id,userId:previous.id}}});
      if(existing){
        this.ensureTeamChange(ctx,existing.role,previous.id,p.role);
        if(existing.role!==p.role||Boolean(previous.passwordHash)&&previous.accountStatus==="ACTIVE")
          throw new ConflictException("Member already belongs to this organization; use role management");
        const activation=await this.auth.createActivation(previous.id,previous.email,previous.locale);
        await this.audit.record({organizationId:org.id,actorType:"USER",actorId:identity.email,action:"MEMBER_ACTIVATION_REISSUED",targetType:"Membership",targetId:existing.id,metadata:{role:existing.role}});
        return{ok:true,activationRequired:true,resent:true,activationUrl:process.env.NODE_ENV==="production"?undefined:activation.activationUrl};
      }
    }
    const {user:u,membership:x}=await this.db.$transaction(async tx=>{
      const user=await tx.user.upsert({where:{email},update:{},create:{email,displayName:p.displayName,locale:"es",accountStatus:"PENDING_VERIFICATION"}});
      const membership=await tx.membership.create({data:{organizationId:org.id,userId:user.id,role:p.role}});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"MEMBER_INVITED",targetType:"Membership",targetId:membership.id,metadata:{role:p.role}}});
      return{user,membership};
    });
    let activationUrl:string|undefined;
    if(!u.passwordHash||u.accountStatus!=="ACTIVE"){
      const activation=await this.auth.createActivation(u.id,u.email,u.locale);
      activationUrl=activation.activationUrl;
    }
    return{ok:true,activationRequired:Boolean(activationUrl),activationUrl:process.env.NODE_ENV==="production"?undefined:activationUrl};
  }
  @Post("team/:mid/role") async role(@Req()req:HeaderRequest,@Param("mid")mid:string,@Body()b:unknown){
    const p=Role.parse(b),ctx=await requireCapability(this.db,req,"team.manage"),{organization:org,identity}=ctx;
    const member=await this.db.membership.findFirst({where:{id:mid,organizationId:org.id}});
    if(!member)throw new NotFoundException("Membership not found");
    this.ensureTeamChange(ctx,member.role,member.userId,p.role);
    if(member.role===p.role)return{ok:true,unchanged:true};
    await this.db.$transaction(async tx=>{
      const changed=await tx.membership.updateMany({where:{id:mid,organizationId:org.id,role:member.role},data:{role:p.role}});
      if(changed.count!==1)throw new ConflictException("Membership changed concurrently; refresh and retry");
      await tx.assessmentAccess.deleteMany({where:{membershipId:mid}});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"WORKSPACE_MEMBER_ROLE_CHANGED",targetType:"Membership",targetId:mid,metadata:{previousRole:member.role,newRole:p.role}}});
    });
    return{ok:true};
  }
  @Post("team/:mid/remove") async remove(@Req()req:HeaderRequest,@Param("mid")mid:string){
    const ctx=await requireCapability(this.db,req,"team.manage"),{organization:org,identity}=ctx;
    const member=await this.db.membership.findFirst({where:{id:mid,organizationId:org.id}});
    if(!member)throw new NotFoundException("Membership not found");
    this.ensureTeamChange(ctx,member.role,member.userId);
    await this.db.$transaction(async tx=>{
      const deleted=await tx.membership.deleteMany({where:{id:mid,organizationId:org.id,role:member.role}});
      if(deleted.count!==1)throw new ConflictException("Membership changed concurrently; refresh and retry");
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"WORKSPACE_MEMBER_REMOVED",targetType:"Membership",targetId:mid,metadata:{previousRole:member.role}}});
    });
    return{ok:true};
  }
  @Post("team/:mid/assessment-access") async assessmentAccess(@Req()req:HeaderRequest,@Param("mid")mid:string,@Body()b:unknown){
    const p=AccessScope.parse(b),ctx=await requireCapability(this.db,req,"team.manage"),{organization:org,identity}=ctx;
    const member=await this.db.membership.findFirst({where:{id:mid,organizationId:org.id}});
    if(!member)throw new NotFoundException("Membership not found");
    this.ensureTeamChange(ctx,member.role,member.userId);
    if(!["REVIEWER","ANALYST","VIEWER"].includes(member.role))throw new BadRequestException("Assessment-scoped access only applies to Reviewer, Analyst and Viewer");
    const requested=[...new Set(p.assessmentIds)];
    const valid=await this.db.assessment.findMany({where:{organizationId:org.id,id:{in:requested}},select:{id:true}});
    if(valid.length!==requested.length)throw new BadRequestException("Assessment outside the organization or not found");
    await this.db.$transaction(async tx=>{
      const current=await tx.membership.findFirst({where:{id:mid,organizationId:org.id,role:member.role}});
      if(!current)throw new ConflictException("Membership changed concurrently; refresh and retry");
      await tx.assessmentAccess.deleteMany({where:{membershipId:mid}});
      if(valid.length)await tx.assessmentAccess.createMany({data:valid.map(a=>({membershipId:mid,assessmentId:a.id}))});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"ASSESSMENT_ACCESS_UPDATED",targetType:"Membership",targetId:mid,metadata:{assessmentIds:valid.map(a=>a.id)}}});
    });
    return{ok:true,count:valid.length};
  }

  private fw(f:any){const v=f.versions?.[0];return{id:f.id,slug:f.slug,name:f.name,origin:f.origin,publisher:f.publisher,description:f.description,category:f.category,tags:f.tags??[],useCases:f.useCases??[],audience:f.audience??[],durationMin:f.durationMin,latestVersion:v?{id:v.id,version:v.version,objective:v.objective,dimensions:v.dimensions,license:v.license,editable:v.editable,methodology:v.methodology,recommendedPopulation:v.recommendedPopulation,questionBlueprint:v.questionBlueprint??[],scoring:v.scoring}:null}}
  @Get("frameworks") async frameworks(@Req()req:HeaderRequest,@Query("q")q?:string,@Query("category")category?:string){await requireCapability(this.db,req,"assessment.edit");const rows=await this.db.framework.findMany({where:category&&category!=="ALL"?{category}:{},include:{versions:{orderBy:{publishedAt:"desc"},take:1}},orderBy:{name:"asc"}}),n=(q??"").toLowerCase();return rows.map(x=>this.fw(x)).filter((x:any)=>!n||`${x.name} ${x.description} ${x.category} ${(x.tags??[]).join(" ")} ${x.latestVersion?.objective??""}`.toLowerCase().includes(n))}
  @Get("frameworks/recommend") async rec(@Req()req:HeaderRequest,@Query("q")q?:string){await requireCapability(this.db,req,"assessment.edit");const n=(q??"").trim().toLowerCase();if(n.length<3)return{results:[]};const tokens=new Set(n.normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/[^a-z0-9]+/).filter(x=>x.length>2)),rows=await this.db.framework.findMany({include:{versions:{orderBy:{publishedAt:"desc"},take:1}}});return{engine:"bounded-affinity-v1",results:rows.map(x=>{const d:any=this.fw(x),h=`${d.name} ${d.description} ${d.category} ${(d.tags??[]).join(" ")} ${d.latestVersion?.objective??""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");let score=0;for(const t of tokens)if(h.includes(t))score++;return{...d,score,reason:score>=3?"Coincidencia directa con varios elementos del objetivo":score>=1?"Comparte temas relevantes con la búsqueda":"Puede complementar el diagnóstico"}}).sort((a,b)=>b.score-a.score).slice(0,5)}}
  @Get("frameworks/:id") async fwone(@Req()req:HeaderRequest,@Param("id")id:string){await requireCapability(this.db,req,"assessment.edit");const f=await this.db.framework.findUnique({where:{id},include:{versions:{orderBy:{publishedAt:"desc"},take:1}}});if(!f)throw new NotFoundException();return this.fw(f)}
  @Post("frameworks/:id/start") async start(@Req()req:HeaderRequest,@Param("id")id:string,@Body()b:unknown){
    const {level}=z.object({level:z.enum(["L1","L2","L3","L4"]).default("L2")}).parse(b??{});
    const {organization:org,identity}=await requireCapability(this.db,req,"assessment.edit");
    const f=await this.db.framework.findUnique({where:{id},include:{versions:{orderBy:{publishedAt:"desc"},take:1}}});
    const v=f?.versions[0];
    if(!f||!v)throw new NotFoundException("Framework version not found");
    const bp=Array.isArray(v.questionBlueprint)?v.questionBlueprint as any[]:[];
    if(!bp.length)throw new BadRequestException("Framework has no question blueprint");
    const title=`${f.name} ${new Date().getFullYear()}`;
    const a=await this.db.$transaction(async tx=>{
      const created=await tx.assessment.create({data:{organizationId:org.id,frameworkVersionId:v.id,title,objective:v.objective,level,status:"PREPARATION",locale:"es"}});
      await tx.assessmentTranslation.create({data:{assessmentId:created.id,locale:"es",title,objective:v.objective}});
      for(let i=0;i<bp.length;i++){
        const q=bp[i]??{};
        const prompt=String(q.prompt??"").trim();
        if(prompt.length<5)throw new BadRequestException(`Framework question ${i+1} is invalid`);
        const question=await tx.question.create({data:{assessmentId:created.id,order:i+1,prompt,type:(q.type??"LIKERT") as any,dimension:q.dimension?String(q.dimension):null,required:q.required!==false,weight:Number(q.weight??1),config:(q.config??null) as any}});
        await tx.questionTranslation.create({data:{questionId:question.id,locale:"es",prompt}});
      }
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"ASSESSMENT_CREATED_FROM_FRAMEWORK",targetType:"Assessment",targetId:created.id,metadata:{frameworkId:f.id,frameworkVersionId:v.id,questionCount:bp.length,level}}});
      return created;
    });
    return{ok:true,assessmentId:a.id,questionCount:bp.length,status:a.status,level:a.level};
  }
  @Post("assessments") async create(@Req()req:HeaderRequest,@Body()b:unknown){
    const p=Create.parse(b),{organization:org,identity}=await requireCapability(this.db,req,"assessment.edit");
    const a=await this.db.$transaction(async tx=>{
      const created=await tx.assessment.create({data:{organizationId:org.id,title:p.title,objective:p.objective,level:p.level,status:"DRAFT",locale:p.locale}});
      await tx.assessmentTranslation.create({data:{assessmentId:created.id,locale:p.locale,title:p.title,objective:p.objective}});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"ASSESSMENT_CREATED_MANUALLY",targetType:"Assessment",targetId:created.id,metadata:{level:p.level,locale:p.locale}}});
      return created;
    });
    return{ok:true,assessmentId:a.id,status:a.status,level:a.level};
  }


  private directoryPersonDto(p:any){return{id:p.id,name:decryptText(p.displayNameEncrypted),email:decryptText(p.emailEncrypted),employeeCode:p.employeeCode,jobTitle:p.jobTitleEncrypted?decryptText(p.jobTitleEncrypted):null,locale:p.locale,attributes:p.attributes,unit:p.unit?{id:p.unit.id,name:p.unit.name,type:p.unit.type}:null}}
  private async directoryUnits(orgId:string){const units=await this.db.organizationUnit.findMany({where:{organizationId:orgId},include:{_count:{select:{people:{where:{status:"ACTIVE"}}}}},orderBy:[{name:"asc"},{id:"asc"}]});return units.map(u=>({id:u.id,name:u.name,code:u.code,type:u.type,people:u._count.people}))}
  private async ensureDirectorySearchIndex(orgId:string){const stale=await this.db.directoryPerson.findMany({where:{organizationId:orgId,status:"ACTIVE",searchIndexVersion:{lt:DIRECTORY_SEARCH_INDEX_VERSION}},select:{id:true,displayNameEncrypted:true,emailEncrypted:true,jobTitleEncrypted:true,employeeCode:true},take:1000,orderBy:{createdAt:"asc"}});for(let i=0;i<stale.length;i+=100){const batch=stale.slice(i,i+100);await Promise.all(batch.map(person=>this.db.directoryPerson.update({where:{id:person.id},data:{searchTokens:buildDirectorySearchIndex({name:decryptText(person.displayNameEncrypted),email:decryptText(person.emailEncrypted),jobTitle:person.jobTitleEncrypted?decryptText(person.jobTitleEncrypted):null,employeeCode:person.employeeCode}),searchIndexVersion:DIRECTORY_SEARCH_INDEX_VERSION}})))}}
  @Get("directory/meta") async dirMeta(@Req()req:HeaderRequest){const{organization:org}=await requireCapability(this.db,req,"directory.manage");const[units,totalActive]=await Promise.all([this.directoryUnits(org.id),this.db.directoryPerson.count({where:{organizationId:org.id,status:"ACTIVE"}})]);return{organization:{id:org.id,name:org.name},units,totalActive}}
  @Get("directory/table") async dirTable(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("unitId")unitId?:string){const{organization:org}=await requireCapability(this.db,req,"directory.manage"),pg=parsePagination({page,pageSize}),search=(q??"").trim();if(search.length>=2)await this.ensureDirectorySearchIndex(org.id);const searchTokens=search.length>=2?directorySearchQueryTokens(search):[];const where:any={organizationId:org.id,status:"ACTIVE",...(unitId&&unitId!=="ALL"?{unitId}:{})};if(search){const OR:any[]=[];if(searchTokens.length)OR.push({searchTokens:{hasEvery:searchTokens}});OR.push({employeeCode:{contains:search,mode:"insensitive"}},{unit:{name:{contains:search,mode:"insensitive"}}});where.OR=OR}const[units,totalActive,total,people]=await Promise.all([this.directoryUnits(org.id),this.db.directoryPerson.count({where:{organizationId:org.id,status:"ACTIVE"}}),this.db.directoryPerson.count({where}),this.db.directoryPerson.findMany({where,skip:pg.skip,take:pg.take,include:{unit:true},orderBy:[{createdAt:"asc"},{id:"asc"}]})]);return{organization:{id:org.id,name:org.name},units,totalActive,...paged(people.map(p=>this.directoryPersonDto(p)),total,pg.page,pg.pageSize)}}
  @Get("directory") async dir(@Req()req:HeaderRequest){const{organization:org}=await requireCapability(this.db,req,"directory.manage"),[units,people]=await Promise.all([this.directoryUnits(org.id),this.db.directoryPerson.findMany({where:{organizationId:org.id,status:"ACTIVE"},include:{unit:true},orderBy:[{createdAt:"asc"},{id:"asc"}]})]);return{organization:{id:org.id,name:org.name},units,people:people.map(p=>this.directoryPersonDto(p)),total:people.length}}
  @Post("directory/units") async unit(@Req()req:HeaderRequest,@Body()b:unknown){const p=Unit.parse(b),{organization:org}=await requireCapability(this.db,req,"directory.manage"),u=await this.db.organizationUnit.create({data:{organizationId:org.id,name:p.name,code:p.code||null,type:p.type}});return{ok:true,unit:u}}
  private pdata(org:string,p:any){return{organizationId:org,displayNameEncrypted:encryptText(p.name),emailEncrypted:encryptText(p.email),emailLookup:blindIndex(p.email),unitId:p.unitId||null,jobTitleEncrypted:p.jobTitle?encryptText(p.jobTitle):null,employeeCode:p.employeeCode||null,searchTokens:buildDirectorySearchIndex({name:p.name,email:p.email,jobTitle:p.jobTitle||null,employeeCode:p.employeeCode||null}),searchIndexVersion:DIRECTORY_SEARCH_INDEX_VERSION,locale:p.locale,attributes:p.attributes as any,status:"ACTIVE" as const}}
  private async ensureTenantDirectoryReferences(orgId:string,unitIds:string[],personIds:string[]=[]){
    const uniqueUnits=[...new Set(unitIds.filter(Boolean))],uniquePeople=[...new Set(personIds.filter(Boolean))];
    const [units,people]=await Promise.all([
      uniqueUnits.length?this.db.organizationUnit.count({where:{organizationId:orgId,id:{in:uniqueUnits}}}):Promise.resolve(0),
      uniquePeople.length?this.db.directoryPerson.count({where:{organizationId:orgId,status:"ACTIVE",id:{in:uniquePeople}}}):Promise.resolve(0)
    ]);
    if(units!==uniqueUnits.length||people!==uniquePeople.length)throw new BadRequestException("Directory references must belong to this organization");
  }
  @Post("directory/people") async person(@Req()req:HeaderRequest,@Body()b:unknown){
    const p=Person.parse(b),{organization:org}=await requireCapability(this.db,req,"directory.manage");
    await this.ensureTenantDirectoryReferences(org.id,p.unitId?[p.unitId]:[]);
    const d=this.pdata(org.id,p),x=await this.db.directoryPerson.upsert({where:{organizationId_emailLookup:{organizationId:org.id,emailLookup:d.emailLookup}},update:d,create:d});
    return{ok:true,id:x.id};
  }
  @Post("directory/import") async importer(@Req()req:HeaderRequest,@Body()b:unknown){
    const p=Import.parse(b),{organization:org,identity}=await requireCapability(this.db,req,"directory.manage");
    await this.ensureTenantDirectoryReferences(org.id,p.rows.map(row=>row.unitId??""));
    const rows=p.rows.map(row=>this.pdata(org.id,row));
    await this.db.$transaction(async tx=>{
      for(const data of rows)await tx.directoryPerson.upsert({where:{organizationId_emailLookup:{organizationId:org.id,emailLookup:data.emailLookup}},update:data,create:data});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"WORKSPACE_DIRECTORY_IMPORTED",targetType:"Organization",targetId:org.id,metadata:{processed:rows.length}}});
    },{timeout:60000});
    return{ok:true,imported:rows.length};
  }

  private async resolved(id:string,org:string){const t=await this.db.assessmentAudienceTarget.findMany({where:{assessmentId:id}}),all=t.some(x=>x.type==="ALL"),units=t.filter(x=>x.type==="UNIT"&&x.unitId).map(x=>x.unitId!),ids=t.filter(x=>x.type==="PERSON"&&x.personId).map(x=>x.personId!),ex=new Set(t.filter(x=>x.type==="EXCLUDE_PERSON"&&x.personId).map(x=>x.personId!)),OR:any[]=[];if(units.length)OR.push({unitId:{in:units}});if(ids.length)OR.push({id:{in:ids}});if(!all&&!OR.length)return[];return(await this.db.directoryPerson.findMany({where:{organizationId:org,status:"ACTIVE",...(all?{}:{OR})},include:{unit:true}})).filter(x=>!ex.has(x.id))}
  @Get("assessments/:id/population")
  async pop(@Req() req: HeaderRequest, @Param("id") id: string) {
    const { organization: org } = await requireCapability(this.db, req, "population.prepare", id);
    const a = await this.db.assessment.findUniqueOrThrow({ where: { id } });
    const targets = await this.db.assessmentAudienceTarget.findMany({ where: { assessmentId: id } });
    const locked = !["DRAFT", "PREPARATION", "REVIEW"].includes(a.status);
    const frozen = Boolean(a.launchedAt) || ["ACTIVE", "CLOSED", "ARCHIVED"].includes(a.status);

    if (frozen) {
      const participants = await this.db.participant.findMany({
        where: { assessmentId: id },
        include: { identity: true },
        orderBy: { createdAt: "asc" },
      });
      const people = participants.slice(0, 30).map((participant) => {
        const segments = participant.segmentSnapshot && typeof participant.segmentSnapshot === "object"
          ? participant.segmentSnapshot as Record<string, unknown>
          : {};
        return {
          id: participant.id,
          name: a.privacyMode === "ANONYMOUS"
            ? participant.pseudonym
            : participant.identity?.nameEncrypted
              ? decryptText(participant.identity.nameEncrypted)
              : participant.pseudonym,
          email: a.privacyMode === "ANONYMOUS" || !participant.identity ? null : decryptText(participant.identity.emailEncrypted),
          unit: typeof segments.department === "string" ? segments.department : null,
          locale: participant.locale,
          segments,
        };
      });
      return {
        targets,
        resolvedCount: participants.length,
        locked,
        frozen: true,
        lockedAt: a.launchedAt,
        status: a.status,
        privacyMode: a.privacyMode,
        people,
      };
    }

    const people = await this.resolved(id, org.id);
    return {
      targets,
      resolvedCount: people.length,
      locked,
      frozen: false,
      lockedAt: null,
      status: a.status,
      privacyMode: a.privacyMode,
      people: people.slice(0, 30).map((person) => ({
        id: person.id,
        name: decryptText(person.displayNameEncrypted),
        email: decryptText(person.emailEncrypted),
        unit: person.unit?.name ?? null,
        locale: person.locale,
        segments: person.attributes ?? {},
      })),
    };
  }

  @Post("assessments/:id/population/preview") async previewPopulation(@Req()req:HeaderRequest,@Param("id")id:string,@Body()b:unknown){
    const p=Audience.parse(b),{organization:org}=await requireCapability(this.db,req,"population.prepare",id);
    await this.ensureTenantDirectoryReferences(org.id,p.unitIds,[...p.personIds,...p.excludePersonIds]);
    const OR:any[]=[];
    if(p.unitIds.length)OR.push({unitId:{in:p.unitIds}});
    if(p.personIds.length)OR.push({id:{in:p.personIds}});
    const where:any={organizationId:org.id,status:"ACTIVE",...(p.all?{}:(OR.length?{OR}:{id:{in:[]}}))};
    const selected=await this.db.directoryPerson.findMany({where,select:{id:true}}),excluded=new Set(p.excludePersonIds);
    return{resolvedCount:selected.reduce((count,row)=>count+(excluded.has(row.id)?0:1),0)};
  }
  @Post("assessments/:id/population") async setpop(@Req()req:HeaderRequest,@Param("id")id:string,@Body()b:unknown){
    const p=Audience.parse(b),{organization:org,identity}=await requireCapability(this.db,req,"population.prepare",id);
    await this.ensureTenantDirectoryReferences(org.id,p.unitIds,[...p.personIds,...p.excludePersonIds]);
    const rows:any[]=[];
    if(p.all)rows.push({assessmentId:id,type:"ALL"});
    p.unitIds.forEach(unitId=>rows.push({assessmentId:id,type:"UNIT",unitId}));
    p.personIds.forEach(personId=>rows.push({assessmentId:id,type:"PERSON",personId}));
    p.excludePersonIds.forEach(personId=>rows.push({assessmentId:id,type:"EXCLUDE_PERSON",personId}));
    await this.db.$transaction(async tx=>{
      const a=await tx.assessment.findFirst({where:{id,organizationId:org.id}});
      if(!a||a.launchedAt||!["DRAFT","PREPARATION","REVIEW"].includes(a.status))throw new BadRequestException("Population is locked for this assessment status");
      await tx.assessmentAudienceTarget.deleteMany({where:{assessmentId:id}});
      if(rows.length)await tx.assessmentAudienceTarget.createMany({data:rows});
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"ASSESSMENT_POPULATION_UPDATED",targetType:"Assessment",targetId:id,metadata:{targetCount:rows.length}}});
    });
    return{ok:true,resolvedCount:(await this.resolved(id,org.id)).length};
  }

  @Get("assessments/:id/result-recipients") async recipients(@Req()req:HeaderRequest,@Param("id")id:string){await requireCapability(this.db,req,"assessment.edit",id);const rows=await this.db.resultRecipient.findMany({where:{assessmentId:id,active:true}});return rows.map(r=>({id:r.id,displayName:r.displayName,email:decryptText(r.emailEncrypted),roleLabel:r.roleLabel,locale:r.locale}))}
  @Post("assessments/:id/result-recipients") async addrec(@Req()req:HeaderRequest,@Param("id")id:string,@Body()b:unknown){await requireCapability(this.db,req,"assessment.edit",id);const p=Recipient.parse(b),r=await this.db.resultRecipient.upsert({where:{assessmentId_emailLookup:{assessmentId:id,emailLookup:blindIndex(p.email)}},update:{displayName:p.displayName,emailEncrypted:encryptText(p.email),roleLabel:p.roleLabel||null,locale:p.locale,active:true},create:{assessmentId:id,displayName:p.displayName,emailEncrypted:encryptText(p.email),emailLookup:blindIndex(p.email),roleLabel:p.roleLabel||null,locale:p.locale}});return{ok:true,id:r.id}}
  @Post("assessments/:id/result-recipients/:rid/remove") async rmrec(@Req()req:HeaderRequest,@Param("id")id:string,@Param("rid")rid:string){
    const{organization:org,identity}=await requireCapability(this.db,req,"assessment.edit",id);
    await this.db.$transaction(async tx=>{
      const result=await tx.resultRecipient.updateMany({where:{id:rid,assessmentId:id,active:true},data:{active:false}});
      if(result.count!==1)throw new NotFoundException("Active recipient not found in this assessment");
      await tx.auditEvent.create({data:{organizationId:org.id,actorType:"USER",actorId:identity.email,action:"ASSESSMENT_RESULT_RECIPIENT_REMOVED",targetType:"ResultRecipient",targetId:rid,metadata:{assessmentId:id}}});
    });
    return{ok:true};
  }

  @Get("billing") async billing(@Req()req:HeaderRequest){const{organization:org}=await requireCapability(this.db,req,"billing.view");const[sub,docs]=await Promise.all([this.db.subscription.findFirst({where:{organizationId:org.id},include:{plan:true},orderBy:{createdAt:"desc"}}),this.db.documentRecord.findMany({where:{organizationId:org.id,recordClass:{in:["ACCOUNTING_INVOICE","CONTRACT","DPA"]}},orderBy:{createdAt:"desc"}})]);return{visible:true,subscription:sub,documents:docs,capacity:await this.capacity(org.id)}}
  @Get("billing/usage/table") async billingUsageTable(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("period")period?:string,@Query("eventType")eventType?:string,@Query("billable")billable?:string){
    const{organization:org}=await requireCapability(this.db,req,"billing.view"),pg=parsePagination({page,pageSize});
    let where: ReturnType<typeof workspaceUsageWhere>;
    try { where=workspaceUsageWhere(org.id,{period,eventType,billable}); }
    catch(error) { throw new BadRequestException((error as Error).message); }
    const[total,items]=await Promise.all([this.db.usageEvent.count({where}),this.db.usageEvent.findMany({where,skip:pg.skip,take:pg.take,orderBy:[{occurredAt:"desc"},{id:"asc"}]})]);
    return paged(items,total,pg.page,pg.pageSize);
  }
  private async capacity(org:string){const e=await this.db.entitlement.findMany({where:{organizationId:org}}),period=new Date().toISOString().slice(0,7),used=await this.db.usageEvent.aggregate({where:{organizationId:org,periodKey:period,eventType:"RESPONSE_COMPLETED",billable:true},_sum:{quantity:true}});return{period,used:used._sum.quantity??0,entitlements:Object.fromEntries(e.map(x=>[x.key,x.value]))}}


  @Get("reports/table") async reportsTable(@Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,@Query("q")q?:string,@Query("status")status?:string){const {ctx,ids,unrestricted}=await permittedAssessmentIds(this.db,req);if(!(ctx.capabilities.includes("results.read")||ctx.capabilities.includes("results.authorized_read")))throw new BadRequestException("Results access required");const pg=parsePagination({page,pageSize}),search=(q??"").trim();const where:any={assessment:{organizationId:ctx.organization.id,...(unrestricted?{}:{id:{in:ids}})}};if(search)where.assessment={...where.assessment,title:{contains:search,mode:"insensitive"}};if(status)where.status=status;const[total,items]=await Promise.all([this.db.report.count({where}),this.db.report.findMany({where,skip:pg.skip,take:pg.take,include:{assessment:true,deliveries:{include:{recipient:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}]})]);return paged(items,total,pg.page,pg.pageSize)}

  // WS-3: one report, tenant-scoped and grant-scoped. Do not load every report to view one.
  @Get("reports/:id") async reportDetail(@Req()req:HeaderRequest,@Param("id")id:string){
    const {ctx,ids,unrestricted}=await permittedAssessmentIds(this.db,req);
    if(!(ctx.capabilities.includes("results.read")||ctx.capabilities.includes("results.authorized_read")))throw new ForbiddenException("Results access required");
    const report=await this.db.report.findFirst({
      where:{id,assessment:{organizationId:ctx.organization.id,...(unrestricted?{}:{id:{in:ids}})}},
      select:{id:true,kind:true,status:true,version:true,snapshot:true,snapshotHash:true,approvedAt:true,distributedAt:true,createdAt:true,
        assessment:{select:{id:true,title:true}},
        deliveries:{orderBy:{createdAt:"asc"},select:{id:true,status:true,channel:true,sentAt:true,recipient:{select:{displayName:true,roleLabel:true}}}}}
    });
    if(!report)throw new NotFoundException("Report not found");
    return report;
  }
  @Get("reports") async reports(@Req()req:HeaderRequest){const {ctx,ids,unrestricted}=await permittedAssessmentIds(this.db,req);if(!(ctx.capabilities.includes("results.read")||ctx.capabilities.includes("results.authorized_read")))throw new BadRequestException("Results access required");return this.db.report.findMany({where:{assessment:{organizationId:ctx.organization.id,...(unrestricted?{}:{id:{in:ids}})}},include:{assessment:true,deliveries:{include:{recipient:true}}},orderBy:{createdAt:"desc"}})}
  // WS-4B: tenant-scoped privacy list; the existing legal summary endpoint remains backward compatible.
  @Get("legal/assessments/table") async legalAssessmentsTable(
    @Req()req:HeaderRequest,@Query("page")page?:string,@Query("pageSize")pageSize?:string,
    @Query("q")q?:string,@Query("status")status?:string,
  ){
    const {organization:org}=await requireCapability(this.db,req,"legal.manage");
    const pg=parsePagination({page,pageSize});
    const search=(q??"").trim().slice(0,120);
    const allowed=["DRAFT","PREPARATION","REVIEW","READY","ACTIVE","CLOSED","ARCHIVED"];
    const where:any={organizationId:org.id};
    if(search)where.title={contains:search,mode:"insensitive"};
    if(status&&allowed.includes(status))where.status=status;
    const [total,approvedCount,items]=await Promise.all([
      this.db.assessment.count({where}),
      this.db.assessment.count({where:{organizationId:org.id,legalProfile:{is:{approvedAt:{not:null}}}}}),
      this.db.assessment.findMany({where,skip:pg.skip,take:pg.take,
        select:{id:true,title:true,status:true,privacyMode:true,minCohortSize:true,
          legalProfile:{select:{approvedAt:true,retentionDays:true}},
          resultRecipients:{where:{active:true},select:{id:true}}},
        orderBy:[{updatedAt:"desc"},{id:"asc"}]}),
    ]);
    return {...paged(items.map(a=>({id:a.id,title:a.title,status:a.status,privacyMode:a.privacyMode,
      minCohortSize:a.minCohortSize,legalProfile:a.legalProfile,resultRecipients:a.resultRecipients.length})),total,pg.page,pg.pageSize),approvedCount};
  }

  @Get("legal") async legal(@Req()req:HeaderRequest,@Query("locale")l?:string,@Query("assessments")assessmentsMode?:string){const{organization:org}=await requireCapability(this.db,req,"legal.manage"),locale=l==="en"?"en":"es";const[documents,assessments,policies,holds]=await Promise.all([this.db.legalDocument.findMany({include:{versions:{where:{active:true},orderBy:{effectiveAt:"desc"}}}}),(assessmentsMode==="none"?Promise.resolve([]):this.db.assessment.findMany({where:{organizationId:org.id},include:{legalProfile:true,participantNotices:{where:{active:true}},resultRecipients:{where:{active:true}}},orderBy:{updatedAt:"desc"}})),this.db.retentionPolicy.findMany({where:{organizationId:org.id},orderBy:{recordClass:"asc"}}),this.db.legalHold.findMany({where:{organizationId:org.id,status:"ACTIVE"}})]);return{organization:{id:org.id,name:org.name},documents:documents.map(d=>({key:d.key,scope:d.scope,description:d.description,version:d.versions.find(v=>v.locale===locale)??d.versions[0]??null})),assessments:assessments.map(a=>({id:a.id,title:a.title,status:a.status,privacyMode:a.privacyMode,minCohortSize:a.minCohortSize,legalProfile:a.legalProfile,activeNotice:a.participantNotices.find(n=>n.locale===locale)??a.participantNotices[0]??null,resultRecipients:a.resultRecipients.length})),retentionPolicies:policies,legalHolds:holds}}
}
