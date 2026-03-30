"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function DashboardAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { bootstrapped, result, phase, progress } = useAnalysisSession();

  useEffect(() => {
    if (!bootstrapped) return;
    if (!result) router.replace("/");
  }, [bootstrapped, result, router]);

  if (!bootstrapped || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  /** Base GitHub refresh still blocks the shell so data stays consistent. AI analysis runs in-page on /analysis only. */
  if (phase === "loading_data") {
    return (
      <div className="analyzing-phase-root min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="glass-surface max-w-md w-full p-8 text-center animate-[fade-rise_1.5s_ease-out]">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-2">Refreshing from GitHub</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{progress}</p>
          <div className="mt-6 h-1.5 rounded-full bg-white/5 overflow-hidden shimmer-bar mx-auto max-w-xs" />
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
