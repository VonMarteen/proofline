#!/usr/bin/env node
/** Resultados G0/G1 solo métricas: nunca incluye código, ZIP original ni dump de BD. */
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipPack} from './proofline-g0.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const files=[['G0_baseline.json','.runtime/g0/latest-baseline.json'],['G0_postgres.json','.runtime/g0/latest-db-backup.json'],['G1_codigo.json','.runtime/g1/latest.json'],['G1_laboratorio.json','.runtime/g1/latest-faultlab.json'],['G1_postgres_lectura.json','.runtime/g1/latest-db-readonly.json']];
const entries=[],missing=[];
for(const [target,rel] of files){const abs=join(root,rel);if(!existsSync(abs)){missing.push(target);continue;}const value=JSON.parse(readFileSync(abs,'utf8'));for(const k of ['archive','file'])if(value[k])value[k]=basename(value[k]);entries.push([target,Buffer.from(JSON.stringify(value,null,2))]);}
entries.push(['RESUMEN.json',Buffer.from(JSON.stringify({schema:'proofline-g0-g1-export-v1',createdAt:new Date().toISOString(),filesIncluded:entries.map(([n])=>n),missing,warning:'No contiene fuentes, bases de datos, secretos ni archivos .env. No certifica E2E.'},null,2))]);
const targetDir=join(root,'.runtime','g1');mkdirSync(targetDir,{recursive:true});const file=join(targetDir,`PROOFLINE_G0_G1_RESULTADOS_${new Date().toISOString().replace(/[:.]/g,'-')}.zip`);const zip=zipPack(entries);writeFileSync(file,zip);console.log('Archivo de resultados seguro para revisión:',file);console.log('SHA-256:',createHash('sha256').update(zip).digest('hex'));if(missing.length)console.log('No disponibles (seguirán pendientes):',missing.join(', '));
