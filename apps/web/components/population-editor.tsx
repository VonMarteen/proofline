"use client";

import { requestProoflineConfirmation } from "@proofline/ui/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function PopulationEditor({ assessmentId, locale, directory, population }: { assessmentId: string; locale: "es" | "en"; directory: any; population: any }) {
  const es = locale === "es";
  const router = useRouter();
  const [all, setAll] = useState(population.targets.some((t: any) => t.type === "ALL"));
  const [units, setUnits] = useState<string[]>(population.targets.filter((t: any) => t.type === "UNIT").map((t: any) => t.unitId));
  const [people, setPeople] = useState<string[]>(population.targets.filter((t: any) => t.type === "PERSON").map((t: any) => t.personId));
  const [exclude, setExclude] = useState<string[]>(population.targets.filter((t: any) => t.type === "EXCLUDE_PERSON").map((t: any) => t.personId));
  const [resolvedCount, setResolvedCount] = useState(population.resolvedCount);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [browseUnit, setBrowseUnit] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [picker, setPicker] = useState<any>({ items: [], pagination: { page: 1, pageSize: 25, total: 0, pages: 1, hasPrevious: false, hasNext: false } });
  const [loadingPeople, setLoadingPeople] = useState(false);
  const locked = Boolean(population.locked);
  const frozen = Boolean(population.frozen);

  const initialAll = population.targets.some((t: any) => t.type === "ALL");
  const initialUnits = population.targets.filter((t: any) => t.type === "UNIT").map((t: any) => t.unitId).sort();
  const initialPeople = population.targets.filter((t: any) => t.type === "PERSON").map((t: any) => t.personId).sort();
  const initialExclude = population.targets.filter((t: any) => t.type === "EXCLUDE_PERSON").map((t: any) => t.personId).sort();
  const dirty = all !== initialAll || JSON.stringify([...units].sort()) !== JSON.stringify(initialUnits) || JSON.stringify([...people].sort()) !== JSON.stringify(initialPeople) || JSON.stringify([...exclude].sort()) !== JSON.stringify(initialExclude);

  const payload = useMemo(() => ({ all, unitIds: all ? [] : units, personIds: all ? [] : people, excludePersonIds: exclude }), [all, units, people, exclude]);
  const toggle = (values: string[], id: string, setter: (next: string[]) => void) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  useEffect(() => {
    if (locked) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(query.trim() ? { q: query.trim() } : {}), ...(browseUnit !== "ALL" ? { unitId: browseUnit } : {}) });
        setLoadingPeople(true);
        const response = await fetch(`/api/proxy/v1/workspace/directory/table?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (response.ok) setPicker(body);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMsg(es ? "No se pudo actualizar el directorio." : "The directory could not be refreshed.");
      } finally {
        if (!controller.signal.aborted) setLoadingPeople(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, browseUnit, page, pageSize, locked]);

  useEffect(() => {
    if (locked) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/proxy/v1/workspace/assessments/${assessmentId}/population/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
        const body = await response.json();
        if (response.ok && typeof body.resolvedCount === "number") setResolvedCount(body.resolvedCount);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMsg(es ? "No se pudo calcular la población." : "The population could not be calculated.");
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [payload, assessmentId, locked]);

  async function save() {
    const ok = await requestProoflineConfirmation({ title: es ? "Guardar población" : "Save population", message: es ? `¿Quieres guardar esta población de ${resolvedCount} personas?` : `Save this population of ${resolvedCount} people?`, confirmLabel: es ? "Guardar población" : "Save population" });
    if (!ok) return;
    const response = await fetch(`/api/proxy/v1/workspace/assessments/${assessmentId}/population`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    setMsg(response.ok ? (es ? `Población guardada: ${body.resolvedCount} personas.` : `Population saved: ${body.resolvedCount} people.`) : (Array.isArray(body.message) ? body.message.join(" · ") : body.message ?? "Error"));
    if (response.ok) router.refresh();
  }

  if (locked) return <div className="population-editor population-locked"><div className="population-summary"><strong>{population.resolvedCount}</strong><span>{frozen ? (es ? "participantes en la población congelada" : "participants in the frozen population") : (es ? "personas en la población preparada" : "people in the prepared population")}</span></div><div className="population-lock-note"><strong>{frozen ? (es ? "Población congelada" : "Population frozen") : (es ? "Población preparada y bloqueada" : "Population prepared and locked")}</strong><p>{frozen ? (es ? "La población quedó congelada al lanzar el assessment. Cambios posteriores del directorio no alterarán el denominador ni las cohortes históricas." : "The population was frozen when the assessment launched. Later directory changes will not alter the historical denominator or cohorts.") : (es ? "El assessment está listo y su configuración de población está bloqueada. La población definitiva se congelará exactamente al lanzar el assessment." : "The assessment is ready and its population configuration is locked. The final population will be frozen exactly when the assessment launches.")}</p></div>{population.people?.length ? <div className="population-snapshot-list">{population.people.slice(0, 10).map((p: any) => <span key={p.id}><strong>{p.name}</strong><small>{p.unit ?? "—"}</small></span>)}{population.resolvedCount > 10 ? <small>+{population.resolvedCount - 10} {es ? "personas más" : "more people"}</small> : null}</div> : null}</div>;

  return <div className="population-editor">
    <div className="population-summary"><strong>{resolvedCount}</strong><span>{es ? "personas seleccionadas" : "people selected"}</span>{dirty ? <b>{es ? "Cambios sin guardar" : "Unsaved changes"}</b> : <b className="saved">{es ? "Guardado" : "Saved"}</b>}</div>
    <section className="population-targets" aria-label={es ? "Organización y áreas" : "Organization and departments"}>
      <div className="population-targets-heading"><strong>{es ? "Organización y áreas" : "Organization and departments"}</strong><small>{es ? "Selecciona la organización completa o combina áreas con personas." : "Select the whole organization or combine departments with people."}</small></div>
      <label className="population-all"><input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} /><span className="population-target-inline"><strong>{es ? "Toda la organización activa" : "All active people"}</strong><small>{es ? "Directorio completo" : "Full directory"}</small></span></label>
      {!all ? <div className="population-units">{directory.units.map((u: any) => <label key={u.id}><input type="checkbox" checked={units.includes(u.id)} onChange={() => toggle(units, u.id, setUnits)} /><span className="population-target-inline"><strong>{u.name}</strong><small>{u.people} {es ? "personas" : "people"}</small></span></label>)}</div> : <p className="population-targets-note">{es ? "La organización completa está seleccionada. A la derecha puedes excluir personas concretas." : "The entire organization is selected. On the right, you can exclude individual people."}</p>}
    </section>

    <section className="population-browser">
      <div className="population-browser-head"><div><strong>{all ? (es ? "Exclusiones individuales" : "Individual exclusions") : (es ? "Personas concretas" : "Specific people")}</strong><small>{all ? (es ? "Puedes excluir personas de la organización completa." : "Exclude individuals from the entire organization.") : (es ? "Marca personas para incluirlas o usa Excluir; se combinan con las áreas seleccionadas." : "Check people to include or use Exclude; combined with selected departments.")}</small></div>{loadingPeople ? <span>{es ? "Actualizando…" : "Updating…"}</span> : null}</div>
      <div className="population-browser-filters"><input className="input" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={es ? "Buscar nombre, email, puesto o área…" : "Search name, email, role or unit…"} /><select className="select" value={browseUnit} onChange={(event) => { setBrowseUnit(event.target.value); setPage(1); }}><option value="ALL">{es ? "Todas las áreas" : "All units"}</option>{directory.units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div className="population-person-list">{picker.items.map((p: any) => <label key={p.id}>{!all ? <input type="checkbox" aria-label={`${es ? "Incluir" : "Include"}: ${p.name}`} checked={people.includes(p.id)} onChange={() => toggle(people, p.id, setPeople)} /> : null}<span className="population-person-inline"><strong>{p.name}</strong><small>{p.unit?.name ?? "—"} · {p.jobTitle ?? "—"}</small></span><button type="button" aria-pressed={exclude.includes(p.id)} aria-label={`${exclude.includes(p.id) ? (es ? "Quitar exclusión" : "Remove exclusion") : (es ? "Excluir" : "Exclude")}: ${p.name}`} className={exclude.includes(p.id) ? "exclude active" : "exclude"} onClick={(event) => { event.preventDefault(); toggle(exclude, p.id, setExclude); }}>{exclude.includes(p.id) ? (es ? "Excluida" : "Excluded") : (es ? "Excluir" : "Exclude")}</button></label>)}</div>
      <div className="population-browser-pager"><button className="btn" disabled={!picker.pagination.hasPrevious} onClick={() => setPage((value) => Math.max(1, value - 1))}>{es ? "Anterior" : "Previous"}</button><label>{es ? "Filas" : "Rows"}<select className="select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><span>{es ? `Página ${picker.pagination.page} de ${picker.pagination.pages}` : `Page ${picker.pagination.page} of ${picker.pagination.pages}`}</span><button className="btn" disabled={!picker.pagination.hasNext} onClick={() => setPage((value) => value + 1)}>{es ? "Siguiente" : "Next"}</button></div>
    </section>

    <button className="btn btn-accent" onClick={save} disabled={!dirty}>{es ? "Guardar población" : "Save population"}</button>
    {msg ? <div className="workspace-alert">{msg}</div> : null}
  </div>;
}
