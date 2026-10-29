import Link from "next/link";
import { normalizeLocale } from "@proofline/i18n";
import { PaginationBar } from "@proofline/ui";
import { controlGet } from "../../../lib/api";
import { Metric, PageIntro, Panel, Status, date } from "../../../components/control-ui";

type Search={q?:string;category?:string;origin?:string;visibility?:string;sort?:string;page?:string;pageSize?:string};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Search>}){
  const {locale:raw}=await params,sp=await searchParams,locale=normalizeLocale(raw),es=locale==="es";
  const qs=new URLSearchParams({page:sp.page??"1",pageSize:sp.pageSize??"25"});
  for(const key of ["q","category","origin","visibility","sort"] as const)if(sp[key])qs.set(key,sp[key]!);
  const data=await controlGet(`/v1/control/tables/marketplace?${qs}`);
  const rows=data.items??[],summary=data.summary??{},categories=data.filters?.categories??[];
  return <div className="control-stack">
    <PageIntro title="Marketplace"/>
    <div className="control-metrics control-metrics-3"><Metric label={es?"Frameworks totales":"Total frameworks"} value={summary.frameworks??0}/><Metric label={es?"Assessments con framework":"Assessments with framework"} value={summary.uses??0}/><Metric label={es?"Categorías":"Categories"} value={summary.categories??0}/></div>
    <Panel title={es?"Catálogo de frameworks":"Framework catalog"}>
      <form method="get" className="bo-filter-form bo-table-filters" data-proofline-no-confirm="true" role="search">
        <input name="q" maxLength={120} aria-label={es?"Buscar framework":"Search framework"} placeholder={es?"Nombre, editor o slug":"Name, publisher or slug"} defaultValue={sp.q??""}/>
        <select name="category" defaultValue={sp.category??""} aria-label={es?"Categoría":"Category"}><option value="">{es?"Todas las categorías":"All categories"}</option>{categories.map((c:string)=><option key={c} value={c}>{c}</option>)}</select>
        <select name="origin" defaultValue={sp.origin??""} aria-label={es?"Origen":"Origin"}><option value="">{es?"Todos los orígenes":"All origins"}</option>{["PROOFLINE","VALIDATED","PARTNER","PRIVATE"].map(x=><option key={x}>{x}</option>)}</select>
        <select name="visibility" defaultValue={sp.visibility??""} aria-label={es?"Visibilidad":"Visibility"}><option value="">{es?"Todas las visibilidades":"All visibility"}</option>{["PUBLIC","PRIVATE","LICENSED"].map(x=><option key={x}>{x}</option>)}</select>
        <select name="sort" defaultValue={sp.sort??"category"} aria-label={es?"Orden":"Sort"}><option value="category">{es?"Categoría · nombre":"Category · name"}</option><option value="nameDesc">{es?"Nombre Z–A":"Name Z–A"}</option><option value="recent">{es?"Más recientes":"Newest first"}</option></select>
        <input type="hidden" name="page" value="1"/><input type="hidden" name="pageSize" value={data.pagination.pageSize}/>
        <button type="submit">{es?"Aplicar":"Apply"}</button><a className="control-button secondary" href={`/${locale}/marketplace`}>{es?"Limpiar":"Reset"}</a>
      </form>
      <p className="control-note">{data.pagination.total} {es?"frameworks coincidentes. Los usos son referencias de assessments a versiones, no ventas ni licencias verificadas.":"matching frameworks. Usage counts are assessment references to versions, not verified sales or licenses."}</p>
      <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Framework</th><th>{es?"Categoría":"Category"}</th><th>{es?"Origen":"Origin"}</th><th>{es?"Visibilidad":"Visibility"}</th><th>{es?"Última versión":"Latest version"}</th><th>{es?"Publicado":"Published"}</th><th>{es?"Licencia declarada":"Declared license"}</th><th>{es?"Uso":"Usage"}</th></tr></thead><tbody>{rows.map((f:any)=>{
        const latest=f.versions[0],uses=f.versions.reduce((n:number,v:any)=>n+v._count.assessments,0);
        return <tr key={f.id}><td><Link className="control-link-strong" href={`/${locale}/marketplace/${encodeURIComponent(f.id)}`}>{f.name}</Link><span className="control-cell-secondary">{f.publisher} · {f.slug}</span></td><td>{f.category}</td><td><Status value={f.origin}/></td><td><Status value={f.visibility}/></td><td><strong>{latest?.version??"—"}</strong><span className="control-cell-secondary">{f.versions.length} {es?"versiones":"versions"}</span></td><td>{date(latest?.publishedAt,locale)}</td><td className="p5-license">{latest?.license??"—"}</td><td className="control-number">{uses}</td></tr>;
      })}{!rows.length?<tr><td colSpan={8} className="control-table-empty">{es?"Sin frameworks para estos filtros.":"No frameworks match these filters."}</td></tr>:null}</tbody></table>
        <PaginationBar pagination={data.pagination} basePath={`/${locale}/marketplace`} query={{q:sp.q,category:sp.category,origin:sp.origin,visibility:sp.visibility,sort:sp.sort}} locale={locale}/>
      </div>
    </Panel>
  </div>;
}
