import { cookies } from "next/headers";
export async function supportSessionToken(){const jar=await cookies();return jar.get("proofline_support_session")?.value??""}
export async function supportIdentity(){const jar=await cookies();return{email:decodeURIComponent(jar.get("proofline_support_user")?.value??""),role:jar.get("proofline_support_role")?.value??"",name:decodeURIComponent(jar.get("proofline_support_name")?.value??"")}}
export function isSupportRole(role:string){return role==="INTERNAL_SUPPORT"||role==="INTERNAL_PLATFORM_OWNER"}
