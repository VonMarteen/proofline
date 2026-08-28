export type QuestionType = "LIKERT" | "DUAL" | "LONG_TEXT" | "SINGLE" | "MULTI" | "PERCENTAGE";
export type RespondQuestion = { id: string; order: number; type: QuestionType; prompt: string; dimension?: string | null; required: boolean; config?: Record<string, unknown> | null };
export type RespondAssessment = { id: string; title: string; objective: string; locale: string; organization: { name: string }; notice: { id: string; version: string; title: string; content: string }; questions: RespondQuestion[]; status: string };
export type AnalysisResult = { overallScore?: number; completedResponses: number; dimensionScores: Record<string, number>; questionScores: Record<string, number>; highlights: string[]; generatedAt: string };
