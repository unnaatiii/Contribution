"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Loader2, AlertCircle } from "lucide-react";
import ConnectForm from "@/app/components/ConnectForm";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function ConnectLanding() {
  const router = useRouter();
  const {
    bootstrapped,
    phase,
    result,
    error,
    progress,
    loadBaseData,
    clearSessionAndGoConnect,
    retryLastOperation,
    config,
  } = useAnalysisSession();
  const auroraContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bootstrapped) return;
    if (result && phase === "done") {
      router.replace("/repo");
    }
  }, [bootstrapped, result, phase, router]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (result && phase === "analyzing_ai") {
      router.replace("/analysis");
    }
  }, [bootstrapped, result, phase, router]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const root = auroraContainerRef.current;
      if (!root) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      root.querySelectorAll(".aurora-parallax-wrap").forEach((wrap, i) => {
        const depth = (i + 1) * 10;
        (wrap as HTMLElement).style.transform = `translate(${x / depth}px, ${y / depth}px)`;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          <div className="absolute inset-0 blur-xl bg-purple-500/20 rounded-full scale-150 -z-10" />
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (phase === "loading_data") {
    return (
      <div className="analyzing-phase-root min-h-screen flex items-center justify-center p-6">
        <div className="glass-surface max-w-md w-full p-8 text-center animate-fade-rise">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-2">Loading from GitHub</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{progress}</p>
          <div className="mt-6 h-1.5 rounded-full bg-white/5 overflow-hidden shimmer-bar mx-auto max-w-xs" />
        </div>
      </div>
    );
  }

  if (phase === "analyzing_ai" && result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
        <p className="text-sm text-zinc-400 text-center">Opening analysis…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-surface max-w-md w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-sm text-red-400/80 mb-6">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={clearSessionAndGoConnect}
              className="px-5 py-2.5 rounded-[20px] bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all duration-300 cursor-pointer"
            >
              Back to Setup
            </button>
            {config && (
              <button
                type="button"
                onClick={() => void retryLastOperation()}
                className="px-5 py-2.5 rounded-[20px] btn-gradient-saas font-medium text-sm cursor-pointer shadow-lg shadow-purple-500/20"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen flex flex-col overflow-x-hidden">
      <div className="landing-connect-bg fixed inset-0 z-0" aria-hidden />
      <div ref={auroraContainerRef} className="aurora-container" aria-hidden>
        <div className="aurora-parallax-wrap">
          <div className="aurora aurora-1" />
        </div>
        <div className="aurora-parallax-wrap">
          <div className="aurora aurora-2" />
        </div>
        <div className="aurora-parallax-wrap">
          <div className="aurora aurora-3" />
        </div>
      </div>

      <header className="relative z-10 border-b border-white/10 px-6 py-4 bg-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-950/50 to-blue-600/25 ring-1 ring-white/10">
            <Activity className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">DevImpact AI</h1>
            <p className="text-xs text-gray-400">Multi-Repo Developer Impact Analysis</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-6 py-12 md:py-16">
        <div className="w-full max-w-2xl shrink-0">
          <motion.div
            className="text-center mb-10 md:mb-12"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Measure Real Impact
            </h1>
            <p className="text-gray-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Enter your GitHub PAT once — your dashboard opens with every repo, commits, and developers.
              Run AI scoring when you want from the Analysis page.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <ConnectForm onConnected={loadBaseData} />
          </motion.div>

          <div className="mt-10 md:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto">
            {[
              { label: "Multi-Repo", desc: "Cross-project" },
              { label: "Deep AI", desc: "Diff analysis" },
              { label: "Impact ROI", desc: "Business value" },
              { label: "Team Intel", desc: "Dev vs Manager" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: 0.2 + i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-center rounded-xl px-6 py-3 bg-white/5 backdrop-blur-lg border border-white/10 shadow-lg shadow-black/20 transition-all duration-300 hover:bg-white/10 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-xl hover:shadow-blue-500/15"
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
