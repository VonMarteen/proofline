import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const serviceFile=new URL("../apps/api/src/control/control.service.ts",import.meta.url);
const source=readFileSync(serviceFile,"utf8");
const file=ts.createSourceFile("control.service.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const klass=file.statements.find(x=>ts.isClassDeclaration(x)&&x.name?.text==="ControlService");
assert.ok(klass,"ControlService source must exist");

function methodFor(name,db,allowed){
  const method=klass.members.find(m=>ts.isMethodDeclaration(m)&&m.name.getText(file)===name);
  assert.ok(method,`Missing method ${name}`);
  const isolated=`class TestControl {${method.getText(file)}}; globalThis.instance=new TestControl();`;
  const js=ts.transpileModule(isolated,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const parse=input=>{
    const page=Math.max(1,Number.parseInt(String(input.page??"1"),10)||1),size=[25,50,100].includes(Number(input.pageSize))?Number(input.pageSize):25;
    return {page,pageSize:size,skip:(page-1)*size,take:size};
  };
  const clamped=(total,input)=>{
    const p=parse(input),page=Math.min(p.page,Math.max(1,Math.ceil(total/p.pageSize)));
    return {...p,page,skip:(page-1)*p.pageSize};
  };
  const ctx={db,requireInternalCapability:(_req,cap)=>{if(cap!==allowed)throw Error("403: Forbidden")},parsePagination:parse,clampedPagination:clamped,paged:(items,total,page,pageSize)=>({items,pagination:{total,page,pageSize}})};
  vm.runInNewContext(js,ctx,{timeout:1000});
  return (input)=>ctx.instance[name].call({db},null,input);
}

function store(items){
  const calls=[];
  const model={
    count:async args=>{calls.push({type:"count",...args});return items.length},
    findMany:async args=>{calls.push({type:"find",...args});return items.slice(args.skip,args.skip+args.take)},
  };
  return {model,calls};
}

for(const [fn,model,permission] of [
  ["legalRecordsPage","documentRecord","legal.read"],
  ["legalInteractionsPage","legalInteraction","legal.read"],
  ["securityEventsPage","auditEvent","security.read"],
]){
 test(`UX-A3 executed ${fn} passes one where to DB count and page window`,async()=>{
   const entries=Array.from({length:57},(_,i)=>({id:String(i)})),{model:fake,calls}=store(entries);
   const run=methodFor(fn,{[model]:fake},permission);
   const res=await run({q:" Alba ",page:"999",pageSize:"25"});
   assert.equal(res.pagination.total,57);
   assert.equal(res.pagination.page,3);
   assert.equal(res.items.length,7);
   assert.equal(res.items[0].id,"50");
   assert.equal(calls.length,2);
   assert.equal(calls[1].skip,50);
   assert.equal(calls[1].take,25);
   assert.equal(JSON.stringify(calls[0].where),JSON.stringify(calls[1].where));
   assert.equal(JSON.stringify(calls[1].orderBy),JSON.stringify([{createdAt:"desc"},{id:"asc"}]));
 });
}

test("UX-A3 security events retain privilege scope even with search",async()=>{
 const {model,calls}=store([]);
 const run=methodFor("securityEventsPage",{auditEvent:model},"security.read");
 await run({q:"ROLE"});
 const where=calls[0].where;
 assert.equal(where.AND.length,2);
 assert.equal(where.AND[0].OR[0].actorType,"INTERNAL");
 assert.ok(where.AND[0].OR.some(x=>x.action?.contains==="ACCESS"));
 assert.ok(where.AND[1].OR.some(x=>x.action?.contains==="ROLE"));
});

test("UX-A3 invalid legal filter enum cannot be passed into query",async()=>{
 const {model,calls}=store([]);
 const run=methodFor("legalRecordsPage",{documentRecord:model},"legal.read");
 await run({status:"INJECTED",recordClass:" REPORT ",pageSize:"800"});
 assert.equal(calls[0].where.status,undefined);
 assert.equal(calls[0].where.recordClass,"REPORT");
 assert.equal(calls[1].take,25);
});
