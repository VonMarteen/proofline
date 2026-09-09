import { NextResponse } from "next/server";
import { controlGet } from "../../../lib/api";
export async function GET(){try{return NextResponse.json(await controlGet("/v1/control/backoffice/notifications"))}catch(error){return NextResponse.json({count:0,critical:0,items:[],error:error instanceof Error?error.message:String(error)},{status:503})}}
