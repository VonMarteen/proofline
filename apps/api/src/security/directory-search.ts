import { blindIndex } from "./crypto.js";

export const DIRECTORY_SEARCH_INDEX_VERSION = 1;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function terms(value: string) {
  const normalized = normalize(value);
  const parts = normalized.split(/[^a-z0-9]+/g).filter((item) => item.length >= 2);
  return normalized.includes("@") ? [...new Set([...parts, normalized])] : [...new Set(parts)];
}

function prefixes(value: string) {
  const result: string[] = [];
  for (let size = 2; size <= Math.min(value.length, 48); size += 1) result.push(value.slice(0, size));
  return result;
}

function tokenHash(value: string) {
  return blindIndex(`directory-search:${value}`);
}

export function buildDirectorySearchIndex(input: {
  name: string;
  email: string;
  jobTitle?: string | null;
  employeeCode?: string | null;
}) {
  const raw = [input.name, input.email, input.jobTitle ?? "", input.employeeCode ?? ""];
  const values = new Set<string>();
  for (const field of raw) {
    for (const term of terms(field)) {
      for (const prefix of prefixes(term)) values.add(prefix);
    }
  }
  return [...values].map(tokenHash).sort();
}

export function directorySearchQueryTokens(query: string) {
  return terms(query).map(tokenHash);
}
