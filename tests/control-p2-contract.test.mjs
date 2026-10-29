import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
const src=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),"utf8");

test("P2 operational listing endpoints keep RBAC and bounded DB queries",()=>{
  const controller=src("apps/api/src/control/control.controller.ts");
  const service=src("apps/api/src/control/control.service.ts");
  for(const [key,permission,model] of [
    ["marketplacePage","marketplace.read","framework"],
    ["entitlementsPage","configuration.read","entitlement"],
    ["internalUsersPage","security.read","internalUser"],
  ]){
    assert.ok(controller.includes(`this.service.${key}(req,`),`${key}: route connected`);
    const begin=service.indexOf(`async ${key}(`);
    assert.ok(begin>0,`${key}: service method exists`);
    const end=service.indexOf("\n  async ",begin+1);
    const body=service.slice(begin,end<0?undefined:end);
    assert.ok(body.includes(`requireInternalCapability(req,"${permission}")`)||body.includes(`requireInternalCapability(req, "${permission}")`),`${key}: RBAC`);
    assert.ok(body.includes("clampedPagination(total,input)"),`${key}: pagination bounds`);
    assert.ok(body.includes(`this.db.${model}.findMany({where,skip:pg.skip,take:pg.take`),`${key}: DB limit applied`);
  }
});

test("P2 does not expose internal password or sessions tokens in API listing",()=>{
  const service=src("apps/api/src/control/control.service.ts");
  const section=service.split("async internalUsersPage(")[1].split("\n  async marketplace(")[0];
  assert.ok(section.includes("select:{id:true,email:true,displayName:true,role:true,status:true,lastLoginAt:true"));
  assert.ok(!section.includes("passwordHash"));
  assert.ok(!section.includes("tokenHash"));
});

test("P2 tables are server-powered and preserve 25/50/100 pagination navigation",()=>{
  for(const table of ["marketplace","plans","internal-users"]){
    const page=src(`apps/control/app/[locale]/${table}/page.tsx`);
    assert.ok(page.includes("PaginationBar"),`${table}: pagination UI`);
    assert.ok(page.includes("control-table-empty"),`${table}: empty state`);
    assert.ok(page.includes('name="pageSize"'),`${table}: selected rows preserved`);
  }
});
