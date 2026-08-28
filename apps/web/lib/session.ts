import { cookies } from "next/headers";
export async function workspaceSessionToken(){const jar=await cookies();return jar.get("proofline_workspace_session")?.value??""}
export async function workspaceIdentity(){const jar=await cookies();return{email:decodeURIComponent(jar.get("proofline_workspace_user")?.value??""),role:jar.get("proofline_workspace_role")?.value??"",name:decodeURIComponent(jar.get("proofline_workspace_name")?.value??""),organizationId:jar.get("proofline_workspace_org")?.value??""}}
