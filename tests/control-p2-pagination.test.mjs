import test from "node:test";
import assert from "node:assert/strict";
import { parsePagination, clampedPagination, paged } from "../apps/api/src/common/pagination.ts";

test("P2: page sizes are 25/50/100 and default to 25",()=>{
  for(const n of [25,50,100])assert.equal(parsePagination({pageSize:String(n)}).pageSize,n);
  for(const n of [0,24,26,101,999,-1,Number.NaN])assert.equal(parsePagination({pageSize:String(n)}).pageSize,25);
});
test("P2: counts 0/25/26/100/101/1000 return safe DB windows",()=>{
  for(const total of [0,25,26,100,101,1000]){
    for(const size of [25,50,100]){
      const pages=Math.max(1,Math.ceil(total/size));
      for(const requested of [1,2,pages,pages+1,9999]){
        const v=clampedPagination(total,{page:requested,pageSize:size});
        assert.equal(v.page,Math.min(requested,pages));
        assert.equal(v.take,size);
        assert.ok(v.skip>=0);
        assert.equal(v.skip,(v.page-1)*size);
        assert.ok(total===0||v.skip<total);
        const p=paged([],total,v.page,size).pagination;
        assert.equal(p.page,v.page);
        assert.equal(p.hasNext,v.page<pages);
      }
    }
  }
});
test("P2: malformed or negative pages never cause negative offsets",()=>{
  for(const page of [-50,0,"wrong",Infinity,Number.NaN])assert.equal(clampedPagination(101,{page,pageSize:25}).skip,0);
});
