import type { ReactNode } from "react";
import { Icon, type ProoflineIconName } from "@proofline/ui";
import { eur } from "./control-ui";

export function BackofficeKpi({label,value,delta,note,icon="activity",tone="default"}:{label:string;value:ReactNode;delta?:number|null;note?:ReactNode;icon?:ProoflineIconName;tone?:"default"|"danger"|"good"}){
  const deltaClass=delta==null?"":delta>0?"positive":delta<0?"negative":"neutral";
  return <article className={`bo-kpi ${tone}`}><div className="bo-kpi-top"><span className="bo-kpi-icon"><Icon name={icon} size={18}/></span>{delta!=null?<span className={`bo-delta ${deltaClass}`}>{delta>0?"+":""}{delta}%</span>:null}</div><strong>{value}</strong><span>{label}</span>{note?<small>{note}</small>:null}</article>
}

export function TrendChart({points,locale,metric="revenueCents"}:{points:any[];locale:string;metric?:"revenueCents"|"billedCents"|"customers"|"tickets"}){
  const values=points.map(p=>Number(p[metric]??0));const max=Math.max(1,...values),w=720,h=210,pad=18;const coords=values.map((v,i)=>{const x=points.length<=1?w/2:pad+(i*(w-pad*2))/(points.length-1),y=h-pad-(v/max)*(h-pad*2);return`${x.toFixed(1)},${y.toFixed(1)}`}).join(" ");
  return <div className="bo-trend"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="trend"><defs><linearGradient id="boFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".24"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} className="bo-axis"/>{coords?<><polyline points={coords} className="bo-line" fill="none"/><polygon points={`${pad},${h-pad} ${coords} ${w-pad},${h-pad}`} fill="url(#boFill)"/></>:null}</svg><div className="bo-trend-labels">{points.length?<span>{new Date(points[0].date).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</span>:null}{points.length>1?<span>{new Date(points[points.length-1].date).toLocaleDateString(locale,{day:"2-digit",month:"short"})}</span>:null}</div></div>
}

export function PeriodSwitch({locale,current}:{locale:string;current:string}){const ranges=["7d","30d","90d","365d"];return <div className="bo-period" aria-label="Period">{ranges.map(r=><a key={r} href={`/${locale}?range=${r}`} className={current===r?"active":""}>{r}</a>)}</div>}
export function BusinessPeriodSwitch({locale,current}:{locale:string;current:string}){const ranges=["7d","30d","90d","365d"];return <div className="bo-period" aria-label="Period">{ranges.map(r=><a key={r} href={`/${locale}/business?range=${r}`} className={current===r?"active":""}>{r}</a>)}</div>}

export function ForecastCard({forecast,locale}:{forecast:any;locale:string}){return <div className="bo-forecast"><div><span>Conservador</span><strong>{eur(forecast.conservativeCents,locale)}</strong></div><div><span>Base</span><strong>{eur(forecast.baseCents,locale)}</strong></div><div><span>Optimista</span><strong>{eur(forecast.optimisticCents,locale)}</strong></div><p><b>Modelo:</b> {forecast.model}</p><p><b>Confianza:</b> {forecast.confidence}</p><ul>{forecast.assumptions.map((a:string)=><li key={a}>{a}</li>)}</ul></div>}

export function DataQuality({quality,locale}:{quality:any;locale:string}){return <div className="bo-quality"><div><span>Organizaciones</span><strong>{quality.organizations}</strong></div><div><span>Suscripciones</span><strong>{quality.subscriptions}</strong></div><div><span>Facturas</span><strong>{quality.invoices}</strong></div><div><span>Tickets</span><strong>{quality.tickets}</strong></div><div><span>Uso</span><strong>{quality.usageEvents}</strong></div><small>Actualizado {new Date(quality.lastUpdatedAt).toLocaleString(locale)}</small></div>}
