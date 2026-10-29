import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const badRequest = class BadRequestException extends Error {};
const conflict = class ConflictException extends Error {};
const serviceSource = read('apps/api/src/reports/report.service.ts');
const decorators = { Injectable: () => (x) => x, Inject: () => () => {}, BadRequestException: badRequest, ConflictException: conflict, NotFoundException: class extends Error {} };
function load() {
  const m = { exports: {} };
  const code = ts.transpileModule(serviceSource, { fileName: 'report.service.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Date, Buffer, Promise, Object, Number, Array, Map, Set, String }, { filename: 'report.service.ts' })(
    (name) => ({ '@nestjs/common': decorators, '../security/crypto.js': { decryptText: x => x }, './report-contract.js': { normalizeReportLevel: x => x, reportLevelLabel: x => x } }[name] ?? {}), m, m.exports
  );
  return m.exports.ReportService;
}
const ReportService = load();
function fixture({ prior = [], failOnQueue = false } = {}) {
  const report = { id: 'r1', status: 'APPROVED', updatedAt: new Date('2026-10-20'), distributedAt: prior.length ? new Date('2026-10-21') : null, assessmentId: 'a1', snapshotHash: 'a'.repeat(64), level: 'L2_DIAGNOSTIC', version: 2, assessment: { organizationId: 'o1', title: 'Workplace', organization: { name: 'ACME', legalName: 'ACME SL' } } };
  const recipients = [1,2,3].map(n => ({ id: `u${n}`, active: true, locale: 'es', emailEncrypted: `encrypted-${n}`, displayName: `Recipient ${n}` }));
  const state = { deliveries: prior.map(x=>({ ...x, recipient: recipients.find(r=>r.id===x.recipientId) })), outbox: [], audit: [] };
  const tx = {
    resultRecipient: { findMany: async () => recipients.filter(x=>x.active) },
    report: { updateMany: async ({ where, data }) => { if (where.id !== report.id || where.status !== report.status || (where.updatedAt && Number(where.updatedAt) !== Number(report.updatedAt))) return { count:0 }; Object.assign(report,data); return { count:1 }; } },
    reportDelivery: {
      count: async ({ where }) => state.deliveries.filter(d => d.reportId === where.reportId && (!where.status || d.status === where.status)).length,
      findMany: async ({ where }) => state.deliveries.filter(d => d.reportId === where.reportId && d.status === where.status),
      create: async ({ data }) => { const row={...data,id:`d${state.deliveries.length+1}`,status:'PENDING'};state.deliveries.push(row);return row; },
      updateMany: async ({ where, data }) => { const row=state.deliveries.find(d=>d.id===where.id && d.reportId===where.reportId && d.status===where.status);if(!row)return {count:0};Object.assign(row,data);return {count:1}; },
    },
    outboxEvent: { create: async ({ data }) => { if (failOnQueue && state.outbox.length === 1) throw new Error('Injected outbox failure');state.outbox.push(data);return data; } },
    auditEvent: { create: async ({data}) => { state.audit.push(data);return data; } },
  };
  const db = { ...tx, $transaction: async (fn) => {
    const before = { distributedAt: report.distributedAt, updatedAt: report.updatedAt, deliveries: structuredClone(state.deliveries), outbox: structuredClone(state.outbox), audit: structuredClone(state.audit) };
    try { return await fn(tx); } catch (e) { report.distributedAt=before.distributedAt;report.updatedAt=before.updatedAt;Object.assign(state,{deliveries:before.deliveries,outbox:before.outbox,audit:before.audit});throw e; }
  }};
  const svc = new ReportService(db, {});
  svc.get = async () => ({...report});
  svc.pdf = async () => Buffer.from('%PDF-test');
  return { svc, db, state, report, recipients };
}

test('WS-3: first distribution commits all deliveries, outbox jobs and audit once', async () => {
  const f=fixture();const result=await f.svc.distribute('r1','owner@local');
  assert.equal(result.queued,3);assert.equal(f.state.deliveries.length,3);
  assert.equal(f.state.outbox.length,3);assert.equal(f.state.audit.length,1);
  assert.equal(f.report.status,'APPROVED');assert.equal(f.report.distributedAt,null);assert.ok(f.report.updatedAt > new Date('2026-10-20'));
  assert.deepEqual(f.state.outbox.map(x=>x.payload.reportDeliveryId),['d1','d2','d3']);
  assert.ok(!JSON.stringify(f.state.audit).includes('encrypted-'));
  await assert.rejects(f.svc.distribute('r1'),conflict);
  assert.equal(f.state.outbox.length,3);
});

test('WS-3: transactional failure leaves no partial delivery, job, audit or distribution marker', async () => {
  const f=fixture({failOnQueue:true});
  await assert.rejects(f.svc.distribute('r1'),/Injected outbox failure/);
  assert.equal(f.state.outbox.length,0);assert.equal(f.state.deliveries.length,0);
  assert.equal(f.state.audit.length,0);assert.equal(f.report.distributedAt,null);assert.equal(f.report.updatedAt.getTime(),new Date('2026-10-20').getTime());
});

test('WS-3: prior deliveries from legacy versions reject duplicate queueing', async () => {
  const f=fixture({prior:[{id:'d0',reportId:'r1',recipientId:'u1',status:'SENT'}]});
  f.report.distributedAt=null; // historical report queued without the new marker
  await assert.rejects(f.svc.distribute('r1'),conflict);
  assert.equal(f.report.distributedAt,null);
  assert.equal(f.state.outbox.length,0);
});

test('WS-3: retry targets FAILED only and keeps successful delivery evidence', async () => {
  const f=fixture({prior:[
    {id:'d1',reportId:'r1',recipientId:'u1',status:'SENT',sentAt:new Date('2026-10-21')},
    {id:'d2',reportId:'r1',recipientId:'u2',status:'FAILED',error:'SMTP temporarily down'},
    {id:'d3',reportId:'r1',recipientId:'u3',status:'FAILED',error:'SMTP temporarily down'},
  ]});
  const result=await f.svc.retryFailedDeliveries('r1','owner@local');
  assert.equal(result.queued,2);assert.equal(result.failedOnly,true);
  assert.equal(f.state.outbox.length,2);
  assert.deepEqual(f.state.outbox.map(x=>x.payload.reportDeliveryId),['d2','d3']);
  assert.equal(f.state.deliveries[0].status,'SENT');
  assert.equal(f.state.deliveries[1].status,'PENDING');
  assert.equal(f.state.audit[0].action,'REPORT_FAILED_DELIVERIES_RETRY_QUEUED');
  await assert.rejects(f.svc.retryFailedDeliveries('r1'),conflict);
  assert.equal(f.state.outbox.length,2);
});

test('WS-3: pending jobs block retry and no failed jobs are not retried', async () => {
  const pending=fixture({prior:[{id:'d1',reportId:'r1',recipientId:'u1',status:'PENDING'},{id:'d2',reportId:'r1',recipientId:'u2',status:'FAILED'}]});
  await assert.rejects(pending.svc.retryFailedDeliveries('r1'),conflict);
  const nofailed=fixture({prior:[{id:'d1',reportId:'r1',recipientId:'u1',status:'SENT'}]});
  await assert.rejects(nofailed.svc.retryFailedDeliveries('r1'),badRequest);
  assert.equal(nofailed.state.outbox.length,0);
});

test('WS-3: only report-distribution capability may request failed-only retry', () => {
  const controller=read('apps/api/src/reports/reports.controller.ts');
  const route=controller.split('@Post("reports/:id/retry-failed")')[1]?.split('@Get("reports/:id/view")')[0] ?? '';
  assert.match(route,/requireCapability\(this\.db, req, "reports\.distribute", report\.assessmentId\)/);
  assert.match(route,/this\.reports\.retryFailedDeliveries/);
  const manager=read('apps/web/components/report-manager.tsx');
  assert.match(manager,/failed > 0 && pending === 0/);
  assert.match(manager,/!alreadyRequested/);
  assert.match(manager,/\/retry-failed/);
  assert.doesNotMatch(manager,/report\.deliveries\.forEach\(.*send/);
});

test('WS-3: concurrent distribution attempts cannot create duplicate email jobs', async () => {
  const f=fixture();
  const results=await Promise.allSettled([f.svc.distribute('r1'),f.svc.distribute('r1')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal(f.state.outbox.length,3);
  assert.equal(f.state.audit.length,1);
});

test('WS-3: inactive recipient blocks failed delivery retry without creating any jobs', async () => {
  const f=fixture({prior:[{id:'d1',reportId:'r1',recipientId:'u1',status:'FAILED'}]});
  f.state.deliveries[0].recipient.active=false;
  await assert.rejects(f.svc.retryFailedDeliveries('r1'),conflict);
  assert.equal(f.state.outbox.length,0);
  assert.equal(f.state.deliveries[0].status,'FAILED');
});
