/** P7 control rules. Server checks remain authoritative; UI is not an authorization boundary. */
export const CONTROL_LOCALES = ["es", "en"] as const;
export function requestedOrganizationLocale(value: unknown): "es" | "en" {
  if (value === "es" || value === "en") return value;
  throw new Error("Organization locale must be es or en");
}
export function organizationSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}
export function legalVersionInput(input: {version:unknown;locale:unknown;title:unknown;content:unknown}) {
  const version=typeof input.version==="string"?input.version.trim():"";
  const title=typeof input.title==="string"?input.title.trim():"";
  const content=typeof input.content==="string"?input.content.trim():"";
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version)) throw new Error("Invalid legal version");
  const locale=requestedOrganizationLocale(input.locale);
  if(title.length<5||title.length>180) throw new Error("Legal title must be 5–180 characters");
  if(content.length<30||content.length>100000) throw new Error("Legal content must be 30–100000 characters");
  return {version,locale,title,content};
}
export function legalPublishReason(value:unknown):string {
 const reason=typeof value==="string"?value.trim():"";
 if(reason.length<12||reason.length>500)throw new Error("Publication reason must be 12–500 characters");
 return reason;
}
