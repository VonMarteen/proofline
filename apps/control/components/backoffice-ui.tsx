import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type ProoflineIconName } from "@proofline/ui";
import { eur } from "./control-ui";

export type TrendMetric = "revenueCents" | "billedCents" | "customers" | "tickets";
export type TrendPoint = {date: string; revenueCents: number | null; billedCents: number | null; customers: number; tickets: number};

export function BackofficeKpi({label,value,delta,note,icon="activity",tone="default"}:{label:string;value:ReactNode;delta?:number|null;note?:ReactNode;icon?:ProoflineIconName;tone?:"default"|"danger"|"good"}){
  const deltaClass=delta==null?"":delta>0?"positive":delta<0?"negative":"neutral";
  return <article className={`bo-kpi ${tone}`}><div className="bo-kpi-top"><span className="bo-kpi-icon"><Icon name={icon} size={18}/></span>{delta!=null?<span className={`bo-delta ${deltaClass}`}>{delta>0?"+":""}{delta}%</span>:null}</div><strong>{value}</strong><span>{label}</span>{note?<small>{note}</small>:null}</article>;
}

const isMoney=(metric:TrendMetric)=>metric==="revenueCents"||metric==="billedCents";
const metricNames:Record<TrendMetric,{es:string;en:string}>={
  revenueCents:{es:"Facturas pagadas",en:"Paid invoices"},
  billedCents:{es:"Facturas emitidas",en:"Issued invoices"},
  customers:{es:"Altas",en:"New organizations"},
  tickets:{es:"Tickets",en:"Tickets"},
};
export function TrendChart({points,locale,metric="revenueCents"}:{points:TrendPoint[];locale:string;metric?:TrendMetric}){
  const es=locale==="es",label=metricNames[metric][es?"es":"en"];
  const values=points.map(p=>Math.max(0,Number(p[metric]??0)));
  const total=values.reduce((a,b)=>a+b,0);
  if(!points.length)return <p className="control-empty">{es?"No hay períodos disponibles.":"No periods available."}</p>;
  const width=760,height=234,left=64,right=16,top=16,bottom=29,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const max=Math.max(1,...values),ticks=[0,.25,.5,.75,1];
  const coords=values.map((v,i)=>({x:left+(points.length===1?.5:i/(points.length-1))*plotWidth,y:top+plotHeight-(v/max)*plotHeight,v,date:points[i]!.date}));
  const polyline=coords.map(c=>`${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area=`${left},${top+plotHeight} ${polyline} ${left+plotWidth},${top+plotHeight}`;
  const formatValue=(n:number)=>isMoney(metric)?eur(n,locale):new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(n);
  const formatDate=(d:string)=>new Date(`${d.slice(0,10)}T00:00:00Z`).toLocaleDateString(locale,{day:"numeric",month:"short",timeZone:"UTC"});
  return <div className="bo-trend bo-trend-v3">
    <div className="bo-chart-stats"><strong>{formatValue(total)}</strong><span>{label} · {points.length} {es?"intervalos":"intervals"}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. ${es?"Total":"Total"}: ${formatValue(total)}. ${points.length} ${es?"intervalos":"intervals"}.`}>
      {ticks.map(t=>{const y=top+plotHeight-(t*plotHeight);return <g key={t}><line x1={left} y1={y} x2={left+plotWidth} y2={y} className="bo-chart-grid"/><text x={left-9} y={y+4} textAnchor="end" className="bo-chart-axis-label">{isMoney(metric)?new Intl.NumberFormat(locale,{notation:"compact",maximumFractionDigits:1}).format(max*t/100):Math.round(max*t)}</text></g>})}
      <polygon points={area} className="bo-chart-fill"/>
      <polyline points={polyline} className="bo-line" fill="none"/>
      {coords.length<=32?coords.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r="3.25" className="bo-chart-dot"><title>{`${formatDate(c.date)}: ${formatValue(c.v)}`}</title></circle>):null}
      <text x={left} y={height-5} className="bo-chart-axis-label">{formatDate(points[0]!.date)}</text>
      <text x={left+plotWidth} y={height-5} textAnchor="end" className="bo-chart-axis-label">{formatDate(points[points.length-1]!.date)}</text>
    </svg>
    <details className="bo-chart-data"><summary>{es?"Ver datos del gráfico":"View chart data"}</summary><div className="control-table-wrap"><table className="bo-table"><thead><tr><th>{es?"Período":"Period"}</th><th className="control-number">{label}</th></tr></thead><tbody>{points.map(p=><tr key={p.date}><td>{p.date}</td><td className="control-number">{formatValue(Math.max(0,Number(p[metric]??0)))}</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function MetricTabs({locale,href,current,metrics,range,from,to}:{locale:string;href:string;current:TrendMetric;metrics:TrendMetric[];range:string;from?:string;to?:string}){
  const es=locale==="es";
  const params=new URLSearchParams();
  if(range==="custom"&&from&&to){params.set("from",from);params.set("to",to)}else params.set("range",range);
  return <nav className="bo-metric-tabs" aria-label={es?"Indicador gráfico":"Chart metric"}>{metrics.map(metric=>{const q=new URLSearchParams(params);q.set("metric",metric);return <Link href={`${href}?${q}`} key={metric} prefetch={false} aria-current={current===metric?"page":undefined} className={current===metric?"active":""}>{metricNames[metric][es?"es":"en"]}</Link>})}</nav>;
}

export function PeriodSwitch({locale,current,path="",from,to,metric}:{locale:string;current:string;path?:string;from?:string;to?:string;metric?:TrendMetric}){
  const es=locale==="es",base=`/${locale}${path}`,ranges=["7d","30d","90d","365d"];
  return <div className="bo-range-filter"><nav className="bo-period" aria-label={es?"Período":"Period"}>{ranges.map(r=><Link key={r} href={`${base}?range=${r}${metric?`&metric=${metric}`:""}`} prefetch={false} aria-current={current===r?"page":undefined} className={current===r?"active":""}>{r}</Link>)}</nav><form action={base} method="get" className="bo-custom-range" data-proofline-no-confirm="true"><label>{es?"Desde":"From"}<input name="from" type="date" required defaultValue={from}/></label><label>{es?"Hasta":"To"}<input name="to" type="date" required defaultValue={to}/></label>{metric?<input type="hidden" name="metric" value={metric}/>:null}<button type="submit">{es?"Aplicar":"Apply"}</button></form></div>;
}
export function BusinessPeriodSwitch(props:{locale:string;current:string;from?:string;to?:string;metric?:TrendMetric}){return <PeriodSwitch {...props} path="/business"/>}

export function ForecastCard({forecast,locale}:{forecast:{conservativeCents:number;baseCents:number;optimisticCents:number;model:string;confidence:string;assumptions:string[]}|null;locale:string}){
  const es=locale==="es";
  if(!forecast)return <div className="control-empty"><strong>{es?"Proyección no disponible":"Forecast unavailable"}</strong><p>{es?"Se requiere MRR activo en EUR e histórico de facturas pagadas en el período anterior. No se inventa un escenario sin base observable.":"Requires active EUR MRR and a prior-period paid-invoice history. No unsupported scenario is generated."}</p></div>;
  return <div className="bo-forecast"><div><span>{es?"Conservador":"Conservative"}</span><strong>{eur(forecast.conservativeCents,locale)}</strong></div><div><span>{es?"Base":"Base"}</span><strong>{eur(forecast.baseCents,locale)}</strong></div><div><span>{es?"Optimista":"Optimistic"}</span><strong>{eur(forecast.optimisticCents,locale)}</strong></div><p><b>{es?"Modelo":"Model"}:</b> {forecast.model}</p><p><b>{es?"Confianza":"Confidence"}:</b> {forecast.confidence}</p><ul>{forecast.assumptions.map(a=><li key={a}>{a}</li>)}</ul></div>;
}
export function DataQuality({quality,locale}:{quality:{organizations:number;subscriptions:number;invoices:number|null;tickets:number;usageEvents:number;lastUpdatedAt:string};locale:string}){
  const es=locale==="es";
  return <div className="bo-quality"><div><span>{es?"Organizaciones":"Organizations"}</span><strong>{quality.organizations}</strong></div><div><span>{es?"Suscripciones":"Subscriptions"}</span><strong>{quality.subscriptions}</strong></div><div><span>{es?"Facturas":"Invoices"}</span><strong>{quality.invoices??"—"}</strong></div><div><span>Tickets</span><strong>{quality.tickets}</strong></div><div><span>{es?"Uso":"Usage"}</span><strong>{quality.usageEvents}</strong></div><small>{es?"Consulta realizada":"Queried"} {new Date(quality.lastUpdatedAt).toLocaleString(locale)}</small></div>;
}
