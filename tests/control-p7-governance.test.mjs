import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestedOrganizationLocale,organizationSearch,legalVersionInput,legalPublishReason} from '../apps/api/src/control/p7-policy.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('P7 locales: strict values, no injected preferences',()=>{
 assert.equal(requestedOrganizationLocale('es'),'es');assert.equal(requestedOrganizationLocale('en'),'en');
 for(const x of ['ES','fr','es;DROP',null,0])assert.throws(()=>requestedOrganizationLocale(x));
 assert.equal(organizationSearch('  Demo '),'Demo');assert.equal(organizationSearch('x'.repeat(1000)).length,80);
});
test('P7 legal draft policy rejects missing, unsupported or excessive contents',()=>{
 assert.deepEqual(legalVersionInput({version:' v2.3 ',locale:'en',title:' Terms 2026 ',content:' Real terms for the product and its customers. '}),{version:'v2.3',locale:'en',title:'Terms 2026',content:'Real terms for the product and its customers.'});
 for(const fields of [{version:'bad version'},{locale:'fr'},{title:'a'},{content:'tiny'},{version:'a'.repeat(41)}])assert.throws(()=>legalVersionInput({version:'v2.4',locale:'es',title:'Real title',content:'A meaningful legal document with enough content.',...fields}));
});
test('P7 publication requires meaningful reason, not an empty approval',()=>{
 assert.equal(legalPublishReason('  Approved after counsel review  '),'Approved after counsel review');
 for(const x of ['', 'ok', ' '.repeat(30), 'x'.repeat(501), null])assert.throws(()=>legalPublishReason(x));
});
test('P7 server RBAC enforces owner locale changes and owner-only publication',()=>{
 const s=read('apps/api/src/control/control.service.ts');
 assert.match(s,/updateOrganizationLocale\([\s\S]*?requireInternalCapability\(req,"configuration\.manage"\)/);
 assert.match(s,/publishLegalVersion\([\s\S]*?requireInternalCapability\(req,"legal\.publish"\)/);
 assert.match(s,/createLegalVersion\([\s\S]*?requireInternalCapability\(req,"legal\.manage"\)/);
 const grants=read('apps/api/src/control/internal-access.ts');
 assert.match(grants,/INTERNAL_PLATFORM_OWNER: \["\*"\]/);
 assert.ok(!grants.split('INTERNAL_TRUST:')[1].split('INTERNAL_SUPPORT:')[0].includes('legal.publish'));
});
test('P7 audited persistent locale mutations occur transactionally',()=>{
 const s=read('apps/api/src/control/control.service.ts');
 const segment=s.split('async updateOrganizationLocale(')[1].split('governance(req:')[0];
 assert.match(segment,/\$transaction\(async tx/);
 assert.match(segment,/tx\.organization\.update/);
 assert.match(segment,/tx\.auditEvent\.create/);
 assert.match(segment,/CONTROL_ORGANIZATION_DEFAULT_LOCALE_CHANGED/);
 assert.match(read('apps/api/src/billing/invoice-documents.service.ts'),/invoice\.organization\.defaultLocale/);
});
test('P7 legal draft and publication are versioned, hashed and transactionally audited',()=>{
 const s=read('apps/api/src/control/control.service.ts');
 const draft=s.split('async createLegalVersion(')[1].split('async publishLegalVersion(')[0];
 const publish=s.split('async publishLegalVersion(')[1].split('async updateTicketStatus(')[0];
 assert.match(draft,/createHash\("sha256"\)/);
 assert.match(draft,/active:false/);
 assert.match(draft,/tx\.auditEvent\.create/);
 assert.match(publish,/tx\.legalDocumentVersion\.updateMany/);
 assert.match(publish,/tx\.legalDocumentVersion\.update/);
 assert.match(publish,/tx\.auditEvent\.create/);
 assert.match(publish,/isolationLevel:"Serializable"/);
 assert.match(publish,/contentHash:result\.contentHash/);
});
test('P7 legal acceptance requires a published version, locale and future-date gate',()=>{
 const l=read('apps/api/src/legal/legal.controller.ts');
 assert.match(l,/!version\.active/);
 assert.match(l,/version\.locale!==value\.locale/);
 assert.match(l,/version\.effectiveAt>new Date\(\)/);
 assert.match(l,/tx\.legalInteraction\.create/);
 assert.match(l,/tx\.auditEvent\.create/);
});
test('P7 guarded routes and real actions connect all four control surfaces',()=>{
 const controller=read('apps/api/src/control/control.controller.ts');
 for(const endpoint of ['@Get("governance/roles")','@Post("configuration/organizations/:id/locale")','@Post("legal/documents/:id/versions")','@Post("legal/versions/:id/publish")']) assert.ok(controller.includes(endpoint));
 const actions=read('apps/control/app/actions.ts');
 for(const action of ['updateOrganizationDefaultLocale','createLegalDocumentDraft','publishLegalDocumentVersion'])assert.ok(actions.includes(`export async function ${action}`));
 const config=read('apps/control/app/[locale]/configuration/page.tsx');
 assert.match(config,/updateOrganizationDefaultLocale/);assert.match(config,/organizationTotal/);
 const legal=read('apps/control/app/[locale]/legal/page.tsx');
 assert.match(legal,/createLegalDocumentDraft/);assert.match(legal,/publishLegalDocumentVersion/);
 assert.match(legal,/canPublish=identity\.role===/);
});
test('P7 responsive, ES EN, confirmations and security capability UI',()=>{
 const styles=read('apps/control/app/backoffice.css');
 assert.match(styles,/@media\(max-width:760px\)/);
 const legal=read('apps/control/app/[locale]/legal/page.tsx');
 assert.match(legal,/data-confirm-title=/);
 const security=read('apps/control/app/[locale]/security/page.tsx');
 assert.match(security,/governance\/roles/);assert.match(security,/identity\.role==='INTERNAL_PLATFORM_OWNER'/);
 const privacy=read('apps/control/app/[locale]/privacy/page.tsx');
 assert.match(privacy,/data-confirm-tone="danger"/);
});

test('P7 does not break the existing Control runtime configuration contract',()=>{
 const source=read('apps/api/src/control/control.service.ts');
 const block=source.split('async configuration(')[1].split('async updateOrganizationLocale(')[0];
 for(const property of ['plans','entitlements','brandingPolicy','defaults','organizations'])assert.ok(block.includes(property));
 const runtime=read('apps/api/src/control-runtime-check.ts');
 assert.match(runtime,/configuration\?\.entitlements/);
});
