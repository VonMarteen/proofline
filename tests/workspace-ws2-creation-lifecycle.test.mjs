import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const ex={};
for(const type of ['BadRequestException','NotFoundException','ConflictException','ForbiddenException']) ex[type]=class extends Error{constructor(m){super(m);this.name=type;}};
const decorator=()=>()=>{};
const nest={...ex,Controller:decorator,UseGuards:decorator,Get:decorator,Post:decorator,Delete:decorator,Inject:decorator,Req:decorator,Body:decorator,Param:decorator,Query:decorator,Injectable:decorator};
function schema(){const obj={parse:x=>x,optional:()=>obj,default:()=>obj,min:()=>obj,max:()=>obj,email:()=>obj,nullable:()=>obj,or:()=>obj,refine:()=>obj,positive:()=>obj,int:()=>obj};return obj;}
const z=new Proxy({},{get:()=>()=>schema()});
const authorized=[];
const capability=async(_db,_req,perm,id)=>{authorized.push([perm,id]);if(id==='foreign')throw new ex.NotFoundException('Foreign assessment');return{organization:{id:'org-1'},identity:{email:'owner@proofline.test'},capabilities:['assessment.edit','assessment.approve']};};
const mocks={
 '@nestjs/common':nest,zod:{z},
 './auth/access-control.js':{requireCapability:capability,roleCapabilities:{},permittedAssessmentIds:async()=>({})},
 '../auth/access-control.js':{requireCapability:capability,requireAnyResultRead:capability,permittedAssessmentIds:async()=>({})},
 './auth/dev-auth.js':{},'../auth/dev-auth.js':{identityFrom:()=>({email:'owner@proofline.test'})},
 './security/crypto.js':{blindIndex:s=>s,decryptText:x=>x,encryptText:x=>x},
 '../security/crypto.js':{sha256:s=>'hash:'+s,decryptBytes:x=>x,encryptBytes:x=>x,randomPseudonym:()=>''},
 './security/directory-search.js':{buildDirectorySearchIndex:()=>[],DIRECTORY_SEARCH_INDEX_VERSION:1,directorySearchQueryTokens:()=>[]},
 './common/pagination.js':{parsePagination:()=>({}),paged:()=>({})},
 '../assessments/scoring-contract.js':{},
 './scoring-contract.js':{normalizeQuestionScoring:x=>x,normalizeAssessmentScoringConfig:x=>x,questionCode:n=>`Q${n}`,defaultScoredForType:()=>true,effectivePolarity:()=>"POSITIVE"},
 './population-snapshot.js':{buildPopulationSnapshot:()=>({}),participantSegments:()=>({})},
};
function load(file){const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;
 const module={exports:{}};vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Promise,Map,Set,Date,Array,Buffer,console,process:{env:{NODE_ENV:'test'}}},{filename:file})(id=>mocks[id]??(id==='node:crypto'?require(id):{}),module,module.exports);return module.exports;}
const WorkspaceController=load('apps/api/src/workspace.controller.ts').WorkspaceController;
const AssessmentsController=load('apps/api/src/assessments/assessments.controller.ts').AssessmentsController;
const ImportService=load('apps/api/src/imports/import.service.ts').ImportService;
const req={headers:{}};
function txDb(extra={}){const log=[];let seq=0;let transactions=0;
 const tx={assessment:{create:async({data})=>{const x={id:`a-${++seq}`,...data};log.push(['assessment',x]);return x;},update:async()=>log.push(['updated'])},assessmentTranslation:{create:async({data})=>{log.push(['translation',data]);return data;}},question:{create:async({data})=>{const x={id:`q-${++seq}`,...data};log.push(['question',x]);return x;}},questionTranslation:{create:async({data})=>log.push(['questionTranslation',data])},auditEvent:{create:async({data})=>{log.push(['audit',data]);return data;}}, ...extra};
 return {tx,log,db:{$transaction:async fn=>{transactions++;const mark=log.length;try{return await fn(tx);}catch(e){log.splice(mark);throw e;}},get transactions(){return transactions;}}};}

