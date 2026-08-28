export function Status({value}:{value:string}){return <span className={`support-status status-${value.toLowerCase().replaceAll("_","-")}`}>{value.replaceAll("_"," ")}</span>}
export function dateTime(value:string|null|undefined,locale:string){if(!value)return"—";return new Date(value).toLocaleString(locale)}
export function slaLabel(sla:{overdue:boolean;minutesRemaining:number},es:boolean){if(sla.overdue)return es?"SLA vencido":"SLA overdue";if(sla.minutesRemaining<60)return`${Math.max(0,sla.minutesRemaining)} min`;return`${Math.ceil(sla.minutesRemaining/60)} h`}
