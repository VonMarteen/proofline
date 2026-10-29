#!/usr/bin/env node
/** G0 copia PostgreSQL local, solamente SELECT/pg_dump; no modifica la BD. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
if(!process.argv.includes('--confirm-local-database')){console.error('No se ha ejecutado pg_dump. Añade --confirm-local-database solo si la BD es LOCAL y propia.');process.exit(2);}
if(process.env.NODE_ENV==='production'){console.error('Rechazado: NODE_ENV=production');process.exit(2);}
const defaultURL='postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline';
let url;try{url=new URL(process.env.PROOFLINE_DATABASE_URL??defaultURL);}catch{console.error('URL PostgreSQL inválida');process.exit(2);}
if(!['127.0.0.1','localhost','::1','[::1]'].includes(url.hostname)||!['postgres:','postgresql:'].includes(url.protocol)){console.error('Rechazado: PostgreSQL no local.');process.exit(2);}
const folder=join(root,'.runtime','g0');mkdirSync(folder,{recursive:true});const name=`PROOFLINE_G0_POSTGRES_${new Date().toISOString().replace(/[:.]/g,'-')}.dump`,file=join(folder,name);
const args=['--host',url.hostname,'--port',url.port||'5432','--username',decodeURIComponent(url.username),'--dbname',decodeURIComponent(url.pathname.slice(1)),'--format=custom','--no-owner','--no-acl','--file',file];
const env={...process.env,PGPASSWORD:decodeURIComponent(url.password),PGCONNECT_TIMEOUT:'8'};
const dump=spawnSync('pg_dump',args,{cwd:root,env,encoding:'utf8',timeout:180000,windowsHide:true});if(dump.status!==0||!existsSync(file)){try{unlinkSync(file)}catch{}console.error('Backup pendiente: pg_dump no disponible o conexión fallida. Verifica PostgreSQL client tools y que la instancia local responda.');process.exit(2);}
const list=spawnSync('pg_restore',['--list',file],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});if(list.status!==0){console.error('Copia creada, pero pg_restore --list no la valida. No se declara certificada.');process.exit(2);}
const {createHash}=await import('node:crypto');const digest=createHash('sha256').update(readFileSync(file)).digest('hex');writeFileSync(join(folder,'latest-db-backup.json'),JSON.stringify({file,sha256:digest,verifiedWithPgRestoreList:true,createdAt:new Date().toISOString(),restoreTested:false},null,2));console.log('Backup PostgreSQL LOCAL generado:',file);console.log('SHA-256:',digest);console.log('Formato validado con pg_restore --list. Restauración efectiva aún NO verificada.');
