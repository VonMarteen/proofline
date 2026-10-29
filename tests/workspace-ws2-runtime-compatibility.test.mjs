import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../apps/api/src/runtime-check.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("../apps/api/src/workspace.controller.ts", import.meta.url), "utf8");

test("WS-2: runtime framework creation passes the required request payload", () => {
  assert.match(runtime, /workspace\.start\(ownerReq,framework\.id,\{level:"L2"\}\)/);
  assert.doesNotMatch(runtime, /workspace\.start\(ownerReq,framework\.id\)/);
});

test("WS-2: framework creation accepts L2 and preserves default-level compatibility", () => {
  assert.match(controller, /@Post\("frameworks\/:id\/start"\)\s*async start\([\s\S]*?@Body\(\)b:unknown\)/);
  assert.match(controller, /z\.enum\(\["L1","L2","L3","L4"\]\)\.default\("L2"\)/);
});
