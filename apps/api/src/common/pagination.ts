export const PROOFLINE_PAGE_SIZES = [25, 50, 100] as const;
export type ProoflinePageSize = (typeof PROOFLINE_PAGE_SIZES)[number];
export type PaginationInput = { page?: string | number; pageSize?: string | number };

export function parsePagination(input: PaginationInput = {}) {
  const rawPage = Number(input.page ?? 1);
  const rawSize = Number(input.pageSize ?? 25);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = (PROOFLINE_PAGE_SIZES as readonly number[]).includes(rawSize) ? (rawSize as ProoflinePageSize) : 25;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  return {
    page: safePage,
    pageSize,
    total,
    pages,
    hasPrevious: safePage > 1,
    hasNext: safePage < pages,
  };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, pagination: paginationMeta(total, page, pageSize) };
}

/** Consistent DB window: never return an empty out-of-range page with a valid page label. */
export function clampedPagination(total: number, input: PaginationInput = {}) {
  const { page, pageSize } = parsePagination(input);
  const meta = paginationMeta(Math.max(0, total), page, pageSize);
  return { page: meta.page, pageSize: meta.pageSize, skip: (meta.page - 1) * meta.pageSize, take: meta.pageSize };
}
