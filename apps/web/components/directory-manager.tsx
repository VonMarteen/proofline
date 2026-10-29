"use client";

import { PaginationBar } from "@proofline/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";

const H = { "content-type": "application/json" };

export function DirectoryManager({
  locale,
  data,
  filters,
}: {
  locale: "es" | "en";
  data: any;
  filters: { q: string; unit: string };
}) {
  const es = locale === "es";
  const router = useRouter();
  const [form, setForm] = useState<"unit" | "person" | "import" | null>(null);
  const [msg, setMsg] = useState("");

  async function post(path: string, body: any) {
    const response = await fetch(`/api/proxy${path}`, { method: "POST", headers: H, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? `API ${response.status}`);
    router.refresh();
    setMsg(es ? "Cambios guardados." : "Changes saved.");
  }

  const unitHref = (unit: string) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (unit !== "ALL") params.set("unit", unit);
    params.set("page", "1");
    params.set("pageSize", String(data.pagination.pageSize));
    return `/${locale}/directory?${params.toString()}`;
  };

  return <div className="directory-manager">
    <div className="workspace-toolbar">
      <form method="get" action={`/${locale}/directory`} className="workspace-filter-form" data-proofline-no-confirm="true">
        <input className="input" name="q" defaultValue={filters.q} placeholder={es ? "Buscar persona, email, puesto o área…" : "Search people, email, role or unit…"} />
        <select className="select" name="unit" defaultValue={filters.unit}>
          <option value="ALL">{es ? "Todas las áreas" : "All units"}</option>
          {data.units.map((u: any) => <option key={u.id} value={u.id}>{u.name} · {u.people}</option>)}
        </select>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(data.pagination.pageSize)} />
        <button className="btn" type="submit">{es ? "Filtrar" : "Filter"}</button>
      </form>
      <div className="workspace-card-actions">
        <button className="btn" onClick={() => setForm(form === "import" ? null : "import")}>{es ? "Importar CSV / Excel" : "Import CSV / Excel"}</button>
        <button className="btn" onClick={() => setForm(form === "unit" ? null : "unit")}>{es ? "Nueva área" : "New unit"}</button>
        <button className="btn btn-accent" onClick={() => setForm(form === "person" ? null : "person")}>{es ? "Añadir persona" : "Add person"}</button>
      </div>
    </div>

    {msg ? <div className="workspace-alert">{msg}</div> : null}

    {form === "unit" ? <form className="workspace-inline-form" onSubmit={async (event) => {
      event.preventDefault();
      const f = new FormData(event.currentTarget);
      await post("/v1/workspace/directory/units", { name: f.get("name"), code: f.get("code"), type: f.get("type") });
      setForm(null);
    }}>
      <input className="input" name="name" placeholder={es ? "Nombre del área" : "Unit name"} required />
      <input className="input" name="code" placeholder="Code" />
      <select className="select" name="type"><option value="DEPARTMENT">{es ? "Departamento" : "Department"}</option><option value="TEAM">Team</option><option value="BUSINESS_UNIT">Business unit</option><option value="LOCATION">Location</option></select>
      <button className="btn btn-accent">{es ? "Crear" : "Create"}</button>
    </form> : null}

    {form === "person" ? <form className="workspace-inline-form" onSubmit={async (event) => {
      event.preventDefault();
      const f = new FormData(event.currentTarget);
      await post("/v1/workspace/directory/people", { name: f.get("name"), email: f.get("email"), jobTitle: f.get("jobTitle"), employeeCode: f.get("employeeCode"), unitId: f.get("unitId") || null, locale: "es", attributes: {} });
      setForm(null);
    }}>
      <input className="input" name="name" placeholder={es ? "Nombre" : "Name"} required />
      <input className="input" name="email" type="email" placeholder="Email" required />
      <input className="input" name="jobTitle" placeholder={es ? "Puesto" : "Job title"} />
      <select className="select" name="unitId"><option value="">—</option>{data.units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <input className="input" name="employeeCode" placeholder="ID" />
      <button className="btn btn-accent">{es ? "Añadir" : "Add"}</button>
    </form> : null}

    {form === "import" ? <form className="workspace-import-panel" onSubmit={async (event) => {
      event.preventDefault();
      const f = new FormData(event.currentTarget);
      const text = String(f.get("rows") ?? "");
      const rows = text.split(/\r?\n/).filter(Boolean).map((line) => {
        const columns = (line.includes("\t") ? line.split("\t") : line.split(",")).map((value) => value.trim());
        const unit = data.units.find((item: any) => item.name.toLowerCase() === String(columns[2] ?? "").toLowerCase());
        return { name: columns[0], email: columns[1], unitId: unit?.id ?? null, jobTitle: columns[3] ?? "", employeeCode: columns[4] ?? "", locale: "es", attributes: {} };
      }).filter((row) => row.name && row.email);
      await post("/v1/workspace/directory/import", { rows });
      setForm(null);
    }}>
      <h3>{es ? "Importación masiva" : "Bulk import"}</h3>
      <p>{es ? "Pega filas desde Excel: Nombre, Email, Área, Puesto, ID." : "Paste rows from Excel: Name, Email, Unit, Job title, ID."}</p>
      <textarea className="textarea" name="rows" required />
      <button className="btn btn-accent">{es ? "Importar" : "Import"}</button>
    </form> : null}

    <div className="directory-layout">
      <aside className="directory-units">
        <h2>{es ? "Estructura" : "Structure"}</h2>
        <a className={filters.unit === "ALL" ? "active" : ""} href={unitHref("ALL")}><span><strong>{es ? "Todas las áreas" : "All units"}</strong><small>{es ? "Directorio completo" : "Full directory"}</small></span><b>{data.totalActive}</b></a>
        {data.units.map((u: any) => <a key={u.id} className={filters.unit === u.id ? "active" : ""} href={unitHref(u.id)}><span><strong>{u.name}</strong><small>{u.type}</small></span><b>{u.people}</b></a>)}
      </aside>
      <section className="directory-people">
        <div className="ws-r3-table-meta">{es ? `Página ${data.pagination.page} de ${data.pagination.pages} · ${data.pagination.total} registros` : `Page ${data.pagination.page} of ${data.pagination.pages} · ${data.pagination.total} records`}</div><div className="directory-table-head"><span>{es ? "Nombre" : "Name"}</span><span>Email</span><span>{es ? "Área" : "Unit"}</span><span>{es ? "Puesto" : "Job title"}</span><span>{es ? "Idioma" : "Language"}</span></div>
        {data.items.length ? data.items.map((p: any) => <article className="directory-person-row" key={p.id}>
          <div><span className="workspace-avatar">{p.name.split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</span><strong>{p.name}</strong></div>
          <span className="ws-r3-ellipsis" title={p.email}>{p.email}</span><span>{p.unit?.name ?? "—"}</span><span>{p.jobTitle ?? "—"}</span><span>{p.locale.toUpperCase()}</span>
        </article>) : <div className="workspace-empty-state"><h3>{es ? "Sin resultados" : "No results"}</h3><p>{es ? "Prueba otra búsqueda o cambia el área seleccionada." : "Try another search or change the selected unit."}</p></div>}
        <PaginationBar pagination={data.pagination} basePath={`/${locale}/directory`} query={{ q: filters.q, unit: filters.unit === "ALL" ? undefined : filters.unit }} locale={locale} />
      </section>
    </div>
  </div>;
}
