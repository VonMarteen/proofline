import { cookies } from "next/headers";
export async function controlSessionToken(){const jar=await cookies();return jar.get("proofline_control_session")?.value??""}
export async function controlIdentity(){const jar=await cookies();return{email:decodeURIComponent(jar.get("proofline_control_user")?.value??""),role:jar.get("proofline_control_role")?.value??"",name:decodeURIComponent(jar.get("proofline_control_name")?.value??"")}}
