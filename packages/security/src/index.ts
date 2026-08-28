const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
export function redactCommonPii(input: string): string { return input.replace(EMAIL, "[EMAIL]"); }
export function safeLogValue(value: unknown): unknown { return typeof value === "string" ? redactCommonPii(value) : value; }
