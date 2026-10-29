import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";

const root = process.cwd();
const infraOnly = process.argv.includes("--infra");
const reserved = [
  [4200,"Web/Site"],[4201,"API"],[4202,"Workspace"],[4203,"Respond"],[4204,"Control"],[4205,"Support"],[4206,"Control API"],
  [4225,"Mailpit SMTP"],[4232,"PostgreSQL"],[4279,"Redis (reserved / not currently used)"],[4280,"Mailpit Web"],[4281,"Analytics"],[4290,"MinIO API"],[4291,"MinIO Console"],
];
const appPorts = new Set([4200,4201,4202,4203,4204,4205,4206]);
const failures=[]; const notes=[];

function run(cmd,args=[]){const r=spawnSync(cmd,args,{encoding:"utf8",shell:process.platform==="win32"});return{ok:r.status===0,out:`${r.stdout??""}${r.stderr??""}`.trim()}}
function parseEnvFile(file){const out={}; if(!existsSync(file))return out; for(const raw of readFileSync(file,"utf8").split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith("#"))continue;const i=line.indexOf("=");if(i>0)out[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,"");}return out}
function localPort(value){const m=String(value??"").match(/(?:localhost|127\.0\.0\.1):(\d+)/);return m?Number(m[1]):null}
async function bindFree(port){return await new Promise(resolve=>{const s=net.createServer();s.unref();s.once("error",()=>resolve(false));s.listen({host:"127.0.0.1",port,exclusive:true},()=>s.close(()=>resolve(true)));});}

const audit=run(process.execPath,[join(root,"scripts/armar-infra-audit.mjs")]);
if(!audit.ok)failures.push(`Auditoría estática de infraestructura:\n${audit.out}`);else notes.push("Referencias activas y mappings coherentes");

const docker=run("docker",["version","--format","{{.Server.Version}}"]); if(!docker.ok)failures.push("Docker Desktop/daemon no está disponible"); else notes.push(`Docker ${docker.out.split(/\r?\n/)[0]}`);
let dockerRows=[];
if(docker.ok){
  const ps=run("docker",["ps","--format","{{.Names}}|{{.Ports}}|{{.Label \"com.docker.compose.project\"}}"]).out;
  dockerRows=ps.split(/\r?\n/).filter(Boolean).map(line=>{const [name,ports,project]=line.split("|");return{name,ports,project}});
  const legacy=dockerRows.filter(x=>x.name.startsWith("proofline-dev-"));
  if(legacy.length)failures.push(`Contenedores PROOFLINE legacy activos: ${legacy.map(x=>x.name).join(", ")}. Ejecuta \"pnpm infra:legacy:stop\"; sólo los detiene y preserva volúmenes.`);
}
function dockerOwnerFor(port){return dockerRows.find(x=>new RegExp(`(?:0\\.0\\.0\\.0|\\[::\\]):${port}->`).test(x.ports));}
for(const [port,label] of reserved){
  if(infraOnly && appPorts.has(port))continue;
  const owner=dockerOwnerFor(port);
  if(owner){
    if(owner.name.startsWith("proofline-")||owner.project==="armar-proofline"){notes.push(`${label} ${port}: ocupado por ${owner.name} (PROOFLINE)`);continue;}
    failures.push(`${label} ${port}: ocupado por contenedor ${owner.name} (${owner.project||"sin project label"})`);continue;
  }
  if(!(await bindFree(port)))failures.push(`${label} ${port}: ocupado por otro proceso local`); else notes.push(`${label} ${port}: disponible`);
}

const envFiles=[join(root,".env"),join(root,".env.local")];
for(const app of ["site","web","respond","control","support","api","worker"]){envFiles.push(join(root,"apps",app,".env"),join(root,"apps",app,".env.local"));}
const expectations={
 SITE_APP_URL:4200,NEXT_PUBLIC_API_URL:4201,API_INTERNAL_URL:4201,CLIENT_APP_URL:4202,RESPOND_APP_URL:4203,CONTROL_APP_URL:4204,SUPPORT_APP_URL:4205,NEXT_PUBLIC_SUPPORT_APP_URL:4205,CONTROL_API_INTERNAL_URL:4206,ANALYTICS_URL:4281,S3_ENDPOINT:4290,MINIO_CONSOLE_URL:4291,PROOFLINE_DATABASE_URL:4232,DATABASE_URL:4232,
};
for(const file of [...new Set(envFiles)]){
  const env=parseEnvFile(file); if(!Object.keys(env).length)continue;
  for(const [key,expected] of Object.entries(expectations)){
    if(!(key in env))continue; const p=localPort(env[key]); if(p!==null&&p!==expected)failures.push(`${file}: ${key} usa ${p}; esperado ${expected}`);
  }
  if(env.CONTROL_API_PORT && Number(env.CONTROL_API_PORT)!==4206)failures.push(`${file}: CONTROL_API_PORT=${env.CONTROL_API_PORT}; esperado 4206`);
  if(env.SMTP_PORT && Number(env.SMTP_PORT)!==4225)failures.push(`${file}: SMTP_PORT=${env.SMTP_PORT}; esperado 4225`);
  for(const key of ["CORS_ORIGINS","CONTROL_CORS_ORIGINS"]){if(!env[key])continue;for(const part of env[key].split(",")){const p=localPort(part);if(p!==null&&(p<4200||p>4299))failures.push(`${file}: ${key} contiene puerto local fuera del bloque: ${p}`);}}
}

console.log("\nPROOFLINE · ARMAR preflight 4200–4299\n");
for(const n of notes)console.log(`[OK]    ${n}`);
if(failures.length){for(const f of failures)console.error(`[FALLO] ${f}`);console.error("\nNo se inicia PROOFLINE hasta resolver las colisiones/incoherencias anteriores.\n");process.exit(1)}
console.log("\n[OK] Preflight completado. No se detectan colisiones conocidas en el bloque reservado.\n");
