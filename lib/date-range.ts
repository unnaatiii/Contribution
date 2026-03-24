/** Calendar date YYYY-MM-DD */
export function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultAnalysisDateRange(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  return { dateFrom: toYMD(from), dateTo: toYMD(to) };
}

/** Start of UTC day for GitHub `since` */
export function startOfDayUtcIso(ymd: string): string {
  return `${ymd}T00:00:00.000Z`;
}

/** End of UTC day for GitHub `until` */
export function endOfDayUtcIso(ymd: string): string {
  return `${ymd}T23:59:59.999Z`;
}

const MAX_RANGE_DAYS = 366;

export function validateAnalysisDateRange(
  dateFrom: string,
  dateTo: string,
): { ok: true } | { ok: false; error: string } {
  const from = new Date(startOfDayUtcIso(dateFrom));
  const to = new Date(endOfDayUtcIso(dateTo));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD." };
  }
  if (from > to) {
    return { ok: false, error: "Start date must be on or before end date." };
  }
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, error: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` };
  }
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  if (from > todayEnd) {
    return { ok: false, error: "Start date cannot be in the future." };
  }
  const todayYmd = toYMD(new Date());
  if (dateTo > todayYmd) {
    return { ok: false, error: "End date cannot be after today." };
  }
  return { ok: true };
}
