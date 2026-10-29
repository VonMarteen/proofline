import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Activity, ArrowRight, BadgeCheck, Banknote, Bell, Building2, Check, CheckCircle2, ChevronRight,
  CircleAlert, CircleDollarSign, ClipboardCheck, ClipboardList, Clock3, CreditCard, Database, Download, Eye,
  FileText, Gauge, Handshake, History, Languages, LayoutDashboard, Library, LifeBuoy, LockKeyhole,
  LogOut, Mail, Menu, MessageSquare, Monitor, Palette, Pencil, Plus, RefreshCw, Rocket, Search, Settings,
  Shield, ShieldCheck, Sparkles, Sun, Moon, Trash2, Upload, UserCog, Users, WalletCards, Instagram, Linkedin, X, type LucideIcon,
} from "lucide-react";

export type ProoflineIconName =
  | "activity" | "arrow-right" | "approved" | "banknote" | "bell" | "building" | "check"
  | "check-circle" | "chevron-right" | "alert" | "money" | "clipboard-check" | "assessments"
  | "clock" | "billing" | "database" | "download" | "eye" | "reports" | "gauge" | "handshake" | "history"
  | "languages" | "overview" | "library" | "support" | "lock" | "logout" | "mail"
  | "communications" | "monitor" | "branding" | "edit" | "plus" | "refresh" | "rocket" | "menu" | "close"
  | "search" | "settings" | "security" | "governance" | "sparkles" | "sun" | "moon"
  | "delete" | "upload" | "user-settings" | "people" | "wallet" | "instagram" | "linkedin" | "x";

const icons: Record<ProoflineIconName, LucideIcon> = {
  activity:Activity,"arrow-right":ArrowRight,approved:BadgeCheck,banknote:Banknote,bell:Bell,building:Building2,
  check:Check,"check-circle":CheckCircle2,"chevron-right":ChevronRight,alert:CircleAlert,money:CircleDollarSign,
  "clipboard-check":ClipboardCheck,assessments:ClipboardList,clock:Clock3,billing:CreditCard,database:Database,download:Download,
  eye:Eye,reports:FileText,gauge:Gauge,handshake:Handshake,history:History,languages:Languages,overview:LayoutDashboard,
  library:Library,support:LifeBuoy,lock:LockKeyhole,logout:LogOut,mail:Mail,communications:MessageSquare,monitor:Monitor,
  branding:Palette,edit:Pencil,plus:Plus,refresh:RefreshCw,rocket:Rocket,menu:Menu,close:X,search:Search,settings:Settings,security:Shield,
  governance:ShieldCheck,sparkles:Sparkles,sun:Sun,moon:Moon,delete:Trash2,upload:Upload,"user-settings":UserCog,
  people:Users,wallet:WalletCards,instagram:Instagram,linkedin:Linkedin,x:X,
};

export function Icon({name,size=17,strokeWidth=1.9,className="",label}:{name:ProoflineIconName;size?:number;strokeWidth?:number;className?:string;label?:string}){
  const Component=icons[name];
  return <Component className={`proofline-icon ${className}`.trim()} size={size} strokeWidth={strokeWidth} aria-hidden={label?undefined:true} aria-label={label}/>;
}

export function ProoflineMark({size=32,className=""}:{size?:number;className?:string}){
  return <img className={`brand-symbol ${className}`.trim()} src="/proofline-mark.png" width={size} height={size} alt="" aria-hidden="true"/>;
}