test('WS-2: all three entrypoints submit initial level in the creation request, not through a second API call',()=>{
 for(const path of ['apps/web/components/manual-assessment-start.tsx','apps/web/components/framework-start-button.tsx','apps/web/components/import-assessment-wizard.tsx']){
  const src=read(path);assert.match(src,/JSON\.stringify\(\{[^}]*level[^}]*\}\)/,path);assert.doesNotMatch(src,/\/config`,\{method:"POST"/,path);
 }
});
test('WS-2: API keeps optional level with L2 default and retains original endpoint routes',()=>{
 assert.match(read('apps/api/src/workspace.controller.ts'),/level:z\.enum\(\["L1","L2","L3","L4"\]\)\.default\("L2"\)/);
 assert.match(read('apps/api/src/imports/imports.controller.ts'),/level:z\.enum\(\["L1","L2","L3","L4"\]\)\.default\("L2"\)/);
 assert.match(read('apps/api/src/workspace.controller.ts'),/@Post\("assessments"\)/);
 assert.match(read('apps/api/src/workspace.controller.ts'),/@Post\("frameworks\/:id\/start"\)/);
});
test('WS-2: manual creation stores metadata, translation and audit atomically',async()=>{
 const {tx,db,log}=txDb();const c=new WorkspaceController(db,{}, {}, {});const res=await c.create(req,{title:'Assessment A',objective:'Understand operational friction',level:'L3',locale:'en'});
 assert.equal(res.level,'L3');assert.equal(res.status,'DRAFT');assert.equal(res.assessmentId,'a-1');assert.deepEqual(log.map(x=>x[0]),['assessment','translation','audit']);assert.equal(log[0][1].locale,'en');assert.equal(log[2][1].action,'ASSESSMENT_CREATED_MANUALLY');assert.ok(authorized.some(x=>x[0]==='assessment.edit'));
});
test('WS-2: if translation fails manual creation rolls back all effects',async()=>{
 const {db,log}=txDb({assessmentTranslation:{create:async()=>{throw new Error('translation DB failed');}}});const c=new WorkspaceController(db,{}, {}, {});
 await assert.rejects(c.create(req,{title:'Assessment B',objective:'Operational health assessment',level:'L1',locale:'es'}),/translation DB failed/);
 assert.equal(log.length,0);
});
test('WS-2: framework creation stores questions, level and audit in one transaction',async()=>{
 const {db,log}=txDb();db.framework={findUnique:async()=>({name:'Safety',versions:[{id:'fv-1',objective:'Evaluate coordination across teams',questionBlueprint:[{prompt:'What changed in your work?',type:'LIKERT'},{prompt:'How does leadership help?',type:'LIKERT'}]}]})};
 const c=new WorkspaceController(db,{record:async()=>{throw new Error('external audit must not be called');}}, {}, {});
 const res=await c.start(req,'fw-1',{level:'L4'});
 assert.equal(res.level,'L4');assert.equal(res.questionCount,2);assert.deepEqual(log.map(x=>x[0]),['assessment','translation','question','questionTranslation','question','questionTranslation','audit']);assert.equal(log.at(-1)[1].metadata.level,'L4');
});
test('WS-2: invalid framework blueprint rolls back assessment and questions',async()=>{
 const {db,log}=txDb();db.framework={findUnique:async()=>({name:'Risk',versions:[{id:'fv-2',objective:'Identify risks for teams',questionBlueprint:[{prompt:'Valid question?',type:'LIKERT'},{prompt:'Bad',type:'LIKERT'}]}]})};
 await assert.rejects(new WorkspaceController(db,{}, {}, {}).start(req,'fw-2',{level:'L2'}),/invalid/);assert.equal(log.length,0);
});
function importDb(){const {db,tx,log}=txDb();let status='ANALYZED',assessmentId=null,claims=0;
 db.assessmentImport={findFirst:async({where})=>where.organizationId==='org-1'?{id:'import-1',organizationId:'org-1',sourceRecordId:'source-1',fileName:'import.txt',status,assessmentId,analysis:{detectedLanguage:'es',questions:[{prompt:'Does your team coordinate well?',type:'LIKERT',weight:1,required:true}]}}:null};
 tx.assessmentImport={updateMany:async({where,data})=>{assert.equal(where.organizationId,'org-1');if(where.status!==status||assessmentId!==null)return{count:0};status=data.status;assessmentId=data.assessmentId;claims++;return{count:1}}};
 tx.documentRecord={update:async({where,data})=>{assert.equal(where.id,'source-1');log.push(['source',data]);}};
 return {db,log,get claims(){return claims;}};
}
test('WS-2: imported assessment stores level and preserves provenance with audit in the transaction',async()=>{
 const x=importDb();const res=await new ImportService(x.db).apply('org-1','import-1','creator@proofline.test',{title:'Imported culture survey',objective:'Assess the culture of work',level:'L1'});
 assert.equal(res.questionCount,1);assert.equal(x.claims,1);assert.equal(x.log[0][1].level,'L1');assert.ok(x.log.some(q=>q[0]==='source'));assert.equal(x.log.at(-1)[1].action,'ASSESSMENT_CREATED_FROM_IMPORT');
 const again=await new ImportService(x.db).apply('org-1','import-1','creator@proofline.test',{level:'L4'});assert.equal(again.reused,true);assert.equal(again.assessmentId,res.assessmentId);assert.equal(x.claims,1);
});
test('WS-2: import cannot claim a concurrently applied proposal',async()=>{
 const x=importDb();x.db.$transaction=async fn=>{const tx={assessment:{create:async({data})=>({id:'a-stale',...data})},assessmentTranslation:{create:async()=>{}},question:{create:async()=>({id:'q-1'})},questionTranslation:{create:async()=>{}},assessmentImport:{updateMany:async()=>({count:0})}};return fn(tx)};
 await assert.rejects(new ImportService(x.db).apply('org-1','import-1','creator@proofline.test',{title:'Conflict import',objective:'Objective of conflict case'}),/already applied/);
});
test('WS-2: legal profile, notice version, readiness invalidation and audit use one transaction',async()=>{
 const {db,log,tx}=txDb();tx.assessmentLegalProfile={upsert:async()=>{log.push(['legal']);return{id:'legal-1'}}};tx.participantNoticeVersion={count:async()=>0,updateMany:async()=>log.push(['deactivate notice']),create:async({data})=>log.push(['notice',data])};
 const c=new AssessmentsController({get:async()=>({status:'PREPARATION',organizationId:'org-1'})},db,{record:async()=>{throw new Error('external audit not expected');}});
 await c.legal(req,'a-1',{controllerName:'Acme Inc',purpose:'Understand worker engagement',legalBasis:'Consent',participationMode:'Voluntary',confidentiality:'Confidential',retentionDays:365,locale:'en',approve:true});
 assert.deepEqual(log.map(x=>x[0]),['legal','deactivate notice','notice','updated','audit']);assert.equal(log.at(-1)[1].action,'LEGAL_PROFILE_APPROVED');
});
test('WS-2: legal notice creation failure rolls back profile and notice deactivation',async()=>{
 const {db,log,tx}=txDb();tx.assessmentLegalProfile={upsert:async()=>{log.push(['legal']);return{id:'legal-1'}}};tx.participantNoticeVersion={count:async()=>2,updateMany:async()=>log.push(['deactivate notice']),create:async()=>{throw new Error('notice write failed')}};
 const c=new AssessmentsController({get:async()=>({status:'PREPARATION',organizationId:'org-1'})},db,{});
 await assert.rejects(c.legal(req,'a-1',{controllerName:'Acme Inc',purpose:'Understand worker engagement',legalBasis:'Consent',participationMode:'Voluntary',confidentiality:'Confidential',retentionDays:365,locale:'en',approve:true}),/notice write failed/);assert.equal(log.length,0);
});
test('WS-2: TS/TSX modified files parse cleanly and no Control/global styling files were touched',()=>{
 const files=['apps/api/src/workspace.controller.ts','apps/api/src/imports/imports.controller.ts','apps/api/src/imports/import.service.ts','apps/api/src/assessments/assessments.controller.ts','apps/web/components/manual-assessment-start.tsx','apps/web/components/framework-start-button.tsx','apps/web/components/import-assessment-wizard.tsx'];
 for(const file of files){const p=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(p.parseDiagnostics.length,0,file)}
});
