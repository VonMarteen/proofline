"use client";
export function CreateAssessment({locale}:{locale:"es"|"en";defaultOpen?:boolean}){const es=locale==="es";return <a className="btn btn-accent" href={`/${locale}/assessments/new`}>{es?"Crear assessment":"Create assessment"}</a>}