export function Brand({compact=false,tagline=false}:{compact?:boolean;tagline?:boolean}){
  return <span className={`brand ${compact?"brand-compact":""}`.trim()}><ProoflineMark size={compact?26:30}/><span className="brand-copy"><span className="brand-word">Proofline</span>{tagline?<span className="brand-tagline">SIGNAL. STRUCTURE. IMPACT.</span>:null}</span></span>;
}
export function Card({children,strong=false,className=""}:{children:ReactNode;strong?:boolean;className?:string}){return <div className={`card ${strong?"card-strong":""} ${className}`.trim()}>{children}</div>}
export function Badge({children,tone=""}:{children:ReactNode;tone?:"good"|"warn"|"danger"|"accent"|""}){return <span className={`badge ${tone}`}>{children}</span>}
export function Stat({label,value,note}:{label:string;value:ReactNode;note?:ReactNode}){return <div><div className="metric-label">{label}</div><div className="kpi">{value}</div>{note?<div className="muted" style={{fontSize:13}}>{note}</div>:null}</div>}
export function Progress({value,label}:{value:number;label?:string}){const safe=Math.max(0,Math.min(100,value));return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe} aria-label={label??`${safe}%`}><span style={{width:`${safe}%`}}/></div>}

export function AppSpinner({size="md",label="Loading",className=""}:{size?:"sm"|"md"|"lg";label?:string;className?:string}){
  return <span className={`proofline-spinner is-${size} ${className}`.trim()} role="status" aria-label={label}><span aria-hidden="true"/></span>;
}

export function AppSkeleton({width="100%",height=16,radius=10,className=""}:{width?:string|number;height?:string|number;radius?:string|number;className?:string}){
  return <span className={`proofline-skeleton ${className}`.trim()} aria-hidden="true" style={{width,height,borderRadius:radius}}/>;
}

export function AppSkeletonText({lines=3,lastWidth="68%"}:{lines?:number;lastWidth?:string}){
  return <span className="proofline-skeleton-text" aria-hidden="true">{Array.from({length:Math.max(1,lines)},(_,index)=><AppSkeleton key={index} height={12} width={index===lines-1?lastWidth:"100%"}/>)}</span>;
}

export function AppSkeletonTable({rows=5,columns=4}:{rows?:number;columns?:number}){
  const safeRows=Math.max(1,rows),safeColumns=Math.max(1,columns);
  return <div className="proofline-skeleton-table" aria-hidden="true"><div className="proofline-skeleton-table-row is-head">{Array.from({length:safeColumns},(_,i)=><AppSkeleton key={i} height={11} width={i===0?"58%":"72%"}/>)}</div>{Array.from({length:safeRows},(_,row)=><div className="proofline-skeleton-table-row" key={row}>{Array.from({length:safeColumns},(_,col)=><AppSkeleton key={col} height={12} width={col===0?"76%":"62%"}/>)}</div>)}</div>;
}

export function AppPageLoader({label="Loading content…"}:{label?:string}){
  return <main className="proofline-page-loading" aria-busy="true" aria-live="polite"><span className="proofline-sr-only">{label}</span><div className="proofline-page-loading-head"><div><AppSkeleton height={28} width="min(360px, 72vw)"/><AppSkeleton height={12} width="min(520px, 82vw)"/></div><AppSkeleton height={36} width={118} radius={10}/></div><div className="proofline-page-loading-grid"><div className="proofline-loading-card"><AppSkeleton height={13} width="42%"/><AppSkeleton height={34} width="36%"/><AppSkeletonText lines={2} lastWidth="78%"/></div><div className="proofline-loading-card"><AppSkeleton height={13} width="38%"/><AppSkeleton height={34} width="44%"/><AppSkeletonText lines={2} lastWidth="62%"/></div><div className="proofline-loading-card is-wide"><AppSkeleton height={15} width="30%"/><AppSkeletonTable rows={4} columns={4}/></div></div></main>;
}

export function AppLoadingBlock({label="Loading…",text}:{label?:string;text?:string}){
  return <div className="proofline-loading-block" aria-busy="true" role="status"><AppSpinner size="md" label={label}/>{text?<span>{text}</span>:null}</div>;
}

export function AppBackgroundLoading({active,label="Updating…"}:{active:boolean;label?:string}){
  if(!active)return null;
  return <span className="proofline-background-loading" role="status" aria-live="polite"><AppSpinner size="sm" label={label}/><span>{label}</span></span>;
}

