/** NBA-style season label `YYYY-YY` (e.g. `2024-25`). */
export function inferBasketballSeasonLabel(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (m >= 9) {
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  }
  return `${y - 1}-${String(y % 100).padStart(2, "0")}`;
}

/** Parse `YYYY-YY` into a UTC window [Oct 1 startYear, Sep 30 endYear+1]. */
export function seasonLabelToUtcRange(label: string): { start: Date; end: Date } | null {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y)) return null;
  const start = new Date(Date.UTC(y, 9, 1));
  const end = new Date(Date.UTC(y + 1, 8, 30, 23, 59, 59, 999));
  return { start, end };
}

export function pct(made: number | null, att: number | null): number | null {
  if (made == null || att == null || att <= 0) return null;
  return (made / att) * 100;
}
