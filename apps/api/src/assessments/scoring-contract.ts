import { BadRequestException } from "@nestjs/common";

export const CORE_SCORING_TYPES = new Set([
  "LIKERT",
  "YES_NO",
  "SINGLE",
  "MULTI",
  "CHECKBOX",
  "NPS",
  "NUMERIC",
  "RANGE",
  "PERCENTAGE",
  "SLIDER",
  "MATRIX",
  "DUAL",
]);

export type QuestionPolarityValue = "POSITIVE" | "REVERSE" | "CUSTOM";

export function defaultScoredForType(type: string) {
  return !["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(type);
}

export function effectivePolarity(input: {
  polarity?: QuestionPolarityValue | null;
  reverseScore?: boolean | null;
}): QuestionPolarityValue {
  if (input.polarity) return input.polarity;
  return input.reverseScore ? "REVERSE" : "POSITIVE";
}

export function questionCode(order: number) {
  return `Q${String(order).padStart(3, "0")}`;
}

export function normalizeQuestionScoring(input: {
  type: string;
  scored?: boolean;
  polarity?: QuestionPolarityValue;
  reverseScore?: boolean;
  weight?: number;
  config?: unknown;
}) {
  const scored = input.type === "INFO" ? false : input.scored ?? defaultScoredForType(input.type);
  const polarity = effectivePolarity({
    polarity: input.polarity,
    reverseScore: input.reverseScore,
  });
  const weight = scored ? Number(input.weight ?? 1) : 1;
  const config = (input.config ?? null) as Record<string, unknown> | null;

  if (scored && (!Number.isFinite(weight) || weight < 0.25 || weight > 5)) {
    throw new BadRequestException("Scored question weight must be between 0.25 and 5.00");
  }

  if (scored && ["SHORT_TEXT", "LONG_TEXT", "INFO", "RANKING", "ALLOCATION"].includes(input.type)) {
    throw new BadRequestException(`${input.type} is not scoreable in Assessment Engine v1`);
  }

  if (scored && polarity === "CUSTOM") {
    const customScores = config?.customScores;
    const options = Array.isArray(config?.options) ? (config?.options as unknown[]) : [];
    const optionScores = options.some((option: any) => option && typeof option === "object" && Number.isFinite(Number(option.score)));
    const hasCustomMap = Boolean(customScores && typeof customScores === "object" && Object.keys(customScores as object).length);
    if (!optionScores && !hasCustomMap) {
      throw new BadRequestException("CUSTOM polarity requires option scores or config.customScores");
    }
  }

  return {
    scored,
    polarity,
    reverseScore: polarity === "REVERSE",
    weight,
    config,
  };
}

export function normalizeAssessmentScoringConfig(value: unknown) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawWeights = input.dimensionWeights && typeof input.dimensionWeights === "object"
    ? (input.dimensionWeights as Record<string, unknown>)
    : {};
  const dimensionWeights: Record<string, number> = {};
  for (const [dimension, raw] of Object.entries(rawWeights)) {
    const weight = Number(raw);
    if (!dimension.trim()) continue;
    if (!Number.isFinite(weight) || weight < 0.25 || weight > 5) {
      throw new BadRequestException(`Dimension weight for ${dimension} must be between 0.25 and 5.00`);
    }
    dimensionWeights[dimension] = weight;
  }

  return {
    version: 1,
    scale: "0-100",
    dimensionWeights,
    bands: input.bands ?? {
      critical: [0, 39],
      attention: [40, 59],
      stable: [60, 74],
      strong: [75, 89],
      exceptional: [90, 100],
    },
  };
}
