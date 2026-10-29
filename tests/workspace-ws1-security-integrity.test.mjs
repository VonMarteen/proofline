import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const classes={};
for(const name of ['ForbiddenException','BadRequestException','NotFoundException','ConflictException']) classes[name]=class extends Error{constructor(m){super(m);this.name=name;}};
const decorated=()=>()=>{};
const nest={...classes,Controller:decorated,UseGuards:decorated,Get:decorated,Post:decorated,Inject:decorated,Req:decorated,Body:decorated,Param:decorated,Query:decorated};
function schema(){const obj={parse:x=>x,optional:()=>obj,default:()=>obj,min:()=>obj,max:()=>obj,email:()=>obj,nullable:()=>obj,or:()=>obj};return obj;}
const z=new Proxy({},{get:()=>()=>schema()});
const ctx=(role='OWNER')=>({role,organization:{id:'orgA'},identity:{email:'actor@acme.test'},user:{id:'uActor'},membership:{id:'mActor'},capabilities:['team.manage']});
let active=ctx();
const mocks={
 '@nestjs/common':nest,zod:{z},'./auth/access-control.js':{requireCapability:async(_db,_req,_cap,assessmentId)=>{
  if(assessmentId==='outside')throw new classes.NotFoundException('No such assessment');return active;},accessContext:async()=>active,permittedAssessmentIds:async()=>({}),roleCapabilities:{}},
 './auth/dev-auth.js':{},'./security/crypto.js':{blindIndex:s=>s.toLowerCase(),encryptText:s=>s,decryptText:s=>s},
 './security/directory-search.js':{buildDirectorySearchIndex:()=>[],DIRECTORY_SEARCH_INDEX_VERSION:1,directorySearchQueryTokens:()=>[]},
 './common/pagination.js':{parsePagination:()=>({}),paged:()=>({})}
};
function load(file){const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;const m={exports:{}};vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Promise,Map,Set,Date,Array,console,process:{env:{NODE_ENV:'test'}}},{filename:file})(id=>mocks[id]??{},m,m.exports);return m.exports;}
const WorkspaceController=load('apps/api/src/workspace.controller.ts').WorkspaceController;
const req={headers:{}};
function ctrl(db,audit={record:async()=>{}},auth={createActivation:async()=>({activationUrl:'test'})}){return new WorkspaceController(db,audit,{},auth);}
function transactional(db,perform){db.$transaction=async callback=>perform?perform(callback):callback(db);return db;}
test('WS-1: localized assessment status uses canonical API codes',()=>{
 const page=read('apps/web/app/[locale]/assessments/page.tsx');
 assert.match(page,/<option key=\{x\} value=\{x\}>\{es\?L\[x\]:x\}<\/option>/);
});
test('WS-1: ADMIN cannot invite financial or administrative roles and cannot change existing membership',async()=>{
 active=ctx('ADMIN');let calls=0;
 const db={user:{findUnique:async()=>{calls++;return null}},membership:{findFirst:async()=>({id:'mB',userId:'uB',role:'BILLING_ADMIN'})}};
 const c=ctrl(db);
 await assert.rejects(c.invite(req,{email:'a@test.com',displayName:'Person A',role:'BILLING_ADMIN'}),/Only the owner/);
 await assert.rejects(c.invite(req,{email:'a@test.com',displayName:'Person A',role:'ADMIN'}),/Only the owner/);
 await assert.rejects(c.role(req,'mB',{role:'VIEWER'}),/Only the owner/);
 assert.equal(calls,0);
});
test('WS-1: cannot modify own role, even with OWNER capability',async()=>{
 active=ctx('OWNER');const c=ctrl({membership:{findFirst:async()=>({id:'mActor',userId:'uActor',role:'ADMIN'})}});
 await assert.rejects(c.role(req,'mActor',{role:'VIEWER'}),/your own/);
 await assert.rejects(c.remove(req,'mActor'),/your own/);
});
test('WS-1: duplicate membership invitation does not overwrite role or global name',async()=>{
 active=ctx('OWNER');let writes=0;
 const db={user:{findUnique:async()=>({id:'uOther'}),upsert:async()=>{writes++;}},membership:{findUnique:async()=>({id:'mOther',role:'ADMIN'})}};
 await assert.rejects(ctrl(db).invite(req,{email:'other@test.com',displayName:'Other',role:'VIEWER'}),/already belongs/);
 assert.equal(writes,0);
});
test('WS-1: role changes and audit share one transaction, and authorization stays scoped',async()=>{
 active=ctx('OWNER');const log=[];
 const db=transactional({membership:{findFirst:async()=>({id:'mOther',organizationId:'orgA',userId:'uOther',role:'VIEWER'}),updateMany:async arg=>{log.push(['update',arg]);return{count:1}}},assessmentAccess:{deleteMany:async()=>log.push(['clear'])},auditEvent:{create:async({data})=>log.push(['audit',data])}});
 const result=await ctrl(db).role(req,'mOther',{role:'ANALYST'});
 assert.equal(result.ok,true);assert.deepEqual(log.map(x=>x[0]),['update','clear','audit']);
 assert.equal(log[0][1].where.organizationId,'orgA');assert.equal(log[2][1].metadata.previousRole,'VIEWER');
});
test('WS-1: cross-assessment recipient ID cannot be deactivated',async()=>{
 active=ctx('OWNER');let audited=0;
 const db=transactional({resultRecipient:{updateMany:async({where})=>{assert.equal(where.assessmentId,'assessmentA');return{count:0}}},auditEvent:{create:async()=>audited++}});
 await assert.rejects(ctrl(db).rmrec(req,'assessmentA','recipientFromB'),/not found/);
 assert.equal(audited,0);
});
test('WS-1: valid recipient removal updates only its assessment and audits',async()=>{
 active=ctx('OWNER');const log=[];
 const db=transactional({resultRecipient:{updateMany:async({where})=>{log.push(where);return{count:1}}},auditEvent:{create:async({data})=>log.push(data)}});
 assert.equal((await ctrl(db).rmrec(req,'assessmentA','recipientA')).ok,true);
 assert.equal(log[0].assessmentId,'assessmentA');assert.equal(log[1].action,'ASSESSMENT_RESULT_RECIPIENT_REMOVED');
});
test('WS-1: import validates units before writing and runs imports inside one transaction',async()=>{
 active=ctx('OWNER');let writes=0,txCalls=0;
 const db=transactional({organizationUnit:{count:async()=>0},directoryPerson:{upsert:async()=>{writes++;}},auditEvent:{create:async()=>{}}},async callback=>{txCalls++;return callback(db)});
 const c=ctrl(db),row={name:'Person A',email:'person@test.com',unitId:'foreign'};
 await assert.rejects(c.importer(req,{rows:[row]}),/organization/);
 assert.equal(writes,0);assert.equal(txCalls,0);
 db.organizationUnit.count=async()=>1;
 await c.importer(req,{rows:[row]});assert.equal(txCalls,1);assert.equal(writes,1);
});
test('WS-1: population update validates tenant references and runs deletion, insertion, audit in transaction',async()=>{
 active=ctx('OWNER');let writes=0;const log=[];
 const db=transactional({organizationUnit:{count:async()=>0},directoryPerson:{count:async()=>0},assessment:{findFirst:async()=>({status:'PREPARATION',launchedAt:null})},assessmentAudienceTarget:{deleteMany:async()=>{log.push('delete');writes++},createMany:async()=>{log.push('insert')} ,findMany:async()=>[]},auditEvent:{create:async()=>log.push('audit')}});
 const c=ctrl(db);
 await assert.rejects(c.setpop(req,'assessmentA',{all:false,unitIds:['foreign'],personIds:[],excludePersonIds:[]}),/organization/);
 assert.equal(writes,0);
 db.organizationUnit.count=async()=>1;
 await c.setpop(req,'assessmentA',{all:false,unitIds:['valid'],personIds:[],excludePersonIds:[]});
 assert.deepEqual(log.slice(0,3),['delete','insert','audit']);
});
test('WS-1: population launchedAt protects locked assessments even if status is REVIEW',async()=>{
 active=ctx('OWNER');let writes=0;
 const db=transactional({assessment:{findFirst:async()=>({status:'REVIEW',launchedAt:new Date()})},assessmentAudienceTarget:{deleteMany:async()=>{writes++}}});
 await assert.rejects(ctrl(db).setpop(req,'assessmentA',{all:true,unitIds:[],personIds:[],excludePersonIds:[]}),/locked/);
 assert.equal(writes,0);
});
test('WS-1: interrupted activation may be reissued without changing the existing role',async()=>{
 active=ctx('OWNER');const log=[];
 const db={user:{findUnique:async()=>({id:'uOther',email:'pending@test.com',locale:'en',accountStatus:'PENDING_VERIFICATION',passwordHash:null})},membership:{findUnique:async()=>({id:'mOther',role:'VIEWER'})}};
 const c=ctrl(db,{record:async event=>log.push(event)},{createActivation:async()=>({activationUrl:'local-activation'})});
 const result=await c.invite(req,{email:'pending@test.com',displayName:'Pending Member',role:'VIEWER'});
 assert.equal(result.ok,true);assert.equal(result.resent,true);assert.equal(result.activationRequired,true);
 assert.equal(log[0].action,'MEMBER_ACTIVATION_REISSUED');
});
test('WS-1: ADMIN cannot resend activation for privileged membership',async()=>{
 active=ctx('ADMIN');let sends=0;
 const db={user:{findUnique:async()=>({id:'uOther',email:'admin@test.com',locale:'en',accountStatus:'PENDING_VERIFICATION',passwordHash:null})},membership:{findUnique:async()=>({id:'mAdmin',role:'ADMIN'})}};
 await assert.rejects(ctrl(db,{}, {createActivation:async()=>sends++}).invite(req,{email:'admin@test.com',displayName:'Admin Person',role:'ADMIN'}),/Only the owner/);
 assert.equal(sends,0);
});
test('WS-1: invalid audience person IDs fail before deletion and leave existing population unchanged',async()=>{
 active=ctx('OWNER');let writes=0;
 const db=transactional({directoryPerson:{count:async()=>0},assessmentAudienceTarget:{deleteMany:async()=>writes++}});
 await assert.rejects(ctrl(db).setpop(req,'assessmentA',{all:false,unitIds:[],personIds:['personOtherTenant'],excludePersonIds:[]}),/organization/);
 assert.equal(writes,0);
});
test('WS-1: changing scope refuses foreign assessment IDs instead of silently dropping them',async()=>{
 active=ctx('OWNER');let writes=0;
 const db={membership:{findFirst:async()=>({id:'mOther',role:'VIEWER',userId:'uOther'})},assessment:{findMany:async()=>[{id:'allowed'}]},$transaction:async()=>writes++};
 await assert.rejects(ctrl(db).assessmentAccess(req,'mOther',{assessmentIds:['allowed','outside']}),/outside the organization/);
 assert.equal(writes,0);
});
test('WS-1: English role descriptions are not Spanish and role IDs remain canonical',()=>{
 const ui=read('apps/web/components/team-manager.tsx');
 assert.doesNotMatch(ui,/const roleCopyEn=roleCopyEs/);
 assert.match(ui,/Manages daily operations without financial access/);
 assert.match(ui,/data\.currentMembershipId===m\.id/);
 assert.match(ui,/allowedRoles\.map\(x=>/);
 assert.match(ui,/value=\{x\}/);
});
test('WS-1: changed TS and TSX files parse without syntactic errors',()=>{
 for(const file of ['apps/api/src/workspace.controller.ts','apps/web/components/team-manager.tsx','apps/web/app/[locale]/assessments/page.tsx']){
  const out=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}});
  assert.equal((out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file);
 }
});
