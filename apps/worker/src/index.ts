import nodemailer from "nodemailer";

const api = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
const analytics = process.env.ANALYTICS_URL ?? "http://127.0.0.1:58100";
const token = process.env.SERVICE_TOKEN ?? "proofline-local-service-token";
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const serviceHeaders={"x-service-token":token,"content-type":"application/json"};

async function complete(id:string, body:Record<string,unknown>){
 await fetch(`${api}/v1/internal/jobs/${id}/complete`,{method:"POST",headers:serviceHeaders,body:JSON.stringify(body)}).then(async r=>{if(!r.ok) throw new Error(`complete failed ${r.status}: ${await r.text()}`)});
}
async function sendEmail(payload:Record<string,unknown>){
 const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST??"127.0.0.1",port:Number(process.env.SMTP_PORT??51025),secure:false});
 const attachments=Array.isArray(payload.attachments)?payload.attachments.map((item:any)=>({filename:String(item.filename),content:Buffer.from(String(item.contentBase64),"base64"),contentType:String(item.contentType??"application/octet-stream")})):undefined;
 const info=await transporter.sendMail({from:process.env.SMTP_FROM??"Proofline <no-reply@proofline.local>",to:String(payload.to),subject:String(payload.subject),text:String(payload.text),attachments});
 return {messageId:info.messageId};
}
async function runAnalysis(payload:Record<string,unknown>){
 const assessmentId=String(payload.assessmentId);
 const data=await fetch(`${api}/v1/internal/analysis-payload/${assessmentId}`,{headers:{"x-service-token":token}}).then(async r=>{if(!r.ok)throw new Error(`payload failed ${r.status}`);return r.json()});
 const result=await fetch(`${analytics}/analyze`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}).then(async r=>{if(!r.ok)throw new Error(`analytics failed ${r.status}: ${await r.text()}`);return r.json()});
 return result;
}
async function processJob(job:any){
 try{
  const payload=(job.payload??{}) as Record<string,unknown>;
  if(job.type==="RUN_ANALYSIS") return await complete(job.id,{ok:true,result:await runAnalysis(payload)});
  if(job.type==="SEND_EMAIL") return await complete(job.id,{ok:true,result:await sendEmail(payload)});
  return await complete(job.id,{ok:false,error:`Unknown job type ${job.type}`});
 }catch(error){
  const message=error instanceof Error?error.message:"Unknown worker error";
  console.error(`[worker] ${job.type} failed: ${message}`);
  await complete(job.id,{ok:false,error:message}).catch(()=>undefined);
 }
}
async function processSupportEscalations(){
 const res=await fetch(`${api}/v1/internal/support/escalate-due`,{method:"POST",headers:{"x-service-token":token}});
 if(!res.ok) throw new Error(`support escalation check ${res.status}: ${await res.text()}`);
 return res.json();
}
async function loop(){
 console.log(`[worker] Proofline worker online; API=${api}; analytics=${analytics}`);
 let lastSupportCheck=0;
 while(true){
  try{
   if(Date.now()-lastSupportCheck>60_000){await processSupportEscalations();lastSupportCheck=Date.now();}
   const res=await fetch(`${api}/v1/internal/jobs/next`,{headers:{"x-service-token":token}});
   if(!res.ok) throw new Error(`job poll ${res.status}`);
   const job=await res.json();
   if(job) await processJob(job); else await sleep(1500);
  }catch(error){ console.error(`[worker] poll error: ${error instanceof Error?error.message:String(error)}`); await sleep(3000); }
 }
}
loop().catch(error=>{console.error(error);process.exit(1)});
