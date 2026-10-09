"use client";

import { useEffect, useMemo, useState } from "react";

export const LIST_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const LIST_DEFAULT_PAGE_SIZE = 25;

/**
 * Client-side paging over an already filtered and sorted list.
 *
 * `resetKey` is whatever identifies the current result set (filters, sort, search) — when it changes
 * the page snaps back to 1, so narrowing a filter never strands the user on a page that no longer
 * exists. Independently, `page` is clamped to the real last page on every render, so deleting the
 * only row on the last page lands on the new last page instead of rendering an empty list.
 */
export function useListPagination<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(LIST_DEFAULT_PAGE_SIZE);

  useEffect(() => setPage(1), [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    pageItems,
    page: safePage,
    pageSize,
    totalPages,
    totalItems: items.length,
    setPage,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}

const BTN =
  "rounded-[5px] border border-[var(--border)] px-3 py-1 text-[12px] text-[var(--muted)] hover:border-[var(--brand-primary)] hover:text-[var(--accent-light)] disabled:pointer-events-none disabled:opacity-50";

export function ListPagination({
  testId,
  noun,
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  /** Prefix for `<testId>`, `<testId>-size`, `<testId>-prev`, `<testId>-next` hooks. */
  testId: string;
  /** Plural noun for the range label, e.g. "runs". */
  noun: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  // An empty result set has no pagination to offer; the caller's empty state covers it.
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div
      data-testid={testId}
      className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[12px]"
    >
      <span className="text-[var(--muted)]" data-testid={`${testId}-range`}>
        Showing <span className="font-medium text-[var(--foreground)]">{start}–{end}</span> of{" "}
        <span className="font-medium text-[var(--foreground)]">{totalItems}</span> {noun}
        {totalPages > 1 && (
          <>
            {" · "}page <span className="font-medium text-[var(--foreground)]">{page}</span> of{" "}
            <span className="font-medium text-[var(--foreground)]">{totalPages}</span>
          </>
        )}
      </span>
      <div className="flex items-center gap-2">
        <select
          data-testid={`${testId}-size`}
          aria-label="Items per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] text-[var(--ink-600)] outline-none"
        >
          {LIST_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button
          type="button"
          data-testid={`${testId}-prev`}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={BTN}
        >
          Previous
        </button>
        <button
          type="button"
          data-testid={`${testId}-next`}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={BTN}
        >
          Next
        </button>
      </div>
    </div>
  );
}
