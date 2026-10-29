/** Pure reporting primitives. No Prisma / request context: deterministic and unit-testable. */
export const DAY = 86_400_000;
export const percentChange = (current:number,previous:number):number|null => previous===0?(current===0?0:null):Math.round(((current-previous)/Math.abs(previous))*1000)/10;
export type ReportWindow={start:Date;end:Date;previousStart:Date;previousEnd:Date;range:string};
export function resolveWindow(range?:string,from?:string,to?:string,now=new Date()):ReportWindow{
  const validRange=new Set(["7d","30d","90d","365d"]);
  const selected=validRange.has(range??"")?range!:"30d";
  const days=Number(selected.slice(0,-1));
  const parseDay=(value?:string)=>{
    if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const d=new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
  };
  const customStart=parseDay(from),customEnd=parseDay(to);
  const valid=Boolean(customStart&&customEnd&&customStart<=customEnd&&customStart<=now&&
    (customEnd.getTime()-customStart.getTime())/DAY<=365);
  const end=valid?new Date(Math.min(now.getTime(),customEnd!.getTime()+DAY-1)):now;
  const start=valid?customStart!:new Date(end.getTime()-days*DAY);
  const span=end.getTime()-start.getTime();
  return{start,end,previousStart:new Date(start.getTime()-span),previousEnd:new Date(start.getTime()),range:valid?"custom":selected};
}
export function bucketKey(date:Date,spanDays:number){
  if(spanDays>120)return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-01`;
  if(spanDays>45){const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return d.toISOString().slice(0,10)}
  return date.toISOString().slice(0,10);
}
export type InvoiceRow={status:string;currency:string;amountCents:number;taxCents:number;issuedAt:Date;paidAt:Date|null};
export function summarizeEurInvoices<T extends InvoiceRow>(invoices:T[],w:ReportWindow){
  const eurInvoices=invoices.filter(i=>i.currency==="EUR");
  const inWindow=(d:Date|null,from:Date,to:Date,exclusive=false)=>Boolean(d&&d>=from&&(exclusive?d<to:d<=to));
  const currentInvoices=eurInvoices.filter(i=>inWindow(i.issuedAt,w.start,w.end));
  const previousInvoices=eurInvoices.filter(i=>inWindow(i.issuedAt,w.previousStart,w.previousEnd,true));
  const currentPaid=eurInvoices.filter(i=>i.status==="PAID"&&inWindow(i.paidAt,w.start,w.end));
  const previousPaid=eurInvoices.filter(i=>i.status==="PAID"&&inWindow(i.paidAt,w.previousStart,w.previousEnd,true));
  const gross=(i:T)=>i.amountCents+i.taxCents;
  const sum=(rows:T[])=>rows.reduce((a,i)=>a+gross(i),0);
  return{
    currentInvoices,previousInvoices,currentPaid,previousPaid,
    revenueCents:sum(currentPaid),previousRevenueCents:sum(previousPaid),
    billedCents:sum(currentInvoices.filter(i=>i.status!=="VOID")),
    previousBilledCents:sum(previousInvoices.filter(i=>i.status!=="VOID")),
    nonEurInvoicesExcluded:invoices.length-eurInvoices.length,
    paidWithoutPaidAtExcluded:eurInvoices.filter(i=>i.status==="PAID"&&!i.paidAt).length,
  };
}
export type TimelineBucket={date:string;revenueCents:number;billedCents:number;customers:number;tickets:number};
export function buildTimeline<T extends InvoiceRow>(w:ReportWindow,issued:T[],paid:T[],organizations:{createdAt:Date}[],tickets:{createdAt:Date}[]):TimelineBucket[]{
  const spanDays=Math.ceil((w.end.getTime()-w.start.getTime())/DAY);
  const timeline=new Map<string,TimelineBucket>();
  const ensure=(d:Date)=>{const key=bucketKey(d,spanDays);if(!timeline.has(key))timeline.set(key,{date:key,revenueCents:0,billedCents:0,customers:0,tickets:0});return timeline.get(key)!};
  for(let ts=w.start.getTime();ts<=w.end.getTime();ts+=DAY)ensure(new Date(ts));
  ensure(w.end);
  issued.filter(i=>i.status!=="VOID").forEach(i=>{ensure(i.issuedAt).billedCents+=i.amountCents+i.taxCents});
  paid.forEach(i=>{if(i.paidAt)ensure(i.paidAt).revenueCents+=i.amountCents+i.taxCents});
  organizations.filter(o=>o.createdAt>=w.start&&o.createdAt<=w.end).forEach(o=>ensure(o.createdAt).customers++);
  tickets.filter(t=>t.createdAt>=w.start&&t.createdAt<=w.end).forEach(t=>ensure(t.createdAt).tickets++);
  return[...timeline.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
