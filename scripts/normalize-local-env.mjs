import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
const file=resolve(process.cwd(),process.argv[2]??".env");
if(!existsSync(file)){console.log(`[OK] ${file} no existe; no hay nada que normalizar.`);process.exit(0)}
const backup=`${file}.pre-armar-4200.bak`;copyFileSync(file,backup);let s=readFileSync(file,"utf8");
const replacements=[[/localhost:3100\b/g,"localhost:4200"],[/127\.0\.0\.1:3100\b/g,"127.0.0.1:4200"],[/localhost:3101\b/g,"localhost:4202"],[/127\.0\.0\.1:3101\b/g,"127.0.0.1:4202"],[/localhost:3102\b/g,"localhost:4203"],[/127\.0\.0\.1:3102\b/g,"127.0.0.1:4203"],[/localhost:3103\b/g,"localhost:4204"],[/127\.0\.0\.1:3103\b/g,"127.0.0.1:4204"],[/localhost:3104\b/g,"localhost:4205"],[/127\.0\.0\.1:3104\b/g,"127.0.0.1:4205"],[/localhost:4100\b/g,"localhost:4201"],[/127\.0\.0\.1:4100\b/g,"127.0.0.1:4201"],[/127\.0\.0\.1:55432\b/g,"127.0.0.1:4232"],[/localhost:58025\b/g,"localhost:4280"],[/127\.0\.0\.1:58100\b/g,"127.0.0.1:4281"],[/localhost:58100\b/g,"localhost:4281"],[/localhost:59000\b/g,"localhost:4290"],[/127\.0\.0\.1:59000\b/g,"127.0.0.1:4290"],[/localhost:59001\b/g,"localhost:4291"],[/127\.0\.0\.1:59001\b/g,"127.0.0.1:4291"]];
for(const [a,b] of replacements)s=s.replace(a,b);
s=s.replace(/^CONTROL_API_PORT=.*$/m,"CONTROL_API_PORT=4206").replace(/^SMTP_PORT=.*$/m,"SMTP_PORT=4225");
writeFileSync(file,s,"utf8");console.log(`[OK] ${file} normalizado. Backup: ${backup}`);
