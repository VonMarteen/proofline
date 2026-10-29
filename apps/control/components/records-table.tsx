"use client";

import { useMemo, useState } from "react";
import { filterVisibleRecords, paginateVisibleRecords, type VisibleRecord } from "./records-table-filter";

/** UI-01: real client-side filtering/pagination of the records already returned by the API.
 * `limitedNote` identifies feeds whose API deliberately returns a recent subset.
 * It is never presented as pagination over the full database.
 */

export function RecordsTable({columns,records,locale,searchPlaceholder,limitedNote,emptyText}: {
  columns: string[];
  records: VisibleRecord[];
  locale: string;
  searchPlaceholder?: string;
  limitedNote?: string;
  emptyText?: string;
}) {
  const es = locale === "es";
  const [query,setQuery] = useState("");
  const [status,setStatus] = useState("");
  const [sort,setSort] = useState("original");
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(25);
  const statuses = useMemo(() => Array.from(new Set(records.map(r => r.status).filter((v):v is string => Boolean(v)))).sort(),[records]);
  const filtered = useMemo(() => filterVisibleRecords(records,query,status,sort,locale),[records,query,status,sort,locale]);
  const paginated = paginateVisibleRecords(filtered,page,pageSize);
  const {pages,page:activePage,items:visible} = paginated;
  const resetPage = () => setPage(1);
  const clear = () => {setQuery("");setStatus("");setSort("original");setPage(1);};
  return <div className="control-records-table">
    <div className="control-records-toolbar" role="search">
      <input type="search" aria-label={es?"Buscar registros":"Search records"} value={query} onChange={e=>{setQuery(e.target.value);resetPage();}} placeholder={searchPlaceholder??(es?"Buscar en registros cargados":"Search loaded records")}/>
      {statuses.length>1?<select aria-label={es?"Filtrar por estado":"Filter status"} value={status} onChange={e=>{setStatus(e.target.value);resetPage();}}><option value="">{es?"Todos los estados":"All statuses"}</option>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>:null}
      <select aria-label={es?"Orden de registros":"Record sort order"} value={sort} onChange={e=>{setSort(e.target.value);resetPage();}}><option value="original">{es?"Orden original":"Original order"}</option><option value="az">A–Z</option><option value="za">Z–A</option></select>
      <button className="control-button secondary" type="button" onClick={clear} disabled={!query&&!status&&sort==="original"}>{es?"Limpiar":"Clear"}</button>
      <span className="control-records-count" aria-live="polite"><strong>{filtered.length}</strong> {es?"registros":"records"}{filtered.length!==records.length?` / ${records.length}`:""}</span>
    </div>
    <div className="control-table-scroll"><table className="control-table"><thead><tr>{columns.map((c,i)=><th key={`${c}-${i}`} scope="col">{c}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id} className={r.tone}>{r.cells.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}{!visible.length?<tr><td colSpan={columns.length} className="control-table-empty">{emptyText??(es?"Sin resultados para estos filtros.":"No matching records.")}</td></tr>:null}</tbody></table></div>
    <div className="control-records-footer">
      <label>{es?"Filas por página":"Rows per page"}<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <nav aria-label={es?"Paginación de registros":"Record pagination"}><button className="control-button secondary" type="button" disabled={activePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>{es?"Anterior":"Previous"}</button><span>{es?"Página":"Page"} {activePage} {es?"de":"of"} {pages}</span><button className="control-button secondary" type="button" disabled={activePage>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>{es?"Siguiente":"Next"}</button></nav>
    </div>
    {limitedNote?<p className="control-records-note">{limitedNote}</p>:null}
  </div>;
}