export function AppStatePanel({state,title,text,action}:{state:"empty"|"error"|"forbidden"|"success";title:string;text?:string;action?:ReactNode}){
  const icon=state==="success"?"check-circle":state==="empty"?"reports":state==="forbidden"?"lock":"alert";
  return <section className={`proofline-state-panel is-${state}`} role={state==="error"?"alert":"status"}><span className="proofline-state-icon"><Icon name={icon as ProoflineIconName} size={20}/></span><div><h3>{title}</h3>{text?<p>{text}</p>:null}{action?<div className="proofline-state-action">{action}</div>:null}</div></section>;
}

export function LoadingButton({loading=false,loadingLabel,children,disabled,className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{loading?:boolean;loadingLabel?:ReactNode}){
  return <button {...props} className={`proofline-loading-button ${className}`.trim()} disabled={disabled||loading} aria-busy={loading||undefined}><span className="proofline-loading-button-content" data-loading={loading?"true":"false"}>{loading?<AppSpinner size="sm" label={typeof loadingLabel==="string"?loadingLabel:"Loading"}/>:null}<span>{loading&&loadingLabel?loadingLabel:children}</span></span></button>;
}

export type ProoflinePagination = { page:number; pageSize:number; total:number; pages:number; hasPrevious:boolean; hasNext:boolean };

function paginationHref(basePath:string,query:Record<string,string|number|undefined>,page:number,pageSize:number,pageParam="page",pageSizeParam="pageSize"){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)){if(value!==undefined&&value!==""&&key!==pageParam&&key!==pageSizeParam)params.set(key,String(value));}
  params.set(pageParam,String(page));params.set(pageSizeParam,String(pageSize));
  return `${basePath}?${params.toString()}`;
}

export function PaginationBar({pagination,basePath,query={},locale="es",pageParam="page",pageSizeParam="pageSize"}:{pagination:ProoflinePagination;basePath:string;query?:Record<string,string|number|undefined>;locale?:"es"|"en";pageParam?:string;pageSizeParam?:string}){
  const es=locale==="es",from=pagination.total?((pagination.page-1)*pagination.pageSize)+1:0,to=Math.min(pagination.total,pagination.page*pagination.pageSize);
  const hidden=Object.entries(query).filter(([key,value])=>value!==undefined&&value!==""&&key!==pageParam&&key!==pageSizeParam);
  return <footer className="proofline-pagination" aria-label={es?"Paginación":"Pagination"}><div className="proofline-pagination-summary"><strong>{pagination.total}</strong><span>{es?"registros":"records"}</span><small>{pagination.total?`${from}–${to}`:"0"}</small></div><form method="get" action={basePath} className="proofline-pagination-size" data-proofline-no-confirm="true">{hidden.map(([key,value])=><input key={key} type="hidden" name={key} value={String(value)}/>)}<input type="hidden" name={pageParam} value="1"/><label>{es?"Filas":"Rows"}<select name={pageSizeParam} defaultValue={String(pagination.pageSize)} aria-label={es?"Filas por página":"Rows per page"}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><button type="submit">{es?"Aplicar":"Apply"}</button></form><nav className="proofline-pagination-nav"><a aria-disabled={!pagination.hasPrevious} className={!pagination.hasPrevious?"is-disabled":""} href={pagination.hasPrevious?paginationHref(basePath,query,pagination.page-1,pagination.pageSize,pageParam,pageSizeParam):undefined}>‹ <span>{es?"Anterior":"Previous"}</span></a><span>{es?`Página ${pagination.page} de ${pagination.pages}`:`Page ${pagination.page} of ${pagination.pages}`}</span><a aria-disabled={!pagination.hasNext} className={!pagination.hasNext?"is-disabled":""} href={pagination.hasNext?paginationHref(basePath,query,pagination.page+1,pagination.pageSize,pageParam,pageSizeParam):undefined}><span>{es?"Siguiente":"Next"}</span> ›</a></nav></footer>;
}
export function SectionHead({eyebrow,title,text}:{eyebrow?:string;title:string;text?:string}){return <div className="section-head"><div>{eyebrow?<div className="eyebrow">{eyebrow}</div>:null}<h2>{title}</h2></div>{text?<p>{text}</p>:null}</div>}
