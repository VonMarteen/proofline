const DEFAULT_COHORT_FIELDS = ["area", "country", "seniority", "businessUnit", "team", "location"] as const;

const ALIASES: Record<string, string> = {
  area: "area",
  country: "country",
  pais: "country",
  seniority: "seniority",
  nivel: "seniority",
  nivelseniority: "seniority",
  nivelsenioridad: "seniority",
  businessunit: "businessUnit",
  unidadnegocio: "businessUnit",
  team: "team",
  equipo: "team",
  location: "location",
  ubicacion: "location",
  department: "department",
  departamento: "department",
};

type DirectoryPersonLike = {
  id: string;
  locale?: string | null;
  attributes?: unknown;
  unit?: { name?: string | null } | null;
};

function normalizedKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function canonicalField(value: string) {
  const key = normalizedKey(value);
  return ALIASES[key] ?? key;
}

function configuredFields(dataFields: unknown) {
  if (!dataFields || typeof dataFields !== "object" || Array.isArray(dataFields)) return [] as string[];
  const value = (dataFields as Record<string, unknown>).cohortFields;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map(canonicalField);
}

export function authorizedCohortFields(dataFields: unknown) {
  const configured = configuredFields(dataFields);
  const fields = configured.length ? configured : [...DEFAULT_COHORT_FIELDS];
  return ["department", ...fields.filter((field) => field !== "department")];
}

export function participantSegments(person: DirectoryPersonLike, dataFields: unknown) {
  const segments: Record<string, string> = {};
  if (person.unit?.name?.trim()) segments.department = person.unit.name.trim().slice(0, 160);

  const allowed = new Set(authorizedCohortFields(dataFields));
  const attributes = person.attributes && typeof person.attributes === "object" && !Array.isArray(person.attributes)
    ? person.attributes as Record<string, unknown>
    : {};

  for (const [rawKey, rawValue] of Object.entries(attributes)) {
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;
    const field = canonicalField(rawKey);
    if (!allowed.has(field) || field === "department") continue;
    segments[field] = rawValue.trim().slice(0, 160);
  }

  return Object.fromEntries(Object.entries(segments).sort(([a], [b]) => a.localeCompare(b)));
}

export function buildPopulationSnapshot(rows: DirectoryPersonLike[], privacyMode: string, dataFields: unknown) {
  const cohortFields = new Set<string>();
  for (const row of rows) for (const field of Object.keys(participantSegments(row, dataFields))) cohortFields.add(field);

  return {
    schemaVersion: 1,
    resolvedCount: rows.length,
    privacyMode,
    identityStored: privacyMode !== "ANONYMOUS",
    cohortFields: [...cohortFields].sort(),
  };
}
