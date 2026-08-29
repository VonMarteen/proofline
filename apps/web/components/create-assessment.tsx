"use client";
import { Icon } from "@proofline/ui";
export function CreateAssessment({locale}:{locale:"es"|"en";defaultOpen?:boolean}){const es=locale==="es";return <a className="btn btn-accent" href={`/${locale}/assessments/new`}><Icon name="plus" size={15}/>{es?"Crear assessment":"Create assessment"}</a>}
