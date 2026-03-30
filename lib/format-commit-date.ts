/** Consistent date+time for commits (UI + tables). */
export function formatCommitDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 19);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Narrow “When” column: date line + time line. */
export function formatCommitDateParts(iso: string | undefined | null): { dateLine: string; timeLine: string } {
  if (!iso) return { dateLine: "—", timeLine: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dateLine: String(iso).slice(0, 10), timeLine: "" };
  return {
    dateLine: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    timeLine: d.toLocaleTimeString(undefined, { timeStyle: "short" }),
  };
}

/** Compact relative time for commit metadata row. */
export function formatCommitRelativeShort(iso: string | undefined | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  let diff = Date.now() - t;
  if (diff < 0) diff = 0;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 8) return `${wk}w ago`;
  return formatCommitDateTime(iso);
}
