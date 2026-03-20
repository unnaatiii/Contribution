"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { DeveloperProfile, AnalysisResult } from "@/lib/types";

interface ContributionChartsProps {
  result: AnalysisResult;
  selectedDeveloper: string | null;
}

const COLORS = [
  "#818cf8",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
  "#e879f9",
];

const typeColors: Record<string, string> = {
  feature: "#818cf8",
  bugfix: "#f87171",
  refactor: "#34d399",
  documentation: "#f59e0b",
  test: "#a78bfa",
  chore: "#64748b",
  performance: "#2dd4bf",
  security: "#fb923c",
};

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
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
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
  selectedDeveloper,
}: ContributionChartsProps) {
  const devs = result.developers;

  const impactBarData = devs
    .slice(0, 10)
    .map((d) => ({
      name: d.login,
      score: Math.round(d.totalImpactScore),
      commits: d.totalCommits,
      prs: d.totalPRs,
    }));

  const allBreakdown: Record<string, number> = {};
  for (const dev of devs) {
    for (const [type, count] of Object.entries(dev.contributionBreakdown)) {
      allBreakdown[type] = (allBreakdown[type] ?? 0) + count;
    }
  }
  const pieData = Object.entries(allBreakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const selected = selectedDeveloper
    ? devs.find((d) => d.login === selectedDeveloper)
    : devs[0];

  const radarData = selected
    ? [
        { metric: "Business Value", value: selected.impactBreakdown.businessValue },
        { metric: "Complexity", value: selected.impactBreakdown.complexity },
        { metric: "Code Quality", value: selected.impactBreakdown.codeQuality },
        { metric: "Frequency", value: selected.impactBreakdown.frequency },
        { metric: "PR Merge %", value: Math.round(selected.prAcceptanceRate / 10) },
      ]
    : [];

  const weeklyData = selected?.weeklyScores ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Impact Score Comparison */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">Impact Score by Developer</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={impactBarData} barCategoryGap="20%">
              <XAxis
                dataKey="name"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Impact Score" radius={[6, 6, 0, 0]}>
                {impactBarData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Contribution Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">Contribution Types</h3>
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
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={typeColors[entry.name] ?? "#64748b"}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: typeColors[entry.name] ?? "#64748b" }}
                />
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>

        {/* Radar - Developer Profile */}
        {selected && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">
              Developer Profile: <span className="text-indigo-400">{selected.login}</span>
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 10]}
                  tick={{ fill: "#3f3f46", fontSize: 10 }}
                />
                <Radar
                  name={selected.login}
                  dataKey="value"
                  stroke="#818cf8"
                  fill="#818cf8"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weekly Trend */}
        {weeklyData.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">
              Weekly Activity: <span className="text-indigo-400">{selected?.login}</span>
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyData}>
                <XAxis
                  dataKey="week"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ fill: "#818cf8", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="commits"
                  name="Commits"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ fill: "#34d399", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
