import { spawnSync } from "node:child_process";
function run(args){return spawnSync("docker",args,{encoding:"utf8",shell:process.platform==="win32",stdio:args[0]==="stop"?"inherit":"pipe"})}
const listed=run(["ps","--format","{{.Names}}"]); if(listed.status!==0){console.error("Docker no está disponible.");process.exit(1)}
const names=(listed.stdout??"").split(/\r?\n/).filter(n=>n.startsWith("proofline-dev-"));
if(!names.length){console.log("[OK] No hay contenedores legacy proofline-dev activos.");process.exit(0)}
console.log(`[PROOFLINE] Deteniendo infraestructura legacy sin borrar datos: ${names.join(", ")}`);
const r=run(["stop",...names]); if(r.status!==0)process.exit(r.status??1);
console.log("[OK] Contenedores legacy detenidos. No se eliminaron contenedores, volúmenes ni datos.");
