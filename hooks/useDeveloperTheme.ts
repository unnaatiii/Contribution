"use client";

import { useMemo } from "react";

export type DeveloperTheme = {
  /** Primary accent (hex or hsl) */
  primary: string;
  /** Secondary / gradient end */
  secondary: string;
  /** Soft glow (rgba) */
  glow: string;
  /** Full CSS linear-gradient for hero backgrounds */
  gradientCss: string;
  /** Tailwind arbitrary gradient classes for buttons (from-… to-…) */
  tailwindGradient: string;
};

type ThemeBase = Pick<DeveloperTheme, "primary" | "secondary" | "glow" | "gradientCss">;

/** Curated themes for known logins (extend as needed) */
const developerThemes: Record<string, ThemeBase> = {
  username1: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    glow: "rgba(99, 102, 241, 0.38)",
    gradientCss:
      "linear-gradient(135deg, rgba(99,102,241,0.24) 0%, transparent 42%, rgba(139,92,246,0.16) 100%)",
  },
  username2: {
    primary: "#22c55e",
    secondary: "#10b981",
    glow: "rgba(34, 197, 94, 0.35)",
    gradientCss:
      "linear-gradient(135deg, rgba(34,197,94,0.22) 0%, transparent 42%, rgba(16,185,129,0.14) 100%)",
  },
};

function hashLogin(login: string): number {
  const s = login.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic theme from username when not in the map */
export function themeFromHash(login: string): ThemeBase {
  const h = hashLogin(login);
  const hue1 = h % 360;
  const hue2 = (hue1 + 38 + (h % 80)) % 360;
  const primary = `hsl(${hue1} 72% 58%)`;
  const secondary = `hsl(${hue2} 65% 48%)`;
  const glow = `hsla(${hue1}, 78%, 58%, 0.32)`;
  const gradientCss = `linear-gradient(135deg, hsla(${hue1}, 72%, 58%, 0.22) 0%, transparent 45%, hsla(${hue2}, 65%, 48%, 0.16) 100%)`;
  return { primary, secondary, glow, gradientCss };
}

function tailwindPair(primary: string): string {
  if (primary.startsWith("#")) {
    if (primary === "#6366f1") return "from-indigo-500 to-blue-600";
    if (primary === "#22c55e") return "from-green-500 to-emerald-500";
    return "from-blue-600 to-cyan-600";
  }
  return "from-blue-600 to-sky-500";
}

export function getThemeForLogin(login: string): DeveloperTheme {
  const key = login.toLowerCase();
  const base = developerThemes[key] ?? themeFromHash(login);
  return {
    ...base,
    tailwindGradient: tailwindPair(base.primary),
  };
}

export function useDeveloperTheme(login: string): DeveloperTheme {
  return useMemo(() => getThemeForLogin(login), [login]);
}
