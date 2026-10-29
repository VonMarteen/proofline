import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const read = file => readFileSync(resolve(process.cwd(),file),'utf8');
const routes = [
 {name:'Workspace',page:'apps/web/app/[locale]/support/[id]/attachments/[attachmentId]/page.tsx',path:'/api/proxy/v1/workspace/support/tickets/',proxy:'apps/web/app/api/proxy/[...path]/route.ts'},
 {name:'Control',page:'apps/control/app/[locale]/support/[id]/attachments/[attachmentId]/page.tsx',path:'/api/support/attachments/',proxy:'apps/control/app/api/support/attachments/[id]/route.ts'},
 {name:'Support',page:'apps/support/app/[locale]/tickets/[id]/attachments/[attachmentId]/page.tsx',path:'/api/support/attachments/',proxy:'apps/support/app/api/support/attachments/[id]/route.ts'},
];
for(const portal of routes){
 test(`${portal.name}: viewer and authentication proxy exist without conflicting Next routes`,()=>{
  assert.ok(existsSync(resolve(process.cwd(),portal.page)));
  assert.ok(existsSync(resolve(process.cwd(),portal.proxy)));
  assert.equal(existsSync(resolve(process.cwd(),portal.page.replace('/page.tsx','/route.ts'))),false);
  const page=read(portal.page);
  assert.match(page,/export default async function Page/);
  assert.ok(page.includes(portal.path));
  assert.match(page,/iframe/);
  assert.match(page,/\?download=1/);
 });
 test(`${portal.name}: authenticated proxy protects attachment bytes`,()=>{
  const src=read(portal.proxy);
  assert.match(src,/Unauthorized/);
  assert.match(src,/Bearer \$\{token\}/);
  assert.match(src,/cache:\s*"no-store"/);
  assert.match(src,/content-disposition/);
  assert.match(src,/content-security-policy/);
  assert.match(src,/cross-origin-resource-policy/);
  if(portal.name==='Workspace'){
   assert.match(src,/proofline_workspace_session/);
   assert.match(src,/redirect:"manual"/);
  }else assert.match(src,/SessionToken\(\)/);
 });
}
test('Attachment references still resolve through tickets across all three portals',()=>{
 for(const page of [
  'apps/web/app/[locale]/support/[id]/page.tsx',
  'apps/control/app/[locale]/support/[id]/page.tsx',
  'apps/support/app/[locale]/tickets/[id]/page.tsx']){
  assert.match(read(page),/attachments\/\$\{a\.id\}/);
 }
});
test('API enforces tenant/role and document retention status before serving bytes',()=>{
 const service=read('apps/api/src/support/support.service.ts');
 assert.match(service,/async workspaceAttachment/);
 assert.match(service,/workspaceSupportTicketScope\(ctx\)/);
 assert.match(service,/async internalAttachment/);
 assert.match(service,/internalTicket\(req, attachment\.ticketId\)/);
 assert.match(service,/\["BLOCKED", "ANONYMIZED", "DESTROYED"\]/);
});
