export function redactFreeTextPII(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[PHONE]");
}
