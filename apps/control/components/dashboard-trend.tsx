"use client";

import { useEffect, useState } from "react";
import { TrendChart, type TrendMetric, type TrendPoint } from "./backoffice-ui";

const labels: Record<TrendMetric, {es:string;en:string}> = {
  revenueCents: { es: "Facturas pagadas", en: "Paid invoices" },
  billedCents: { es: "Facturas emitidas", en: "Issued invoices" },
  customers: { es: "Altas", en: "New organizations" },
  tickets: { es: "Tickets", en: "Tickets" },
};

/** Switching a series is strictly client-side: all series are already contained in the authorized dashboard response.
 * Native history.replaceState preserves the query deep link without requesting or caching fresh server data.
 * Period changes still use Next.js navigation and re-query the API.
 */
export function DashboardTrend({points,locale,metrics,initialMetric}:{points:TrendPoint[];locale:string;metrics:TrendMetric[];initialMetric:TrendMetric}) {
  const [metric,setMetric] = useState<TrendMetric>(initialMetric);
  useEffect(() => {
    const syncFromHistory = () => {
      const requested = new URLSearchParams(window.location.search).get("metric") as TrendMetric | null;
      setMetric(requested && metrics.includes(requested) ? requested : initialMetric);
    };
    window.addEventListener("popstate",syncFromHistory);
    return () => window.removeEventListener("popstate",syncFromHistory);
  },[initialMetric,metrics]);
  function choose(next:TrendMetric) {
    if(next === metric) return;
    setMetric(next);
    const url = new URL(window.location.href);
    url.searchParams.set("metric",next);
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
  }
  return <>
    <div className="bo-metric-tabs" role="group" aria-label={locale==="es"?"Indicador gráfico":"Chart metric"}>
      {metrics.map(m => <button type="button" key={m} className={metric===m?"active":""} aria-pressed={metric===m} onClick={() => choose(m)}>{labels[m][locale==="es"?"es":"en"]}</button>)}
    </div>
    <TrendChart points={points} locale={locale} metric={metric}/>
  </>;
}
