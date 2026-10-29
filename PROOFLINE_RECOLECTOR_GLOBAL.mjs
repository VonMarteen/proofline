#!/usr/bin/env node
/**
 * PROOFLINE - snapshot GLOBAL de codigo REAL instalado (solo lectura).
 * Node.js >= 20; no necesita npm/pnpm ni bibliotecas externas.
 * NO ejecuta migraciones, seeds, tests, builds, operaciones de escritura ni envios.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REQUIRED = ['package.json', 'pnpm-workspace.yaml', 'apps/api', 'apps/web', 'apps/control'];
const missing = REQUIRED.filter((p) => !fs.existsSync(path.join(ROOT, p)));
if (missing.length) {
  console.error('ERROR: coloca este script en la RAIZ de PROOFLINE. Faltan:', missing.join(', '));
  process.exitCode = 1;
} else {
  await main();
}

async function main() {
  const when = new Date();
  const stamp = [when.getFullYear(), String(when.getMonth()+1).padStart(2,'0'), String(when.getDate()).padStart(2,'0')].join('')
    + '-' + [when.getHours(), when.getMinutes(), when.getSeconds()].map(v=>String(v).padStart(2,'0')).join('');
  const base = `PROOFLINE_ESTADO_REAL_${stamp}`;
  const outputFile = path.join(ROOT, `${base}.zip`);
  const shaFile = path.join(ROOT, `${base}.zip.sha256.txt`);
  const files = [];
  const omissions = [];
  let sourceBytes = 0;
  const MAX_FILE = 12 * 1024 * 1024;
  const MAX_TOTAL = 160 * 1024 * 1024;
  const MAX_COUNT = 18000;
  const roots = ['apps', 'packages', 'services', 'infra', 'scripts', 'tests', 'docs', '.github', '.vscode'];
  const rootFiles = ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json', 'tsconfig.json',
    'tsconfig.base.json','.nvmrc','.gitignore','.dockerignore','.editorconfig',
    'README.md','README.es.md','LICENSE','Dockerfile','docker-compose.yml','docker-compose.yaml',
    'compose.yml','compose.yaml','prisma.config.ts'];
  const allowedExtensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.mts','.cts', '.json','.jsonc',
    '.yaml','.yml','.toml','.sql','.prisma','.graphql','.gql','.css','.scss','.sass','.less','.html',
    '.md','.mdx','.txt','.xml','.sh','.ps1','.cmd','.bat','.svg','.png','.jpg','.jpeg','.webp',
    '.ico','.conf','.config','.py','.go','.rs','.properties','.http','.feature','.vue','.svelte']);
  const excludedDirs = new Set(['node_modules','.git','.next','dist','build','out','coverage','.turbo',
    '.cache','.pytest_cache','.venv','venv','__pycache__','.pnpm-store','.yarn','.idea','.vs',
    'tmp','temp','logs','log','.runtime','runtime-data',
    'pgdata','postgres-data','postgresql-data','redis-data','minio-data','playwright-report','test-results']);
  const excludeExact = new Set(['.npmrc','.yarnrc','.netrc','.pypirc','.env','.env.local',
    '.proofline-pids.json','credentials.json','credential.json','service-account.json',
    'service_account.json','secrets.json','secret.json','id_rsa','id_ed25519',
    'known_hosts','authorized_keys','cookies.txt','.DS_Store','thumbs.db']);
  const excludeExtensions = new Set(['.zip','.7z','.rar','.tar','.tgz','.gz','.pdf','.doc','.docx',
    '.xls','.xlsx','.ppt','.pptx','.mp4','.mov','.avi','.webm','.mp3','.wav',
    '.woff','.woff2','.ttf','.otf','.eot','.db','.sqlite','.sqlite3','.pem','.key','.p12',
    '.pfx','.crt','.cer','.log','.bak','.dump','.pcap','.map']);
  const dangerousContent = [
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    /\b(?:sk_live|rk_live|whsec)_[A-Za-z0-9]{12,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{18,}\b/,
  ];
  const norm = (p) => p.split(path.sep).join('/');
  function excluded(relative, name, isDir=false) {
    const low = name.toLowerCase();
    if (isDir) {
      if (excludedDirs.has(low)) return 'directorio temporal/privado';
      // 'reports', 'data', 'uploads', 'sessions', etc. pueden ser MODULOS
      // legitimos bajo src/app. Nunca descartarlos si son codigo fuente.
      const codePath = /\/(?:src|app|pages|tests|test|prisma)\//.test('/'+relative+'/');
      const potentiallyPrivate = new Set(['backups','backup','uploads','upload','storage',
        'sessions','attachments','artifacts','reports','downloads','exports','data']);
      if (potentiallyPrivate.has(low) && !codePath) return 'posibles datos de ejecucion';
      return null;
    }
    const ext = path.extname(low);
    if (excludeExact.has(low) || low === '.env' || low.startsWith('.env.') || low.endsWith('.env')) return 'configuracion/credenciales';
    if (/(^|[._-])(secret|secrets|credentials|privatekey|api-key)([._-]|$)/i.test(low)) return 'nombre sensible';
    if (excludeExtensions.has(ext)) return 'formato no incluido';
    if (!allowedExtensions.has(ext) && !rootFiles.includes(name)) return 'extension no incluida';
    if (relative.startsWith('.vscode/') && !['tasks.json','extensions.json'].includes(name)) return 'ajuste local de VS Code';
    if (/^(?:\.env|\.npmrc)/i.test(name)) return 'credenciales';
    return null;
  }
  function add(relative) {
    if (files.length >= MAX_COUNT) throw new Error('Limite de archivos excedido; revisa que sea el proyecto correcto.');
    const full = path.join(ROOT, ...relative.split('/'));
    let stat;
    try { stat = fs.lstatSync(full); } catch { omissions.push({ruta:relative, razon:'no accesible'}); return; }
    if (!stat.isFile() || stat.isSymbolicLink()) { omissions.push({ruta:relative, razon:'no es un archivo regular'}); return; }
    if (stat.size > MAX_FILE) { omissions.push({ruta:relative, razon:'archivo > 12 MB'}); return; }
    if (sourceBytes + stat.size > MAX_TOTAL) throw new Error('El codigo supera 160 MB. No se genera un ZIP incompleto.');
    let bytes = fs.readFileSync(full);
    if (!['.png','.jpg','.jpeg','.webp','.ico'].includes(path.extname(relative).toLowerCase())) {
      const txt = bytes.toString('utf8');
      if (dangerousContent.some(r => r.test(txt))) {
        omissions.push({ruta:relative, razon:'posible credencial incrustada: revisar localmente'});
        return;
      }
    }
    files.push({name:relative, bytes});
    sourceBytes += bytes.length;
  }
  function visit(relative) {
    const full = path.join(ROOT, ...relative.split('/'));
    let entries;
    try { entries = fs.readdirSync(full, {withFileTypes:true}); }
    catch { omissions.push({ruta:relative, razon:'directorio inaccesible'}); return; }
    entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for (const item of entries) {
      const rel = norm(path.posix.join(relative,item.name));
      if (item.isSymbolicLink()) { omissions.push({ruta:rel, razon:'enlace simbolico omitido'}); continue; }
      const reason = excluded(rel,item.name,item.isDirectory());
      if (reason) {
        // Para evitar un manifiesto gigante, registra nombres solo de archivos sensibles,
        // no miles de archivos de dependencias y caches.
        if (!item.isDirectory() || !excludedDirs.has(item.name.toLowerCase())) omissions.push({ruta:rel,razon:reason});
        continue;
      }
      if (item.isDirectory()) visit(rel);
      else if (item.isFile()) add(rel);
    }
  }
  for (const d of roots) if (fs.existsSync(path.join(ROOT,d))) visit(d);
  for (const f of rootFiles) if (fs.existsSync(path.join(ROOT,f)) && fs.lstatSync(path.join(ROOT,f)).isFile()) add(f);
  // Otros archivos de configuracion y documentacion en raiz, pero nunca credenciales.
  for (const name of fs.readdirSync(ROOT).sort()) {
    const full = path.join(ROOT,name);
    if (!fs.lstatSync(full).isFile() || rootFiles.includes(name) || name === path.basename(fileURLToPath(import.meta.url))) continue;
    if (excluded(name,name)) continue;
    if (/^(?:readme|change|aplicar|directiva|validacion|proofline|commercial|data_|emails|pilot_)/i.test(name) &&
        ['.md','.mdx','.txt'].includes(path.extname(name).toLowerCase())) add(name);
  }
  if (!files.some(f=>f.name==='apps/api/package.json') || !files.some(f=>f.name==='apps/web/package.json'))
    throw new Error('No se ha encontrado codigo fuente suficiente. No se crea un ZIP enganoso.');

  const projectPackage = JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const envFiles=[];
  const envDirs=['',...['apps','services'].flatMap(dir=>{
    let children=[];try{children=fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})}catch{}
    return children.filter(d=>d.isDirectory()).map(d=>`${dir}/${d.name}`);
  })];
  for (const dir of envDirs) {
    for (const n of ['.env','.env.local','.env.development','.env.production','.env.example','.env.sample']) {
      const rel=norm(path.posix.join(dir,n));const p=path.join(ROOT,rel);
      if (!fs.existsSync(p)) continue;
      try {
        const keys=[...new Set(fs.readFileSync(p,'utf8').split(/\r?\n/).flatMap(line=>{
          const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
          return m?[m[1]]:[];
        }))].sort();
        envFiles.push({archivo:rel,solo_nombres_variables:keys});
      } catch { envFiles.push({archivo:rel,error:'no accesible'}); }
    }
  }
  let git=null;
  try {
    const result=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',timeout:4000,stdio:['ignore','pipe','ignore']}).trim();
    git={commit:result(['rev-parse','HEAD']),archivos_con_cambios:result(['status','--porcelain','--untracked-files=no']).split('\n').filter(Boolean).length};
  } catch { git={disponible:false}; }
  const deps={node:process.version,pnpm_declarado:projectPackage.packageManager??null,
    node_modules_presente:fs.existsSync(path.join(ROOT,'node_modules')),
    aplicaciones:['api','web','control','respond','site','support','worker'].filter(d=>fs.existsSync(path.join(ROOT,'apps',d)))};
  const probes=[
    ['Web publica','http://127.0.0.1:4200/es'],
    ['Workspace','http://127.0.0.1:4202/login?locale=es'],
    ['Respond','http://127.0.0.1:4203/es'],
    ['Control','http://127.0.0.1:4204/login?locale=es'],
    ['Support','http://127.0.0.1:4205/login?locale=es'],
    ['API live','http://127.0.0.1:4201/health/live'],
    ['API PostgreSQL','http://127.0.0.1:4201/health'],
    ['Control API live','http://127.0.0.1:4206/health/live'],
    ['Control API PostgreSQL','http://127.0.0.1:4206/health'],
    ['Analytics','http://127.0.0.1:4281/health'],
    ['Mailpit','http://127.0.0.1:4280/'],
  ];
  const probeResults=await Promise.all(probes.map(async ([servicio,url])=>{
    const start=Date.now();
    try {const response=await fetch(url,{method:'GET',signal:AbortSignal.timeout(1750),redirect:'manual'});
      try{await response.body?.cancel()}catch{}
      return {servicio,http_status:response.status,duracion_ms:Date.now()-start};
    } catch {return {servicio,estado:'no responde / no iniciado',duracion_ms:Date.now()-start};}
  }));
  const manifest=files.map(f=>({ruta:f.name,bytes:f.bytes.length,sha256:crypto.createHash('sha256').update(f.bytes).digest('hex')}));
  const metadata={
    generador:'PROOFLINE_RECOLECTOR_GLOBAL',version:'1.0',generado_utc:when.toISOString(),
    modo:'SOLO LECTURA (GET de salud local; no pruebas que escriban datos)',
    codigo: {archivos:files.length,bytes:sourceBytes},
    git,deps,checks_salud:probeResults,
    limitaciones:['No incluye bases de datos, datos de clientes ni contenidos de .env.',
      'No prueba flujos E2E, ni valida permisos, worker, pagos o entrega real.',
      'HTTP 200 en health NO significa producto certificado.'],
  };
  function auxiliary(name,obj){const data=Buffer.from(JSON.stringify(obj,null,2)+'\n','utf8');files.push({name,bytes:data});}
  auxiliary('_AUDITORIA/ESTADO_Y_SERVICIOS.json',metadata);
  auxiliary('_AUDITORIA/MANIFIESTO_SHA256.json',manifest);
  auxiliary('_AUDITORIA/OMISIONES.json',omissions);
  auxiliary('_AUDITORIA/ENV_SOLO_NOMBRES.json',envFiles);
  files.push({name:'_AUDITORIA/LEEME.txt',bytes:Buffer.from(
    'PROOFLINE - SNAPSHOT DEL CODIGO LOCAL REAL\n\n'+
    'El contenido es una captura de los archivos ACTUALES del directorio en que se ejecuto.\n'+
    'No reconstruye ni aplica parches anteriores.\n'+
    'Excluye .env y credenciales conocidas, node_modules, datos, logs, backups, base de datos y salidas.\n'+
    'Los archivos _AUDITORIA contienen inventario, omisiones, variables ENV SOLO CON NOMBRES,\n'+
    'versiones y HTTP/status de comprobaciones GET localhost, sin cuerpos de respuesta.\n'+
    'Revisa el ZIP antes de compartirlo: si has pegado secretos en codigo fuente o documentacion,\n'+
    'el filtrado automatico podria no detectarlos todos.\n'+
    'No se ejecutaron tests, builds, migraciones, seeds, borrados ni peticiones POST.\n'+
    'El estado de servicios no sustituye la certificacion funcional end-to-end.\n','utf8')});
  files.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const zip=writeZip(files,when);
  fs.writeFileSync(outputFile,zip,{flag:'wx'});
  const digest=crypto.createHash('sha256').update(zip).digest('hex');
  fs.writeFileSync(shaFile,`${digest}  ${path.basename(outputFile)}\n`,{flag:'wx'});
  console.log('\nPROOFLINE - RECOLECCION FINALIZADA');
  console.log('ZIP: ',outputFile);
  console.log('SHA256:',digest);
  console.log('Archivos de codigo incluidos:',manifest.length);
  console.log('Excluidos registrados:',omissions.length);
  console.log('Tamano ZIP:',(zip.length/(1024*1024)).toFixed(2),'MB');
  console.log('Revisa el ZIP antes de subirlo. Comparte solamente el archivo .zip.');
}

function writeZip(files,date) {
  if(files.length>65535) throw new Error('Excede limite ZIP de entradas');
  const local=[],central=[]; let offset=0;
  const dosTime=((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|(Math.floor(date.getSeconds()/2)&31);
  const dosDate=(((date.getFullYear()-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31);
  const lut=(()=>{const a=new Uint32Array(256);for(let i=0;i<256;i++){
    let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);a[i]=c>>>0;
  }return a;})();
  const crc32=(b)=>{let c=0xffffffff;for(const x of b)c=lut[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  for(const f of files){
    const name=Buffer.from(f.name.replace(/\\/g,'/'),'utf8');
    const compressed=zlib.deflateRawSync(f.bytes,{level:6});
    if(f.bytes.length>0xffffffff||compressed.length>0xffffffff||offset>0xffffffff)
      throw new Error('ZIP64 no soportado; reduce tamanos');
    const crc=crc32(f.bytes);const lh=Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);
    lh.writeUInt16LE(8,8);lh.writeUInt16LE(dosTime,10);lh.writeUInt16LE(dosDate,12);
    lh.writeUInt32LE(crc,14);lh.writeUInt32LE(compressed.length,18);lh.writeUInt32LE(f.bytes.length,22);
    lh.writeUInt16LE(name.length,26);lh.writeUInt16LE(0,28);
    local.push(lh,name,compressed);
    const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);
    ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt16LE(8,10);
    ch.writeUInt16LE(dosTime,12);ch.writeUInt16LE(dosDate,14);ch.writeUInt32LE(crc,16);
    ch.writeUInt32LE(compressed.length,20);ch.writeUInt32LE(f.bytes.length,24);
    ch.writeUInt16LE(name.length,28);ch.writeUInt16LE(0,30);ch.writeUInt16LE(0,32);
    ch.writeUInt16LE(0,34);ch.writeUInt16LE(0,36);ch.writeUInt32LE(0,38);
    ch.writeUInt32LE(offset,42);central.push(ch,name);
    offset+=lh.length+name.length+compressed.length;
  }
  const centralLength=central.reduce((s,b)=>s+b.length,0);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(centralLength,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);
  return Buffer.concat([...local,...central,end]);
}
