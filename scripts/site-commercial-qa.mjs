import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const fail = (message) => { throw new Error(message); };
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const ok = (label) => checks.push(label);

const required = [
  "apps/site/app/[locale]/page.tsx",
  "apps/site/app/[locale]/product/page.tsx",
  "apps/site/app/[locale]/solutions/page.tsx",
  "apps/site/app/[locale]/library/page.tsx",
  "apps/site/app/[locale]/trust/page.tsx",
  "apps/site/app/[locale]/start/page.tsx",
  "apps/site/app/[locale]/contact/page.tsx",
  "apps/site/public/brand/proofline-signal-network.png",
  "apps/site/public/brand/proofline-trust-shield.png",
  "apps/site/app/commercial-final-v6.css",
];
for (const rel of required) {
  if (!exists(rel)) fail(`Missing commercial asset/page: ${rel}`);
}
ok("required routes/assets");

const publicPages = ["solutions", "library", "trust", "start", "contact"]
  .map((name) => read(`apps/site/app/[locale]/${name}/page.tsx`))
  .join("\n");
if (/page-intro-note|mode-audience/.test(publicPages)) fail("Decorative secondary-page micro-copy remains in public commercial pages");
ok("no decorative page-intro micro-copy");

const trust = read("apps/site/app/[locale]/trust/page.tsx");
if (/Lo que el cliente debería poder revisar|What the client should be able to review/.test(trust)) fail("Repeated trust verification label remains");
if (!/trust-evidence-summary/.test(trust)) fail("Consolidated trust evidence summary is missing");
ok("trust evidence consolidated");

const homeCss = read("apps/site/app/commercial-home-v2.css");
const finalCss = read("apps/site/app/commercial-final-v6.css");
if (!/proofline-signal-network\.png/.test(finalCss)) fail("Final CTA does not reference signal network artwork");
if (!/proofline-signal-network\.png"\)\s+center right\s*\/\s*contain\s+no-repeat/.test(finalCss)) fail("CTA artwork is not configured with contain and right alignment");
if (!/proofline-signal-network\.png/.test(homeCss)) fail("Home CTA base artwork reference is missing");
ok("CTA artwork full-width contract");

const layout = read("apps/site/app/layout.tsx");
if (!/commercial-final-v6\.css/.test(layout)) fail("Final H6 stylesheet is not loaded last");
ok("H6 stylesheet loaded");

const navCss = finalCss;
if (!/html\[data-proofline-surface="site"\][\s\S]*scroll-behavior:\s*auto\s*!important/.test(navCss)) fail("Site route scrolling is not deterministic");
if (!/scrollbar-gutter:\s*stable/.test(navCss)) fail("Site header can still shift when scrollbar presence changes");
if (!/\.site-nav a::after[\s\S]*height:\s*2px[\s\S]*opacity:\s*0/.test(navCss)) fail("Navigation underline base state is missing");
if (!/\.site-nav a\.active::after[\s\S]*opacity:\s*1/.test(navCss)) fail("Active navigation underline is missing");
if (/\.site-nav a\.active\s*\{[^}]*background:\s*color-mix/.test(navCss)) fail("Navigation active state reverted to pill styling");
const siteNav = read("apps/site/components/site-nav.tsx");
if (!/useLayoutEffect[\s\S]*window\.scrollTo\(0, 0\)/.test(siteNav)) fail("Route changes do not reset scroll before paint");
ok("enterprise navigation is stable and deterministic");

const start = read("apps/site/app/[locale]/start/page.tsx");
if (/Redsys, PayPal o transferencia bancaria/.test(start)) fail("Start page still presents external payment rails as generally active");
ok("commercial claims remain bounded");

const cookie = read("apps/site/app/[locale]/cookies/page.tsx");
if (/PROOFLINE · PRIVACY/.test(cookie)) fail("Decorative cookie eyebrow remains");
ok("cookie page decorative eyebrow removed");

console.log(`[OK] PROOFLINE commercial QA H6 · checks=${checks.length} · pages=home+product+solutions+frameworks+trust+start+demo`);
for (const item of checks) console.log(`  [OK] ${item}`);
