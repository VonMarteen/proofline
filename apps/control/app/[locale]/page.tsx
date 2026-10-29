import { normalizeLocale } from "@proofline/i18n";
import { controlGet } from "../../lib/api";
import { eur, dateTime, Status } from "../../components/control-ui";
import { BackofficeKpi, DataQuality, PeriodSwitch, type TrendMetric, type TrendPoint } from "../../components/backoffice-ui";
import { RecordsTable } from "../../components/records-table";
import { DashboardTrend } from "../../components/dashboard-trend";

type Dashboard = {
  visibility:{finance:boolean;support:boolean;operations:boolean};period:{range:string;from:string;to:string};
  kpis:{revenueCents:number|null;mrrCents:number|null;arrCents:number|null;activeCustomers:number;newCustomers:number;openTickets:number;urgentTickets:number};
  comparison:{revenuePct:number|null;newCustomersPct:number|null};
  timeline:TrendPoint[]; planMix:{code:string;name:string;customers:number;mrrCents:number}[];
  attention:{failedPayments:number;pastDueSubscriptions:number;urgentTickets:number;slaRisk:number;failedJobs:number;failedAnalysis:number};
  system:Record<"api"|"database"|"queue"|"analytics"|"mail",string>;
  recentAudit:{id:string;action:string;actorId:string;organization:string|null;targetType:string;createdAt:string}[];
  dataQuality:{organizations:number;subscriptions:number;invoices:number|null;tickets:number;usageEvents:number;lastUpdatedAt:string};
  financeMethodology:{nonEurInvoicesExcluded:number;nonEurActivePlansExcluded:number;paidWithoutPaidAtExcluded:number}|null;
};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{range?:string;from?:string;to?:string;metric?:string}>}){
  const {locale:raw}=await params, query=await searchParams, locale=normalizeLocale(raw),es=locale==="es";
  const selectedRange=query.from&&query.to?"custom":query.range??"30d";
  const qs=new URLSearchParams();if(query.range)qs.set("range",query.range);if(query.from)qs.set("from",query.from);if(query.to)qs.set("to",query.to);
  const d=await controlGet(`/v1/control/backoffice/dashboard?${qs}`) as Dashboard;
  const metrics:TrendMetric[]=d.visibility.finance?["revenueCents","billedCents","customers",...(d.visibility.support?["tickets" as TrendMetric]:[])]:["customers",...(d.visibility.support?["tickets" as TrendMetric]:[])];
  const metric:TrendMetric=metrics.includes(query.metric as TrendMetric)?query.metric as TrendMetric:(metrics[0]??"customers");
  const maxPlan=Math.max(1,...d.planMix.map(x=>x.customers));
  return <div className="bo-dashboard">
    <header className="bo-dashboard-head"><div><h1>{es?"Torre de control":"Command center"}</h1><p>{es?"Información real de clientes, facturación, soporte y operación según los permisos de tu rol.":"Verified customer, billing, support and operations information according to your permissions."}</p></div><PeriodSwitch locale={locale} current={d.period.range} from={query.from} to={query.to} metric={metric}/></header>
    <div className="bo-kpi-grid">
      <BackofficeKpi label={es?"Facturas pagadas · EUR bruto":"Paid invoices · gross EUR"} value={d.visibility.finance?eur(d.kpis.revenueCents??0,locale):"—"} delta={d.comparison.revenuePct} note={es?"Fecha de pago registrada":"Recorded paid date"} icon="billing"/>
      <BackofficeKpi label="MRR · EUR" value={d.visibility.finance?eur(d.kpis.mrrCents??0,locale):"—"} note={d.visibility.finance?`ARR ${eur(d.kpis.arrCents??0,locale)}`:es?"Acceso financiero restringido":"Finance access restricted"} icon="gauge"/>
      <BackofficeKpi label={es?"Clientes activos":"Active customers"} value={d.kpis.activeCustomers} delta={d.comparison.newCustomersPct} note={`${d.kpis.newCustomers} ${es?"nuevas organizaciones":"new organizations"}`} icon="building"/>
      <BackofficeKpi label={es?"Tickets abiertos":"Open tickets"} value={d.visibility.support?d.kpis.openTickets:"—"} note={d.visibility.support?`${d.kpis.urgentTickets} ${es?"urgentes":"urgent"}`:es?"Acceso restringido":"Restricted access"} icon="support" tone={d.visibility.support&&d.kpis.urgentTickets?"danger":"default"}/>
    </div>
    <div className="bo-grid-2"><section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Evolución real":"Actual trend"}</h2><p>{es?"Intervalos continuos, incluidos períodos sin actividad":"Continuous intervals, including zero-activity periods"}</p></div></div><DashboardTrend key={`${d.period.range}:${d.period.from}:${d.period.to}`} locale={locale} metrics={metrics} initialMetric={metric} points={d.timeline}/></section>
      <section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Atención inmediata":"Immediate attention"}</h2><p>{es?"Señales respaldadas por registros":"Record-backed signals"}</p></div></div><div className="bo-attention">
        {d.visibility.finance?<><a href={`/${locale}/subscriptions`} className={d.attention.failedPayments?"critical":""}><span>{es?"Pagos fallidos":"Failed payments"}</span><strong>{d.attention.failedPayments}</strong></a><a href={`/${locale}/subscriptions`}><span>{es?"Suscripciones vencidas":"Past-due subscriptions"}</span><strong>{d.attention.pastDueSubscriptions}</strong></a></>:null}
        {d.visibility.support?<><a href={`/${locale}/support`} className={d.attention.urgentTickets?"critical":""}><span>{es?"Tickets urgentes":"Urgent tickets"}</span><strong>{d.attention.urgentTickets}</strong></a><a href={`/${locale}/support`}><span>{es?"SLA en riesgo":"SLA at risk"}</span><strong>{d.attention.slaRisk}</strong></a></>:null}
        {d.visibility.operations?<><a href={`/${locale}/operations`} className={d.attention.failedJobs?"critical":""}><span>{es?"Tareas fallidas":"Failed jobs"}</span><strong>{d.attention.failedJobs}</strong></a><a href={`/${locale}/operations`}><span>{es?"Análisis fallidos":"Failed analyses"}</span><strong>{d.attention.failedAnalysis}</strong></a></>:null}
        {!d.visibility.finance&&!d.visibility.support&&!d.visibility.operations?<p className="control-empty">{es?"Sin indicadores operativos autorizados":"No authorized operational indicators"}</p>:null}
      </div></section></div>
    <div className="bo-grid-equal"><section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Suscripciones por plan":"Subscriptions by plan"}</h2><p>{es?"Suscripciones activas · cantidad, no importes":"Active subscriptions · counts, not amounts"}</p></div></div><div className="bo-mix">{d.planMix.length?d.planMix.map(x=><div className="bo-mix-row" key={x.code}><span>{x.name}</span><div className="bo-mix-track" role="img" aria-label={`${x.name}: ${x.customers}`}><i style={{width:`${x.customers/maxPlan*100}%`}}/></div><strong>{x.customers}</strong></div>):<p className="control-empty">{es?"Sin suscripciones activas":"No active subscriptions"}</p>}</div></section>
      <section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Estado de servicios":"Service health"}</h2><p>{es?"Comprobación real de los sistemas":"Actual system probes"}</p></div><a href={`/${locale}/system`}>{es?"Ver sistema":"View system"}</a></div><div className="control-health-grid">{(["api","database","queue","analytics","mail"] as const).map(key=><div key={key}><span>{key}</span><Status value={String(d.system[key])}/></div>)}</div></section></div>
    <section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Actividad privilegiada":"Privileged activity"}</h2><p>{es?"Operaciones recientes visibles según autorización":"Recent operations visible by authorization"}</p></div><a href={`/${locale}/audit`}>{es?"Ver auditoría completa":"Full audit"}</a></div><RecordsTable locale={locale} columns={[es?"Operación":"Action",es?"Actor":"Actor",es?"Contexto":"Context",es?"Fecha":"Date"]} records={d.recentAudit.map(a=>({id:a.id,search:[a.action,a.actorId,a.organization??a.targetType].join(" "),status:a.action,cells:[<strong key="action">{a.action}</strong>,a.actorId,a.organization??a.targetType,dateTime(a.createdAt,locale)]}))} limitedNote={es?"Solo se filtran los eventos recientes cargados; Auditoría contiene la consulta histórica.":"Filters recently loaded events only; Audit provides historical search."}/></section>
    <section className="bo-section"><div className="bo-section-head"><div><h2>{es?"Cobertura de datos":"Data coverage"}</h2><p>{es?"Recuentos de fuentes disponibles; no certifican su exhaustividad":"Available-source counts; not a completeness certification"}</p></div></div><DataQuality quality={d.dataQuality} locale={locale}/>{d.visibility.finance&&d.financeMethodology?<p className="bo-disclosure">{es?`Cifras en EUR: se excluyen ${d.financeMethodology.nonEurInvoicesExcluded} facturas y ${d.financeMethodology.nonEurActivePlansExcluded} planes activos en otras divisas. ${d.financeMethodology.paidWithoutPaidAtExcluded} facturas pagadas carecen de fecha de pago.`:`EUR figures: ${d.financeMethodology.nonEurInvoicesExcluded} invoices and ${d.financeMethodology.nonEurActivePlansExcluded} active plans in other currencies excluded. ${d.financeMethodology.paidWithoutPaidAtExcluded} paid invoices have no paid date.`}</p>:null}</section>
  </div>;
}
