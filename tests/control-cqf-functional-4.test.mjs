import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const errors=Object.fromEntries(['ForbiddenException','BadRequestException','NotFoundException','ConflictException'].map(name=>[name,class extends Error{constructor(msg){super(msg);this.name=name;}}]));
const owner={headers:{role:'INTERNAL_PLATFORM_OWNER'}},finance={headers:{role:'INTERNAL_FINANCE'}};
const auth=(req,cap)=>{if(req.headers.role!=='INTERNAL_PLATFORM_OWNER')throw new errors.ForbiddenException(cap);return{identity:{email:'owner@proofline.local'}};};
function load(file,mods={}){const mod={exports:{}};const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date,Promise,Set,Map},{filename:file})(n=>mods[n]??(n==='@nestjs/common'?{...errors,Inject:()=>()=>{},Injectable:()=>x=>x}:{}),mod,mod.exports);return mod.exports;}
const policy=load('apps/api/src/control/p5-policy.ts');
const paging=load('apps/api/src/common/pagination.ts',{ '@nestjs/common':errors });
function svc(db){const deps={'./internal-access.js':{requireInternalCapability:auth,internalContext:()=>({capabilities:['*']})},'./p5-policy.js':policy,'../common/pagination.js':paging};return new (load('apps/api/src/control/control.service.ts',deps).ControlService)(db,{},{},{});}
const now=new Date('2026-10-20T12:00:00Z');
test('CQF-F4: assessment details use only aggregates and omit analysis result/error and identities',async()=>{
 const calls=[];
 const db={assessment:{findUnique:async p=>{calls.push(p);return {id:'a1',title:'Assessment',status:'CLOSED',organization:{id:'o1',name:'ACME'},analysisRuns:[{id:'run1',status:'FAILED',engineVersion:'v1',createdAt:now,error:'person-private@domain.invalid token=XX',sourceHash:'aabb'}],reports:[{id:'r1',status:'APPROVED'}],_count:{participants:12,analysisRuns:1,reports:1},legalHolds:[]};}}, participant:{groupBy:async()=>[{status:'COMPLETED',_count:{_all:12}}]},analysisRun:{count:async()=>0}};
 const d=await svc(db).assessmentOperationalDetail(owner,'a1');
 assert.equal(d.progress.completed,12);assert.equal(d.progress.invited,0);assert.equal(d.canReprocess,true);assert.equal(d.analysisRuns[0].errorRecorded,true);
 assert.equal(JSON.stringify(d).includes('person-private'),false);assert.equal(JSON.stringify(d).includes('token='),false);
 assert.equal(calls[0].select.analysisRuns.select.result,undefined);
 assert.equal(calls[0].select.participants,undefined);
});
test('CQF-F4: active analysis disables reprocess, missing assessment returns 404',async()=>{
 const db={assessment:{findUnique:async()=>({id:'a1',status:'CLOSED',organization:{id:'o1',name:'ACME'},analysisRuns:[],reports:[],_count:{analysisRuns:0,reports:0},legalHolds:[]})},participant:{groupBy:async()=>[]},analysisRun:{count:async()=>1}};
 assert.equal((await svc(db).assessmentOperationalDetail(owner,'a1')).canReprocess,false);
 await assert.rejects(()=>svc({...db,assessment:{findUnique:async()=>null}}).assessmentOperationalDetail(owner,'missing'),{name:'NotFoundException'});
 await assert.rejects(()=>svc(db).assessmentOperationalDetail(finance,'a1'),{name:'ForbiddenException'});
});
test('CQF-F4: report detail uses bounded pagination, total DB count and no report snapshot or recipient PII',async()=>{
 let queried;
 const db={report:{findUnique:async()=>({id:'r1',status:'DISTRIBUTED',snapshotHash:'hash1',assessment:{id:'a1',title:'ASMT',organization:{id:'o1',name:'ACME'}}})},reportDelivery:{count:async()=>53,groupBy:async()=>[{status:'SENT',_count:{_all:51}},{status:'FAILED',_count:{_all:2}}],findMany:async x=>{queried=x;return [{id:'d1',status:'FAILED',channel:'EMAIL',error:'sensitive-secret-email@test.invalid',createdAt:now}];}}};
 const d=await svc(db).reportOperationalDetail(owner,'r1',{page:'2',pageSize:'25'});
 assert.equal(d.deliverySummary.total,53);assert.equal(d.deliveries.pagination.total,53);assert.equal(d.deliveries.pagination.page,2);
 assert.equal(queried.take,25);assert.equal(queried.skip,25);assert.equal(d.deliveries.items[0].errorRecorded,true);
 assert.equal(d.deliveries.items[0].error,undefined);assert.equal(JSON.stringify(d).includes('sensitive-secret'),false);
 await assert.rejects(()=>svc(db).reportOperationalDetail(finance,'r1',{}),{name:'ForbiddenException'});
});
test('CQF-F4: absent report is 404 and no writes are part of the read-only detail',async()=>{
 const db={report:{findUnique:async()=>null},reportDelivery:{count:async()=>{throw Error('unexpected')}}};
 await assert.rejects(()=>svc(db).reportOperationalDetail(owner,'missing',{}),{name:'NotFoundException'});
 const code=read('apps/api/src/control/control.service.ts');
 for(const m of ['async assessmentOperationalDetail','async reportOperationalDetail'])assert.ok(code.includes(m));
 assert.match(code,/reportDelivery\.findMany\(/);
});
test('CQF-F4: list links lead to independent pages, detail only reuses audited reprocess action',()=>{
 const ap=read('apps/control/app/[locale]/assessments/page.tsx');const rp=read('apps/control/app/[locale]/reports/page.tsx');
 const ad=read('apps/control/app/[locale]/assessments/[id]/page.tsx');const rd=read('apps/control/app/[locale]/reports/[id]/page.tsx');
 assert.match(ap,/assessments\/\$\{encodeURIComponent\(a\.id\)\}/);
 assert.match(rp,/reports\/\$\{encodeURIComponent\(r\.id\)\}/);
 assert.match(ad,/action=\{reprocessAssessment\}/);assert.match(ad,/d\.canReprocess/);
 assert.match(rd,/PaginationBar/);assert.match(rd,/canSeeDelivery/);
 assert.doesNotMatch(rd,/action=\{/);
});
test('CQF-F4: all modified TS/TSX files have valid syntax',()=>{
 const paths=['apps/api/src/control/control.service.ts','apps/api/src/control/control.controller.ts','apps/control/app/[locale]/assessments/page.tsx','apps/control/app/[locale]/assessments/[id]/page.tsx','apps/control/app/[locale]/reports/page.tsx','apps/control/app/[locale]/reports/[id]/page.tsx'];
 for(const path of paths){const d=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).diagnostics??[]; assert.equal(d.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,path);}
});
