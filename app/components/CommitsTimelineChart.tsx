"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AnalyzedCommit } from "@/lib/types";

export type TimelineRange = "1D" | "7D" | "1M" | "3M" | "ALL";

const RANGE_ORDER: TimelineRange[] = ["1D", "7D", "1M", "3M", "ALL"];

function parseCommitDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dayKey: string): string {
  const [y, mo, da] = dayKey.split("-").map(Number);
  if (!y || !mo || !da) return dayKey;
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeWindow(
  range: TimelineRange,
  commits: AnalyzedCommit[],
): { start: Date; end: Date } | null {
  const dates = commits
    .map((c) => parseCommitDate(c.date))
    .filter((x): x is Date => x !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;

  const end = dates[dates.length - 1]!;
  if (range === "ALL") {
    return { start: startOfDayLocal(dates[0]!), end: endOfDayLocal(end) };
  }
  const days =
    range === "1D" ? 1
    : range === "7D" ? 7
    : range === "1M" ? 30
    : 90;
  const start = startOfDayLocal(addDays(end, -(days - 1)));
  return { start, end: endOfDayLocal(end) };
}

function eachDayKeyInRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cur = startOfDayLocal(new Date(start));
  const last = startOfDayLocal(new Date(end));
  while (cur.getTime() <= last.getTime()) {
    keys.push(dayKeyLocal(cur));
    cur = addDays(cur, 1);
  }
  return keys;
}

export type TimelinePoint = {
  dayKey: string;
  label: string;
  commits: number;
  avgImpact: number;
};

function buildSeries(
  commits: AnalyzedCommit[],
  range: TimelineRange,
): TimelinePoint[] {
  const win = rangeWindow(range, commits);
  if (!win) return [];

  const dayKeys = eachDayKeyInRange(win.start, win.end);
  const byDay = new Map<string, AnalyzedCommit[]>();
  for (const k of dayKeys) {
    byDay.set(k, []);
  }

  for (const c of commits) {
    const d = parseCommitDate(c.date);
    if (!d) continue;
    if (d < win.start || d > win.end) continue;
    const k = dayKeyLocal(d);
    if (!byDay.has(k)) continue;
    byDay.get(k)!.push(c);
  }

  return dayKeys.map((dayKey) => {
    const list = byDay.get(dayKey) ?? [];
    const withScore = list.filter((c) => c.analysis?.business_impact_score != null);
    const sum = withScore.reduce((s, c) => s + (c.analysis?.business_impact_score ?? 0), 0);
    const avgImpact =
      withScore.length > 0 ? Math.round((sum / withScore.length) * 10) / 10 : 0;
    return {
      dayKey,
      label: formatDayLabel(dayKey),
      commits: list.length,
      avgImpact,
    };
  });
}

const TOOLTIP_STYLE = {
  fill: "rgba(168, 85, 247, 0.08)",
  stroke: "rgba(147, 51, 234, 0.35)",
  strokeWidth: 1,
} as const;

const axisTick = { fill: "#8b949e", fontSize: 11 };
const axisLine = { stroke: "#30363d" };

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
};

function TimelineTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-black/50">
      <p className="text-xs text-gray-300 font-medium mb-1">Date: {p.label}</p>
      <p className="text-sm text-emerald-300">Commits: {p.commits}</p>
      <p className="text-sm text-purple-300">Impact: {p.avgImpact}</p>
    </div>
  );
}

interface CommitsTimelineChartProps {
  commits: AnalyzedCommit[];
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string | null) => void;
}

export default function CommitsTimelineChart({
  commits,
  selectedDayKey,
  onSelectDay,
}: CommitsTimelineChartProps) {
  const [range, setRange] = useState<TimelineRange>("1M");

  const data = useMemo(() => buildSeries(commits, range), [commits, range]);

  const hasData = commits.length > 0;

  if (!hasData) return null;

  return (
    <div className="glass-surface p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-medium text-gray-400">Activity &amp; impact</h3>
        <div className="flex flex-wrap gap-1">
          {RANGE_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r);
                onSelectDay(null);
              }}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                range === r ?
                  "bg-purple-500/25 text-purple-200 border border-purple-500/40"
                : "text-zinc-500 border border-transparent hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              {r === "ALL" ? "ALL" : r}
            </button>
          ))}
        </div>
      </div>

      {selectedDayKey ? (
        <p className="text-[11px] text-zinc-500">
          Table filtered to{" "}
          <span className="text-purple-300">{formatDayLabel(selectedDayKey)}</span>
          .{" "}
          <button
            type="button"
            className="text-purple-400 hover:text-blue-300 underline cursor-pointer"
            onClick={() => onSelectDay(null)}
          >
            Clear day filter
          </button>
        </p>
      ) : null}

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            width={40}
            domain={[0, 100]}
          />
          <Tooltip content={<TimelineTooltip />} cursor={TOOLTIP_STYLE} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => <span className="text-zinc-400">{value}</span>}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="commits"
            name="Commits"
            stroke="#34d399"
            strokeWidth={2}
            dot={(dotProps) => {
              const { cx, cy, payload } = dotProps as {
                cx?: number;
                cy?: number;
                payload?: TimelinePoint;
              };
              if (cx == null || cy == null || !payload) return null;
              const active = selectedDayKey === payload.dayKey;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 7 : 5}
                  fill="#34d399"
                  stroke={active ? "#fff" : "rgba(52,211,153,0.5)"}
                  strokeWidth={active ? 2 : 1}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDay(selectedDayKey === payload.dayKey ? null : payload.dayKey);
                  }}
                />
              );
            }}
            activeDot={{ r: 7 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgImpact"
            name="Avg impact"
            stroke="#a855f7"
            strokeWidth={2}
            dot={(dotProps) => {
              const { cx, cy, payload } = dotProps as {
                cx?: number;
                cy?: number;
                payload?: TimelinePoint;
              };
              if (cx == null || cy == null || !payload) return null;
              const active = selectedDayKey === payload.dayKey;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 6 : 4}
                  fill={active ? "#c084fc" : "#a855f7"}
                  stroke={active ? "#fff" : "none"}
                  strokeWidth={active ? 1 : 0}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDay(selectedDayKey === payload.dayKey ? null : payload.dayKey);
                  }}
                />
              );
            }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-zinc-600">
        Click a point on either line to filter the table to that day. Range tabs clear the day filter.
      </p>
    </div>
  );
}
