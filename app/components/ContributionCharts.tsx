"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { contributorDisplayLabel } from "@/lib/commit-author";

interface ContributionChartsProps {
  result: AnalysisResult;
  selectedDeveloper: string | null;
}

const COLORS = [
  "#a855f7",
  "#6366f1",
  "#3b82f6",
  "#8b5cf6",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#c084fc",
];

const typeColors: Record<string, string> = {
  feature: "#a855f7",
  bug_fix: "#f87171",
  refactor: "#34d399",
  test: "#a78bfa",
  chore: "#64748b",
};

const repoTypeColors: Record<string, string> = {
  frontend: "#6366f1",
  backend: "#fbbf24",
  erp: "#c084fc",
};

/** Recharts default tooltip band uses fill #ccc — override for dark UI */
const CHART_TOOLTIP_CURSOR = {
  fill: "rgba(168, 85, 247, 0.1)",
  stroke: "rgba(147, 51, 234, 0.35)",
  strokeWidth: 1,
} as const;

const axisTick = { fill: "#8b949e", fontSize: 11 };
const axisLine = { stroke: "#30363d" };

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/90 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-black/50">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((item, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: item.color }}>
          {item.name}: {typeof item.value === "number" ? item.value.toFixed(1) : item.value}
        </p>
      ))}
    </div>
  );
};

export default function ContributionCharts({
  result,
  selectedDeveloper: _selectedDeveloper,
}: ContributionChartsProps) {
  const router = useRouter();

  const goToCommitsByType = (typeName: string) => {
    const t = typeName.trim();
    if (!t) return;
    router.push(`/commits?type=${encodeURIComponent(t)}`);
  };

  const devs = result.developers.filter((d) => d.role === "developer");

  const impactBarData = devs.slice(0, 10).map((d) => ({
    name: contributorDisplayLabel(d.login),
    score: d.impactScore,
    avgImpact: d.avgBusinessImpact,
  }));

  const allBreakdown: Record<string, number> = {};
  for (const dev of devs) {
    for (const [type, count] of Object.entries(dev.breakdown)) {
      allBreakdown[type] = (allBreakdown[type] ?? 0) + count;
    }
  }
  const pieData = Object.entries(allBreakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const repoData: Record<string, number> = {};
  for (const dev of result.developers) {
    for (const [repo, data] of Object.entries(dev.repoBreakdown)) {
      repoData[repo] = (repoData[repo] ?? 0) + data.commits;
    }
  }
  const repoBarData = Object.entries(repoData).map(([name, commits]) => {
    const repo = result.repos.find((r) => r.label === name);
    return { name, commits, type: repo?.repoType ?? "backend" };
  });

  return (
    <div className="space-y-6 animate-fade-rise">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-white/10">
          <BarChart3 className="w-5 h-5 text-purple-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-tight">Analytics</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-animate">
        <div className="glass-surface p-6 transition-all duration-300 hover:shadow-2xl hover:border-white/15 hover:shadow-purple-500/5 animate-fade-rise">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Impact Score by Developer</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={impactBarData}
              barCategoryGap="18%"
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <XAxis
                dataKey="name"
                interval={0}
                tick={{
                  ...axisTick,
                  fontSize: 10,
                  angle: -78,
                  textAnchor: "end",
                  dy: 4,
                }}
                height={92}
                axisLine={axisLine}
                tickLine={false}
              />
              <YAxis
                tick={axisTick}
                axisLine={axisLine}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
              <Bar dataKey="score" name="Impact Score" radius={[6, 6, 0, 0]} activeBar={false}>
                {impactBarData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.88} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-surface p-6 transition-all duration-300 hover:shadow-2xl hover:border-white/15 hover:shadow-blue-500/5 animate-fade-rise">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Contribution Types</h3>
          <p className="text-[10px] text-zinc-600 mb-4">Click a slice or legend to open Commits with that type.</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                style={{ cursor: "pointer" }}
                onClick={(data) => {
                  const name = (data as { name?: string })?.name;
                  if (name) goToCommitsByType(name);
                }}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={typeColors[entry.name] ?? "#64748b"}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {pieData.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => goToCommitsByType(entry.name)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg px-1.5 py-0.5 hover:bg-white/5"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: typeColors[entry.name] ?? "#64748b" }}
                />
                {entry.name} ({entry.value})
              </button>
            ))}
          </div>
        </div>

        <div className="glass-surface p-6 lg:col-span-2 transition-all duration-300 hover:shadow-2xl hover:border-white/15 hover:shadow-indigo-500/5 animate-fade-rise">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Commits by Repository</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={repoBarData}
              barCategoryGap="28%"
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <XAxis
                dataKey="name"
                interval={0}
                tick={{
                  ...axisTick,
                  fontSize: 10,
                  angle: -72,
                  textAnchor: "end",
                  dy: 4,
                }}
                height={88}
                axisLine={axisLine}
                tickLine={false}
              />
              <YAxis
                tick={axisTick}
                axisLine={axisLine}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
              <Bar dataKey="commits" name="Commits" radius={[6, 6, 0, 0]} activeBar={false}>
                {repoBarData.map((item) => (
                  <Cell
                    key={item.name}
                    fill={repoTypeColors[item.type] ?? "#a855f7"}
                    fillOpacity={0.88}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            {Object.entries(repoTypeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {type}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
