import { format } from "date-fns";

/** Local calendar day key: yyyy-MM-dd */
export function dayKey(value: string | Date): string {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) return dateOnly[1];
  }
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "yyyy-MM-dd");
}

/** Display like 29 Nov 2025 (from yyyy-MM-dd, local calendar) */
export function formatDayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return format(new Date(y, m - 1, d), "dd MMM yyyy");
}

export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => string
): { day: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(getDate(item));
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, groupItems]) => ({ day, items: groupItems }));
}
