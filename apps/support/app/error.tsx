"use client";
import { AppErrorBoundary } from "@proofline/ui/client";

export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <AppErrorBoundary error={error} reset={reset}/>;}
