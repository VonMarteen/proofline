/** CQF-F2: Internal intake is not a customer consent or payment. */
export type InternalOpportunityInput = {
  mode: "DEMO" | "START";
  name: string;
  email: string;
  company: string;
  country?: string;
  estimatedParticipants?: number;
  planCode?: string;
  useCase?: string;
  locale: "es" | "en";
};
export function normalizeInternalOpportunity(input: InternalOpportunityInput) {
  return {
    mode: input.mode,
    name: input.name.trim(), email: input.email.trim().toLowerCase(),
    company: input.company.trim(), country: input.country?.trim() || null,
    estimatedParticipants: input.estimatedParticipants ?? null,
    planCode: input.planCode?.trim() || null,
    useCase: input.useCase?.trim() || null, locale: input.locale,
  };
}
export const CLOSED_OPPORTUNITY_STAGES = ["LOST", "PROVISIONED"] as const;
export function activeDuplicateFilter(emailLookup: string, company: string) {
  return { emailLookup, company: { equals: company, mode: "insensitive" as const },
    stage: { notIn: [...CLOSED_OPPORTUNITY_STAGES] } };
}
