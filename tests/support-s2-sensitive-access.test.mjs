import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReadAccountChanges, workspaceSupportTicketScope } from '../apps/api/src/support/workspace-support-visibility.ts';

const source = readFileSync(new URL('../apps/api/src/support/support.service.ts', import.meta.url), 'utf8');
const section = (from, to) => source.split(`async ${from}(`)[1]?.split(`async ${to}(`)[0] ?? '';
const ctx = (role, org = 'tenant-A') => ({
  organization: { id: org },
  capabilities: role === 'OWNER' || role === 'BILLING_ADMIN'
    ? ['support.use', 'account.change.request'] : ['support.use'],
});
const matches = (scope, row) => {
  if (scope.organizationId !== row.organizationId) return false;
  if (scope.AND?.some(x => x.category?.not === row.category ||
    (x.accountChangeRequest?.is === null && row.hasAccountChange))) return false;
  return true;
};
const tickets = [
  { id: 'general', organizationId: 'tenant-A', category: 'TECHNICAL', hasAccountChange: false },
  { id: 'contract', organizationId: 'tenant-A', category: 'ACCOUNT_CHANGE', hasAccountChange: true },
  { id: 'legacy', organizationId: 'tenant-A', category: 'TECHNICAL', hasAccountChange: true },
  { id: 'foreign', organizationId: 'tenant-B', category: 'TECHNICAL', hasAccountChange: false },
];

test('S2: permitted contractual roles retain access to account change tickets', () => {
  for (const role of ['OWNER', 'BILLING_ADMIN']) {
    assert.equal(canReadAccountChanges(ctx(role)), true);
    assert.deepEqual(tickets.filter(t => matches(workspaceSupportTicketScope(ctx(role)), t)).map(t => t.id), ['general','contract','legacy']);
  }
});
test('S2: other support roles cannot read contract category or legacy linked account-change tickets', () => {
  for (const role of ['ADMIN','ASSESSMENT_MANAGER','REVIEWER','ANALYST','VIEWER','PARTNER_ADMIN']) {
    assert.equal(canReadAccountChanges(ctx(role)), false);
    assert.deepEqual(tickets.filter(t => matches(workspaceSupportTicketScope(ctx(role)), t)).map(t => t.id), ['general']);
  }
});
test('S2: tenant isolation remains for privileged and unprivileged roles', () => {
  for (const role of ['OWNER','VIEWER']) assert.equal(matches(workspaceSupportTicketScope(ctx(role)), tickets[3]), false);
});
test('S2: queue pages, filtering, pagination, counters and unread share same scoped WHERE', () => {
  const body = section('workspaceQueuePage','workspaceQueue');
  assert.match(body, /const where:any=workspaceSupportTicketScope\(ctx\)/);
  assert.match(body, /supportTicket\.count\(\{where\}\)/);
  assert.match(body, /findMany\(\{where,skip:pg\.skip,take:pg\.take/);
  assert.match(body, /where:\{\.\.\.workspaceSupportTicketScope\(ctx\),status:/);
  assert.match(body, /findMany\(\{where:workspaceSupportTicketScope\(ctx\),select:/);
  assert.match(body, /canReadAccountChanges\(ctx\)\?this\.db\.accountChangeRequest/);
});
test('S2: legacy queue uses same access policy and hides account change list when forbidden', () => {
  const body=section('workspaceQueue','workspaceTicket');
  assert.match(body, /where: workspaceSupportTicketScope\(ctx\)/);
  assert.match(body, /canReadAccountChanges\(ctx\) \? this\.db\.accountChangeRequest/);
  assert.match(body, /Promise\.resolve\(\[\]\)/);
});
test('S2: direct ID ticket read and mark-as-read reject tickets outside authorized scope', () => {
  for (const name of ['workspaceTicket','markWorkspaceTicketRead']) {
    const body=section(name,name==='workspaceTicket'?'markWorkspaceTicketRead':'createWorkspaceTicket');
    assert.match(body, /where: \{ id, \.\.\.workspaceSupportTicketScope\(ctx\) \}/);
    assert.match(body, /NotFoundException\("Support ticket not found"\)/);
  }
});
test('S2: POST customer reply and upload require same tenant-and-category policy', () => {
  assert.match(section('addWorkspaceMessage','uploadWorkspaceDocument'), /where: \{ id: ticketId, \.\.\.workspaceSupportTicketScope\(ctx\) \}/);
  assert.match(section('uploadWorkspaceDocument','workspaceAttachment'), /ticket: workspaceSupportTicketScope\(ctx\)/);
});
test('S2: document view and download enforce nested ticket access before audit and blob response', () => {
  assert.match(section('workspaceAttachment','internalAttachment'), /ticket: workspaceSupportTicketScope\(ctx\)/);
});
test('S2: duplicate error hints do not disclose account-change ticket subjects to general support requesters', () => {
  assert.match(section('guardNewTicket','workspaceQueuePage'), /input\.category!=="ACCOUNT_CHANGE"\?\{AND:\[/);
  assert.match(section('guardNewTicket','workspaceQueuePage'), /accountChangeRequest:\{is:null\}/);
});
test('S2: no changes to Control/internal policy or user role capabilities', () => {
  const access=readFileSync(new URL('../apps/api/src/auth/access-control.ts',import.meta.url),'utf8');
  assert.match(access,/BILLING_ADMIN:.*"account\.change\.request"/);
  assert.match(access,/OWNER:.*"account\.change\.request"/);
  assert.doesNotMatch(access,/VIEWER:.*"account\.change\.request"/);
});
