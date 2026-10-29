import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts=require('typescript');
const errorClass=name=>class extends Error { constructor(message){ super(message);this.name=name; } };
const ConflictException=errorClass('ConflictException');
const Null=()=>()=>{};
const z={
  object:()=>({parse:x=>x}),
  boolean:()=>({}),string:()=>({optional:()=>({})}),unknown:()=>({optional:()=>({})}),
  enum:()=>({optional:()=>({})}),
};
function loadController(){
  const src=fs.readFileSync(new URL('../apps/api/src/internal/internal.controller.ts',import.meta.url),'utf8');
  const js=ts.transpileModule(src,{fileName:'internal.controller.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;
  const module={exports:{}};
  const libs={
    '@nestjs/common':{Inject:Null,Controller:Null,Get:Null,Post:Null,Param:Null,Query:Null,Body:Null,UseGuards:Null,ConflictException},
    'zod':{z},
    '../auth/dev-auth.js':{ServiceTokenGuard:class{}},
    '../database/prisma.service.js':{PrismaService:class{}},
    '../security/crypto.js':{sha256:()=>''},
    '../security/pii.js':{redactFreeTextPII:s=>s},
    '../support/support.service.js':{SupportService:class{}},
    '../audit/audit.service.js':{AuditService:class{}},
  };
  const wrapper=vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{Date,Buffer,console,process},{filename:'internal.controller.cjs'});
  wrapper(k=>{ if(!(k in libs)) throw Error('Unexpected dependency '+k);return libs[k];},module,module.exports);
  return module.exports.InternalController;
}
const InternalController=loadController();
const originalDate=new Date('2026-10-27T14:00:00Z');
const leaseDate=new Date('2026-10-27T13:59:00Z');
const standardPayload={to:'private@proofline.test',organizationId:'org-1',ticketId:'ticket-1',category:'support_reply',text:'Sensitive private message'};
function makeJob(overrides={}){
  return {id:'email-1',type:'SEND_EMAIL',payload:structuredClone(standardPayload),status:'PROCESSING',attempts:1,lockedAt:new Date(leaseDate),availableAt:new Date('2026-10-27T13:00:00Z'),createdAt:new Date('2026-10-27T13:00:00Z'),updatedAt:new Date(leaseDate),error:null,result:null,...overrides};
}
function copy(x){return structuredClone(x);}
function matches(row,where={}){
  for(const [k,v] of Object.entries(where)){
    if(k==='OR') {if(!v.some(x=>matches(row,x)))return false;continue;}
    if(v && typeof v==='object' && !(v instanceof Date) && !Array.isArray(v)){
      if('lte' in v && !(row[k]<=v.lte))return false;
      if('lt' in v && !(row[k]<v.lt))return false;
      if('not' in v && row[k]===v.not)return false;
      if('in' in v && !v.in.includes(row[k]))return false;
    }else if(v instanceof Date){if(row[k]?.getTime()!==v.getTime())return false;}
    else if(row[k]!==v)return false;
  }
  return true;
}
function makeStore(initial=[makeJob()], options={}){
  let state={jobs:copy(initial),audits:[],deliveries:[{id:'d-1',reportId:'report-1',status:'PENDING',sentAt:null,error:null}],reports:[{id:'report-1',assessmentId:'assess-1',assessment:{organizationId:'org-1'},status:'APPROVED'}]};
  const createDb=s=>({
    outboxEvent:{
      findUniqueOrThrow:async({where})=>{const r=s.jobs.find(x=>x.id===where.id);if(!r)throw Error('not found');return copy(r);},
      findFirst:async({where})=>{const r=s.jobs.find(x=>matches(x,where));return r?copy(r):null;},
      findMany:async({where,take})=>copy(s.jobs.filter(x=>matches(x,where)).slice(0,take)),
      updateMany:async({where,data})=>{const targets=s.jobs.filter(x=>matches(x,where));for(const x of targets){for(const [k,v] of Object.entries(data)){
        if(v && typeof v==='object' && 'increment' in v)x[k]+=v.increment;
        else x[k]=copy(v);
      }x.updatedAt=new Date('2026-10-27T14:00:01Z');}return {count:targets.length};},
    },
    auditEvent:{create:async({data})=>{if(options.failAudit)throw Error('injected audit failure');s.audits.push(copy(data));return copy(data);}},
    assessment:{findUnique:async()=>({organizationId:'org-1'})},
    reportDelivery:{
      update:async({where,data})=>{const row=s.deliveries.find(x=>x.id===where.id);if(!row)throw Error('no delivery');if(options.failDelivery)throw Error('injected delivery failure');Object.assign(row,copy(data));return copy(row);},
      count:async({where})=>s.deliveries.filter(x=>x.reportId===where.reportId && x.status!==where.status.not).length,
    },
    report:{findUnique:async({where})=>copy(s.reports.find(x=>x.id===where.id)??null),update:async({where,data})=>{const r=s.reports.find(x=>x.id===where.id);Object.assign(r,copy(data));return copy(r);}},
    $transaction:async callback=>{
      const transaction=copy(s);
      const result=await callback(createDb(transaction));
      Object.assign(s,transaction);
      return result;
    }
  });
  const db={ $transaction:async callback=>{
      const draft=copy(state);
      const value=await callback(createDb(draft));
      state=draft;
      return value;
    }};
  Object.assign(db,createDb(state));
  // Make direct DB access always read the latest transaction snapshot.
  for(const key of ['outboxEvent','auditEvent','assessment','report','reportDelivery']){
    Object.defineProperty(db,key,{get:()=>createDb(state)[key]});
  }
  const controller=new InternalController(db,{},{});
  return {controller,get:()=>copy(state)};
}
const success={ok:true,claimToken:leaseDate.toISOString(),result:{messageId:'<confirmed@localhost>',category:'support_reply',templateId:'s01',templateVersion:'2',family:'support',html:true,text:true}};

test('S5 confirms email with one atomic audit and scrubs content and recipient',async()=>{
  const m=makeStore();const result=await m.controller.complete('email-1',success);
  assert.equal(result.status,'COMPLETED');
  const {jobs,audits}=m.get();assert.equal(jobs[0].status,'COMPLETED');
  assert.equal(jobs[0].payload.to,undefined);assert.equal(jobs[0].payload.text,undefined);
  assert.equal(jobs[0].payload.ticketId,'ticket-1');assert.equal(jobs[0].result.messageId,'<confirmed@localhost>');
  assert.deepEqual(audits.map(x=>x.action),['EMAIL_DELIVERED']);
  assert.doesNotMatch(JSON.stringify(audits),/private@proofline|Sensitive private/);
});
test('S5 rejects re-acknowledgement and preserves single audit entry',async()=>{
  const m=makeStore();await m.controller.complete('email-1',success);
  await assert.rejects(m.controller.complete('email-1',success),/not processing/);
  assert.equal(m.get().audits.length,1);
});
test('S5 claim token prevents stale worker from acknowledging newer attempt',async()=>{
  const m=makeStore();await assert.rejects(m.controller.complete('email-1',{...success,claimToken:'2026-10-27T14:00:00.000Z'}),/claim expired/);
  assert.equal(m.get().jobs[0].status,'PROCESSING');
});
test('S5 4xx rejection goes back to PENDING with exponential backoff and no private audit data',async()=>{
  const m=makeStore();const r=await m.controller.complete('email-1',{ok:false,claimToken:leaseDate.toISOString(),failureCode:'SMTP_TEMPORARY'});
  assert.equal(r.status,'PENDING');const s=m.get();assert.equal(s.jobs[0].attempts,1);
  assert.ok(s.jobs[0].availableAt > new Date(Date.now()));
  assert.equal(s.jobs[0].error,'SMTP_TEMPORARY: retry scheduled');
  assert.equal(s.audits[0].action,'EMAIL_DELIVERY_RETRY_SCHEDULED');
  assert.equal(s.audits[0].metadata.retryDelayMs,60_000);
});
test('S5 at fifth failed SMTP attempt moves to FAILED instead of endless retry',async()=>{
  const m=makeStore([makeJob({attempts:5})]);const result=await m.controller.complete('email-1',{ok:false,claimToken:leaseDate.toISOString(),failureCode:'SMTP_TEMPORARY'});
  assert.equal(result.status,'FAILED');assert.equal(m.get().jobs[0].status,'FAILED');
});
test('S5 rejects SMTP uncertain delivery without replay',async()=>{
  const m=makeStore();const r=await m.controller.complete('email-1',{ok:false,claimToken:leaseDate.toISOString(),failureCode:'SMTP_UNCERTAIN'});
  assert.equal(r.status,'FAILED');assert.equal(m.get().jobs[0].availableAt.getTime(),new Date('2026-10-27T13:00:00Z').getTime());
});
test('S5 audit failure rolls back confirmed email and preserved content until reconciliation',async()=>{
  const m=makeStore(undefined,{failAudit:true});
  await assert.rejects(m.controller.complete('email-1',success),/injected audit failure/);
  const s=m.get();assert.equal(s.jobs[0].status,'PROCESSING');assert.equal(s.audits.length,0);assert.equal(s.jobs[0].payload.to,'private@proofline.test');
});
test('S5 report delivery and email acknowledgement are committed together',async()=>{
  const m=makeStore([makeJob({payload:{...standardPayload,reportDeliveryId:'d-1'}})]);
  await m.controller.complete('email-1',success);const s=m.get();
  assert.equal(s.deliveries[0].status,'SENT');assert.equal(s.reports[0].status,'DISTRIBUTED');
  assert.deepEqual(s.audits.map(x=>x.action),['REPORT_DELIVERY_SENT','EMAIL_DELIVERED']);
});
test('S5 report delivery stays pending on temporary email rejection',async()=>{
  const m=makeStore([makeJob({payload:{...standardPayload,reportDeliveryId:'d-1'}})]);
  await m.controller.complete('email-1',{ok:false,claimToken:leaseDate.toISOString(),failureCode:'SMTP_TEMPORARY'});
  const s=m.get();assert.equal(s.deliveries[0].status,'PENDING');assert.equal(s.reports[0].status,'APPROVED');
});
test('S5 report completion failure rolls back outbox and audit',async()=>{
  const m=makeStore([makeJob({payload:{...standardPayload,reportDeliveryId:'d-1'}})],{failDelivery:true});
  await assert.rejects(m.controller.complete('email-1',success),/injected delivery failure/);
  const s=m.get();assert.equal(s.jobs[0].status,'PROCESSING');assert.equal(s.audits.length,0);
});
test('S5 recovery quarantines interrupted SMTP and leaves other jobs alone',async()=>{
  const old=new Date('2026-10-27T10:00:00Z');
  const fresh = new Date(Date.now() + 60_000); // Relativo al reloj actual: test estable cada dia.
  const m=makeStore([makeJob({lockedAt:old,updatedAt:old}),makeJob({id:'email-fresh',lockedAt:fresh,updatedAt:fresh}),makeJob({id:'analysis',type:'RUN_ANALYSIS',lockedAt:old,updatedAt:old})]);
  const recovered=await m.controller.recoverStaleEmails();
  assert.equal(recovered.quarantined,1);
  const s=m.get();assert.equal(s.jobs[0].status,'FAILED');assert.match(s.jobs[0].error,/EMAIL_DELIVERY_UNCERTAIN/);
  assert.equal(s.jobs[1].status,'PROCESSING');assert.equal(s.jobs[2].status,'PROCESSING');
  assert.equal(s.audits.length,1);assert.equal(s.audits[0].action,'EMAIL_DELIVERY_UNCERTAIN');
});
test('S5 recovery records audit transactionally and rolls back on audit failure',async()=>{
  const old=new Date('2026-10-27T10:00:00Z');
  const m=makeStore([makeJob({lockedAt:old,updatedAt:old})],{failAudit:true});
  await assert.rejects(m.controller.recoverStaleEmails(),/injected audit failure/);
  assert.equal(m.get().jobs[0].status,'PROCESSING');
});
test('S5 claim uses conditional update and increments attempts exactly once',async()=>{
  const m=makeStore([makeJob({status:'PENDING',lockedAt:null,attempts:0})]);
  const r=await m.controller.next();assert.equal(r.status,'PROCESSING');assert.equal(r.attempts,1);
  assert.equal((await m.controller.next()),null);
});
test('S5 worker never converts successful send with failing API acknowledgement into failed SMTP',()=>{
  const worker=fs.readFileSync(new URL('../apps/worker/src/index.ts',import.meta.url),'utf8');
  const section=worker.slice(worker.indexOf('async function processJob'),worker.indexOf('async function recoverStaleEmailJobs'));
  assert.match(section,/await complete\(job.id,\{\.\.\.outcome,claimToken\}\)/);
  assert.doesNotMatch(section,/catch[^]*await complete\(job\.id,\{ok:false/);
});
test('S5 worker SMTP classifier only retries explicit 4xx failures',()=>{
  const worker=fs.readFileSync(new URL('../apps/worker/src/index.ts',import.meta.url),'utf8');
  assert.match(worker,/responseCode >= 400 && responseCode < 500/);
  assert.match(worker,/return "SMTP_UNCERTAIN"/);
});

function loadWorker({sendMail, fetcher}){
  const source=fs.readFileSync(new URL('../apps/worker/src/index.ts',import.meta.url),'utf8').replace(/loop\(\)\.catch\(error=>\{console\.error\(error\);process\.exit\(1\)\}\);\s*$/, '');
  const js=ts.transpileModule(source,{fileName:'worker.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  const output=[];
  const transporter={sendMail};
  const requireMock=name=>{
    if(name==='nodemailer')return {default:{createTransport:()=>transporter},createTransport:()=>transporter};
    if(name==='./email-templates.js')return {renderProoflineEmail:payload=>({subject:'Support',text:'body',html:'<p>body</p>',category:'support_reply',templateId:'support-1',templateVersion:'1',family:'support'})};
    throw Error('Unexpected worker import '+name);
  };
  const wrapped=vm.runInNewContext('(function(require,module,exports){'+js+'\nmodule.exports={processJob,emailFailureCode};})',{
    Buffer,fetch:fetcher,console:{error:(...v)=>output.push(v.join(' ')),log:()=>{}},
    Date,Number,String,JSON,process:{env:{}},setTimeout,
  },{filename:'worker.compiled.cjs'});
  wrapped(requireMock,module,module.exports);
  return {...module.exports,output};
}

test('S5 real worker makes exactly one acknowledgement after accepted SMTP even if API is down',async()=>{
  let smtp=0,ack=0;const bodies=[];
  const worker=loadWorker({
    sendMail:async()=>{smtp++;return{messageId:'<smtp-confirmed@local>'};},
    fetcher:async(url,opts)=>{ack++;bodies.push(JSON.parse(opts.body));return{ok:false,status:503,text:async()=>"unavailable"};},
  });
  await worker.processJob({id:'email-1',type:'SEND_EMAIL',payload:standardPayload,lockedAt:leaseDate.toISOString()});
  assert.equal(smtp,1);assert.equal(ack,1);assert.equal(bodies[0].ok,true);
  assert.equal(bodies[0].result.messageId,'<smtp-confirmed@local>');
  assert.ok(worker.output.some(msg=>msg.includes('acknowledgement uncertain')));
});
test('S5 real worker marks SMTP 4xx rejection as temporary, with no second send',async()=>{
  let smtp=0;const bodies=[];
  const worker=loadWorker({
    sendMail:async()=>{smtp++;throw Object.assign(new Error('email private response'),{responseCode:451});},
    fetcher:async(url,opts)=>{bodies.push(JSON.parse(opts.body));return{ok:true};},
  });
  await worker.processJob({id:'email-1',type:'SEND_EMAIL',payload:standardPayload,lockedAt:leaseDate.toISOString()});
  assert.equal(smtp,1);assert.equal(bodies.length,1);
  assert.equal(bodies[0].ok,false);assert.equal(bodies[0].failureCode,'SMTP_TEMPORARY');
  assert.doesNotMatch(JSON.stringify(bodies),/private response|private@proofline/);
});
test('S5 real worker classifies SMTP timeouts as uncertain, not automatic retry',async()=>{
  const bodies=[];
  const worker=loadWorker({
    sendMail:async()=>{throw Object.assign(new Error('Connection timing'),{code:'ETIMEDOUT'});},
    fetcher:async(url,opts)=>{bodies.push(JSON.parse(opts.body));return{ok:true};},
  });
  await worker.processJob({id:'email-1',type:'SEND_EMAIL',payload:standardPayload,lockedAt:leaseDate.toISOString()});
  assert.equal(bodies[0].failureCode,'SMTP_UNCERTAIN');
});
