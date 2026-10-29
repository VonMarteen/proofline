import nodemailer from "nodemailer";
import { renderProoflineEmail } from "./email-templates.js";

const api=process.env.API_INTERNAL_URL??"http://127.0.0.1:4201";
const analytics=process.env.ANALYTICS_URL??"http://127.0.0.1:4281";
const token=process.env.SERVICE_TOKEN??"proofline-local-service-token";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const serviceHeaders={"x-service-token":token,"content-type":"application/json"};

async function complete(id:string,body:Record<string,unknown>){await fetch(`${api}/v1/internal/jobs/${id}/complete`,{method:"POST",headers:serviceHeaders,body:JSON.stringify(body)}).then(async r=>{if(!r.ok)throw new Error(`complete failed ${r.status}: ${await r.text()}`)})}
async function sendEmail(payload:Record<string,unknown>){
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST??"127.0.0.1",port:Number(process.env.SMTP_PORT??4225),secure:false,connectionTimeout:30_000,greetingTimeout:30_000,socketTimeout:120_000});
  const attachments=Array.isArray(payload.attachments)?payload.attachments.map((item:any)=>({filename:String(item.filename),content:Buffer.from(String(item.contentBase64),"base64"),contentType:String(item.contentType??"application/octet-stream")})):undefined;
  const presentation=renderProoflineEmail(payload);
  const info=await transporter.sendMail({from:process.env.SMTP_FROM??"Proofline <no-reply@proofline.local>",to:String(payload.to),subject:presentation.subject,text:presentation.text,html:presentation.html,attachments});
  return{messageId:info.messageId,category:presentation.category,templateId:presentation.templateId,templateVersion:presentation.templateVersion,family:presentation.family,html:true,text:true};
}
async function runAnalysis(payload:Record<string,unknown>){const assessmentId=String(payload.assessmentId),analysisRunId=payload.analysisRunId?String(payload.analysisRunId):"";const qs=analysisRunId?`?analysisRunId=${encodeURIComponent(analysisRunId)}`:"";const data=await fetch(`${api}/v1/internal/analysis-payload/${assessmentId}${qs}`,{headers:{"x-service-token":token}}).then(async r=>{if(!r.ok)throw new Error(`payload failed ${r.status}: ${await r.text()}`);return r.json() as Promise<Record<string,unknown>>});const expectedSourceHash=typeof data.sourceHash==="string"?data.sourceHash:"";if(!/^[a-f0-9]{64}$/i.test(expectedSourceHash))throw new Error("analysis payload sourceHash missing or invalid; API runtime may be stale");const result=await fetch(`${analytics}/analyze`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}).then(async r=>{if(!r.ok)throw new Error(`analytics failed ${r.status}: ${await r.text()}`);return r.json() as Promise<Record<string,unknown>>});const returnedSourceHash=typeof result.sourceHash==="string"?result.sourceHash:"";if(returnedSourceHash!==expectedSourceHash)throw new Error(`analytics sourceHash mismatch; expected ${expectedSourceHash}, received ${returnedSourceHash||"<missing>"}`);const calculationHash=typeof result.calculationHash==="string"?result.calculationHash:"";if(!/^[a-f0-9]{64}$/i.test(calculationHash))throw new Error("analytics calculationHash missing or invalid");if(typeof result.assessmentId==="string"&&result.assessmentId!==assessmentId)throw new Error(`analytics assessmentId mismatch; expected ${assessmentId}, received ${result.assessmentId}`);return result}
// Only explicit SMTP 4xx rejections are safe for automatic retry. An SMTP timeout,
// connection error or interrupted acknowledgement may already have delivered a message.
function emailFailureCode(error: unknown): "SMTP_TEMPORARY" | "SMTP_PERMANENT" | "SMTP_UNCERTAIN" {
  const responseCode = error && typeof error === "object" && "responseCode" in error
    ? Number((error as { responseCode?: unknown }).responseCode) : NaN;
  if (responseCode >= 400 && responseCode < 500) return "SMTP_TEMPORARY";
  if (responseCode >= 500 && responseCode < 600) return "SMTP_PERMANENT";
  return "SMTP_UNCERTAIN";
}
async function processJob(job:any){
  const payload=(job.payload??{})as Record<string,unknown>;
  const claimToken=job.lockedAt ? new Date(job.lockedAt).toISOString() : undefined;
  let outcome: Record<string,unknown>;
  try {
    if(job.type==="RUN_ANALYSIS") outcome={ok:true,result:await runAnalysis(payload)};
    else if(job.type==="SEND_EMAIL") outcome={ok:true,result:await sendEmail(payload)};
    else outcome={ok:false,error:`Unknown job type ${job.type}`};
  } catch(error) {
    const message=error instanceof Error?error.message:"Unknown worker error";
    // Do not send exception text for mail (might contain an address/recipient).
    outcome=job.type==="SEND_EMAIL"
      ? {ok:false,failureCode:emailFailureCode(error),error:"SMTP delivery not confirmed"}
      : {ok:false,error:message};
    console.error(`[worker] ${job.type} processing failed: ${job.type==="SEND_EMAIL"?outcome.failureCode:message}`);
  }
  try {
    await complete(job.id,{...outcome,claimToken});
  } catch(error) {
    // CRITICAL: an API acknowledgement failure is NOT an SMTP failure.
    // Never acknowledge failure after an email may have been accepted.
    console.error(`[worker] job ${job.id} acknowledgement uncertain; no immediate replay: ${error instanceof Error?error.message:String(error)}`);
  }
}
async function recoverStaleEmailJobs(){
  const res=await fetch(`${api}/v1/internal/jobs/recover-stale-emails`,{method:"POST",headers:{"x-service-token":token}});
  if(!res.ok)throw new Error(`email recovery check ${res.status}: ${await res.text()}`);
  return res.json();
}
async function processSupportEscalations(){const res=await fetch(`${api}/v1/internal/support/escalate-due`,{method:"POST",headers:{"x-service-token":token}});if(!res.ok)throw new Error(`support escalation check ${res.status}: ${await res.text()}`);return res.json()}
async function loop(){
  console.log(`[worker] Proofline worker online; API=${api}; analytics=${analytics}`);
  let lastSupportCheck=0,lastEmailRecovery=0;
  while(true){
    try {
      if(Date.now()-lastEmailRecovery>60_000){
        lastEmailRecovery=Date.now();
        try {await recoverStaleEmailJobs();} catch(e) {console.error(`[worker] email recovery: ${e instanceof Error?e.message:String(e)}`);}
      }
      if(Date.now()-lastSupportCheck>60_000){
        lastSupportCheck=Date.now();
        try {await processSupportEscalations();} catch(e) {console.error(`[worker] SLA check: ${e instanceof Error?e.message:String(e)}`);}
      }
      const res=await fetch(`${api}/v1/internal/jobs/next`,{headers:{"x-service-token":token}});
      if(!res.ok)throw new Error(`job poll ${res.status}`);
      const job=await res.json();
      if(job)await processJob(job);
      else await sleep(1500);
    }catch(error){
      console.error(`[worker] poll error: ${error instanceof Error?error.message:String(error)}`);
      await sleep(3000);
    }
  }
}
loop().catch(error=>{console.error(error);process.exit(1)});
