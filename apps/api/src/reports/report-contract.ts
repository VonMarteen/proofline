export const REPORT_LEVELS = ["L1_EXECUTIVE", "L2_DIAGNOSTIC", "L3_ANALYTICAL", "L4_STRATEGIC"] as const;
export type ReportLevel = (typeof REPORT_LEVELS)[number];

export type ReportQuestionSample = {
  total: number;
  answered: number;
  scored: number;
  na: number;
  missing: number;
  invalid: number;
};

export type CanonicalReportSnapshot = {
  schemaVersion: "proofline-report-snapshot-v1";
  organization: { name: string; legalName?: string | null; country?: string | null };
  branding?: {
    enabled: boolean;
    configured?: boolean;
    primaryColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    logoDocumentId?: string | null;
    logoAltText?: string | null;
  };
  assessment: {
    id: string;
    title: string;
    objective: string;
    level: string;
    privacyMode: string;
    minCohortSize: number;
    assessmentVersionId?: string | null;
    assessmentVersion?: number | null;
  };
  source: {
    synthetic: boolean;
    analysisRunId?: string | null;
    sourceHash?: string | null;
    calculationHash?: string | null;
    engineName?: string | null;
    engineVersion?: string | null;
    generatedAt: string;
  };
  participation: { completed: number; total: number; rate: number };
  score: {
    overall: number | null;
    target: number | null;
    gap: number | null;
    gapConvention: string;
    n: number;
  };
  dimensions: Array<{
    name: string;
    score: number;
    target: number | null;
    gap: number | null;
    n: number;
  }>;
  questions: Array<{
    id: string;
    code: string;
    prompt: string;
    type: string;
    dimension: string | null;
    scored: boolean;
    score: number | null;
    target: number | null;
    gap: number | null;
    sample: ReportQuestionSample | null;
  }>;
  responseSummaries: string[];
  highlights: string[];
  qualitativeThemes: Array<{ theme: string; mentions: number; example?: string | null }>;
  cohorts: {
    visible: Array<{ key: string; n: number; score: number | null }>;
    suppressedCount: number;
  };
  distributions: {
    choice: Record<string, Record<string, number>>;
    ranking: Record<string, Array<{ option: string; averageRank: number; n: number }>>;
    allocation: Record<string, Record<string, number>>;
    matrix: Record<string, Record<string, Record<string, number>>>;
  };
  methodology: string;
  evidencePolicy: string;
  limitations: string[];
};

export type ReportEnvelope = {
  schemaVersion: "proofline-report-envelope-v2";
  level: ReportLevel;
  canonical: CanonicalReportSnapshot;
};

export function normalizeReportLevel(value: unknown): ReportLevel {
  const raw = String(value ?? "").toUpperCase();
  if ((REPORT_LEVELS as readonly string[]).includes(raw)) return raw as ReportLevel;
  if (raw === "EXECUTIVE") return "L1_EXECUTIVE";
  if (raw === "FULL") return "L4_STRATEGIC";
  return "L1_EXECUTIVE";
}

export function legacyReportKind(level: ReportLevel): "EXECUTIVE" | "FULL" {
  return level === "L1_EXECUTIVE" ? "EXECUTIVE" : "FULL";
}

export function reportLevelLabel(level: ReportLevel, locale: "es" | "en" = "es") {
  const es = locale === "es";
  const labels: Record<ReportLevel, string> = {
    L1_EXECUTIVE: es ? "L1 · Ejecutivo" : "L1 · Executive",
    L2_DIAGNOSTIC: es ? "L2 · Diagnóstico" : "L2 · Diagnostic",
    L3_ANALYTICAL: es ? "L3 · Analítico" : "L3 · Analytical",
    L4_STRATEGIC: es ? "L4 · Estratégico" : "L4 · Strategic",
  };
  return labels[level];
}

export function reportDepth(level: ReportLevel) {
  return ({ L1_EXECUTIVE: 1, L2_DIAGNOSTIC: 2, L3_ANALYTICAL: 3, L4_STRATEGIC: 4 } as const)[level];
}

export function isReportEnvelope(value: unknown): value is ReportEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.schemaVersion === "proofline-report-envelope-v2" && Boolean(row.canonical) && Boolean(row.level);
}
