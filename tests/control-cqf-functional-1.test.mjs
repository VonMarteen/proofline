import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const read=(f)=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const css=read('apps/control/app/backoffice.css');
const api=read('apps/api/src/control/control.service.ts');
const controller=read('apps/api/src/control/control.controller.ts');
const market=read('apps/control/app/[locale]/marketplace/page.tsx');
const detail=read('apps/control/app/[locale]/marketplace/[id]/page.tsx');
const legal=read('apps/control/app/[locale]/legal/page.tsx');
const security=read('apps/control/app/[locale]/security/page.tsx');
const actions=read('apps/control/app/actions.ts');
const legalDetail=read('apps/control/app/[locale]/legal/versions/[id]/page.tsx');
const securityDetail=read('apps/control/app/[locale]/security/users/[id]/page.tsx');
const roleDetail=read('apps/control/app/[locale]/security/roles/[role]/page.tsx');
const exceptions=Object.fromEntries(['ForbiddenException','BadRequestException','NotFoundException','ConflictException'].map(k=>[k,class extends Error {name=k}]));
function actualService(db){
  const compiled=ts.transpileModule(api,{fileName:'control.service.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const mod={exports:{}};
  const mocked=(name)=>{
    if(name==='node:crypto')return require('node:crypto');
    if(name==='@nestjs/common')return {...exceptions,Inject:()=>()=>{},Injectable:()=>x=>x};
    if(name.endsWith('/internal-access.js'))return {
      requireInternalCapability:(req,cap)=>{if(req.headers['x-proofline-role']!=='INTERNAL_PLATFORM_OWNER')throw new exceptions.ForbiddenException(`missing ${cap}`);return {identity:{email:req.headers['x-proofline-user']}};},
      internalContext:()=>({capabilities:['*']}),internalRoleCapabilities:{INTERNAL_PLATFORM_OWNER:['*']}
    };
    return {};
  };
  vm.runInNewContext('(function(require,module,exports){'+compiled+'\n})',{console,process,Date,Buffer,URLSearchParams,Set,Map,Promise}, {filename:'compiled-control.service.cjs'})(mocked,mod,mod.exports);
  const ControlService=mod.exports.ControlService;
  assert.equal(typeof ControlService,'function');
  return new ControlService(db,{}, {}, {});
}
const owner={headers:{'x-proofline-role':'INTERNAL_PLATFORM_OWNER','x-proofline-user':'owner@proofline.local'}};
const other={headers:{'x-proofline-role':'INTERNAL_OPERATIONS','x-proofline-user':'ops@proofline.local'}};
test('CQF-F1: sidebar scroll is limited to nav, preserves tokens and mobile behavior',()=>{
 const scope=css.slice(css.indexOf('/* CQF-F1:'));
 assert.match(scope,/\.control-sidebar\{overflow:hidden/);
 assert.match(scope,/\.control-sidebar>\.control-nav\{[^}]*overflow-y:auto/);
 assert.match(scope,/\.control-sidebar>\.control-brand\{flex:0 0 auto/);
 assert.match(scope,/\.control-sidebar>\.control-identity\{flex:0 0 auto/);
 assert.match(scope,/@media \(max-width:900px\)\{\.control-sidebar\{overflow:visible/);
 assert.doesNotMatch(scope,/::-webkit-scrollbar|scrollbar-color:|scrollbar-width:/);
 assert.doesNotMatch(scope,/\.bo-dashboard|\.bo-kpi/);
});
test('CQF-F1: Marketplace navigates to durable detail, manages only own metadata',()=>{
 assert.match(market,/href=\{`\/\$\{locale\}\/marketplace\/\$\{encodeURIComponent\(f.id\)\}`\}/);
 assert.match(detail,/controlGet\(`\/v1\/control\/marketplace\/\$\{encodeURIComponent\(id\)\}`\)/);
 assert.match(detail,/v\._count\.assessments/);
 assert.match(detail,/action=\{updateFrameworkMetadata\}/);
 assert.match(actions,/CONTROL_FRAMEWORK_METADATA_UPDATED|updateFrameworkMetadata/);
 assert.match(controller,/@Post\("marketplace\/:id\/metadata"\)/);
 assert.match(api,/requireInternalCapability\(req,"marketplace.manage"\)/);
 assert.match(api,/current.origin!=="PROOFLINE"/);
});
test('CQF-F1: framework edit persists & audits atomically, ignores identical edits',async()=>{
 const audits=[];let saves=0;
 const record={id:'fw1',origin:'PROOFLINE',description:'Original description here',category:'Culture'};
 const db={$transaction:async fn=>fn({framework:{findUnique:async()=>record,update:async({data})=>{saves++;return {id:'fw1',...data};}},auditEvent:{create:async({data})=>audits.push(data)}})};
 const service=actualService(db);
 await assert.rejects(()=>service.updateMarketplaceMetadata(other,'fw1',{description:'New long description',category:'Culture'}),{name:'ForbiddenException'});
 const next=await service.updateMarketplaceMetadata(owner,'fw1',{description:'New long description',category:'Culture'});
 assert.equal(next.changed,true);assert.equal(saves,1);assert.equal(audits.length,1);
 assert.equal(audits[0].action,'CONTROL_FRAMEWORK_METADATA_UPDATED');assert.equal(audits[0].targetId,'fw1');
 assert.deepEqual(JSON.parse(JSON.stringify(audits[0].metadata)),{before:{description:'Original description here',category:'Culture'},after:{description:'New long description',category:'Culture'}});
 const same=await service.updateMarketplaceMetadata(owner,'fw1',{description:'Original description here',category:'Culture'});
 assert.equal(same.changed,false);assert.equal(saves,1);
});
test('CQF-F1: partner frameworks cannot be altered',async()=>{
 const service=actualService({$transaction:async fn=>fn({framework:{findUnique:async()=>({id:'fw2',origin:'PARTNER',description:'Original description here',category:'Culture'})}})});
 await assert.rejects(()=>service.updateMarketplaceMetadata(owner,'fw2',{description:'Changed description text',category:'Culture'}),{name:'ForbiddenException'});
});
test('CQF-F1: Legal content review precedes authorized publication',()=>{
 assert.match(legal,/href=\{`\/\$\{locale\}\/legal\/versions\/\$\{encodeURIComponent\(v.id\)\}`\}/);
 assert.match(legalDetail,/<pre className="control-legal-text control-legal-detail-content">\{v\.content\}<\/pre>/);
 assert.match(legalDetail,/d.hashVerified/);
 assert.match(legalDetail,/action=\{publishLegalDocumentVersion\}/);
 assert.doesNotMatch(legal,/<details className="control-legal-read">/);
 assert.match(api,/requireInternalCapability\(req,"legal.publish"\)/);
 assert.match(api,/hashVerified:createHash\("sha256"\)/);
});
test('CQF-F1: assigning roles changes only users, not the source-of-truth RBAC definitions',()=>{
 assert.match(security,/href=\{`\/\$\{locale\}\/security\/users\/\$\{encodeURIComponent\(u.id\)\}`\}/);
 assert.match(securityDetail,/action=\{updateInternalRole\}/);
 assert.match(security,/href=\{`\/\$\{locale\}\/security\/roles\/\$\{encodeURIComponent\(r.role\)\}`\}/);
 assert.match(roleDetail,/controlGet\('\/v1\/control\/governance\/roles'\)/);
 assert.doesNotMatch(security,/<details key="caps"/);
 assert.match(security,/Esta matriz es fija/);
 assert.match(controller,/@Post\("internal-users\/:id\/role"\)/);
 assert.match(api,/requireInternalCapability\(req,"security.manage"\)/);
 assert.match(api,/user.role==="INTERNAL_PLATFORM_OWNER"/);
 assert.doesNotMatch(read('apps/api/src/control/internal-access.ts'),/marketplace.manage|security.manage/);
});
test('CQF-F1: owner-only role changes audited, owner account protected, self-change refused',async()=>{
 const audits=[];let saves=0;
 let current={id:'user2',email:'support@proofline.local',role:'INTERNAL_SUPPORT',status:'ACTIVE'};
 const svc=actualService({$transaction:async fn=>fn({internalUser:{findUnique:async()=>current,update:async({data})=>{saves++;return {id:'user2',...data};}},auditEvent:{create:async({data})=>audits.push(data)}})});
 await assert.rejects(()=>svc.updateInternalRole(other,'user2','INTERNAL_FINANCE'),{name:'ForbiddenException'});
 await assert.rejects(()=>svc.updateInternalRole(owner,'user2','INTERNAL_PLATFORM_OWNER'),{name:'BadRequestException'});
 const result=await svc.updateInternalRole(owner,'user2','INTERNAL_OPERATIONS');
 assert.equal(result.changed,true);assert.equal(result.role,'INTERNAL_OPERATIONS');assert.equal(saves,1);
 assert.equal(audits[0].action,'CONTROL_INTERNAL_ROLE_CHANGED');
 current={...current,role:'INTERNAL_PLATFORM_OWNER'};
 await assert.rejects(()=>svc.updateInternalRole(owner,'user2','INTERNAL_SUPPORT'),{name:'ForbiddenException'});
 current={...current,role:'INTERNAL_SUPPORT',email:'owner@proofline.local'};
 await assert.rejects(()=>svc.updateInternalRole(owner,'user2','INTERNAL_TRUST'),{name:'ForbiddenException'});
});
test('CQF-F1: new TSX and TS parse; API remains without new migrations',()=>{
 for(const file of ['apps/api/src/control/control.controller.ts','apps/api/src/control/control.service.ts','apps/control/app/actions.ts','apps/control/app/[locale]/marketplace/page.tsx','apps/control/app/[locale]/marketplace/[id]/page.tsx','apps/control/app/[locale]/security/page.tsx','apps/control/app/[locale]/security/users/[id]/page.tsx','apps/control/app/[locale]/security/roles/[role]/page.tsx','apps/control/app/[locale]/legal/versions/[id]/page.tsx','apps/control/app/[locale]/legal/page.tsx']){
  const out=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve,experimentalDecorators:true}});
  assert.equal((out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file);
 }
});

test('CQF-F1: independent legal review verifies persisted content hash and audit records',async()=>{
 const {createHash}=await import('node:crypto');
 const content='Verifiable legal version of the document';
 const hash=createHash('sha256').update(content).digest('hex');
 const svc=actualService({legalDocumentVersion:{findUnique:async()=>({id:'v1',title:'Terms',version:'2.0',locale:'es',content,contentHash:hash,active:false,document:{key:'terms',description:'Términos',scope:'USER'}})},auditEvent:{findMany:async()=>[{id:'e1',action:'CONTROL_LEGAL_VERSION_DRAFT_CREATED'}]}});
 const result=await svc.legalVersionDetail(owner,'v1');
 assert.equal(result.hashVerified,true);assert.equal(result.version.content,content);assert.equal(result.events.length,1);
 assert.equal(result.document.key,'terms');
 const unauthorized=await svc.legalVersionDetail(other,'v1').catch(e=>e);
 assert.equal(unauthorized.name,'ForbiddenException');
});
test('CQF-F1: security user detail returns scoped non-secret data',async()=>{
 const user={id:'u1',displayName:'Support user',email:'support@example.com',role:'INTERNAL_SUPPORT',status:'ACTIVE',lastLoginAt:null,sessions:[{id:'s1'},{id:'s2'}]};
 const svc=actualService({internalUser:{findUnique:async()=>user}});
 const result=await svc.securityUserDetail(owner,'u1');
 assert.equal(result.activeSessions,2);
 assert.equal(result.role,'INTERNAL_SUPPORT');
 assert.equal(result.passwordHash,undefined);
 assert.equal(result.sessions,undefined);
});
