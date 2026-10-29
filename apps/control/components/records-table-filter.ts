import type { ReactNode } from "react";

export type VisibleRecord = {
  id: string;
  search: string;
  status?: string;
  cells: ReactNode[];
  tone?: string;
};

function normalizeTerm(value:string,locale:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(locale).trim();
}

/** Operates only on records actually returned by the server: never claims DB-wide paging. */
export function filterVisibleRecords<T extends Pick<VisibleRecord,"search"|"status">>(records:readonly T[],query:string,status:string,sort:string,locale:string):T[]{
  const term=normalizeTerm(query,locale);
  const list=records.filter(r=>(!term||normalizeTerm(r.search,locale).includes(term))&&(!status||r.status===status));
  if(sort==="az")list.sort((a,b)=>a.search.localeCompare(b.search,locale));
  if(sort==="za")list.sort((a,b)=>b.search.localeCompare(a.search,locale));
  return list;
}

export function paginateVisibleRecords<T>(records:readonly T[],page:number,pageSize:number){
  const size=([25,50,100].includes(pageSize)?pageSize:25);
  const pages=Math.max(1,Math.ceil(records.length/size));
  const current=Math.max(1,Math.min(Number.isInteger(page)?page:1,pages));
  const start=(current-1)*size;
  return {items:records.slice(start,start+size),page:current,pages,pageSize:size,total:records.length};
}
