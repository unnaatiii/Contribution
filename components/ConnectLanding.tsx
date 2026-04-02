"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, X } from "lucide-react";
import ConnectForm from "@/app/components/ConnectForm";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";
import { connectWithGitHubToken } from "@/lib/connect-with-github-token";

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
  const [oauthError, setOauthError] = useState("");
  const [oauthConnecting, setOauthConnecting] = useState(false);

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
    if (!bootstrapped) return;

    const params = new URLSearchParams(window.location.search);
    const errParam = params.get("github_oauth_error");
    if (errParam) {
      setOauthError(decodeURIComponent(errParam.replace(/\+/g, " ")));
      router.replace("/", { scroll: false });
      return;
    }

    const isOauthSuccess = params.get("github_oauth") === "1";
    if (isOauthSuccess) {
      window.history.replaceState(null, "", window.location.pathname || "/");
    } else {
      return;
    }

    let cancelled = false;
    (async () => {
      setOauthConnecting(true);
      try {
        const r = await fetch("/api/auth/github/session");
        const j = (await r.json()) as { access_token: string | null };
        if (cancelled) return;
        if (!j.access_token) {
          setOauthError("GitHub did not return a token. Check OAuth app callback URL and env vars, then try again.");
          setOauthConnecting(false);
          return;
        }
        const resultConnect = await connectWithGitHubToken(j.access_token);
        if (cancelled) return;
        if (!resultConnect.ok) {
          setOauthError(resultConnect.error);
          setOauthConnecting(false);
          return;
        }
        await loadBaseData(resultConnect.config);
      } catch {
        if (!cancelled) {
          setOauthError("Something went wrong after GitHub login.");
          setOauthConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, loadBaseData, router]);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a0a2e]">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          <div className="absolute inset-0 blur-xl bg-purple-500/20 rounded-full scale-150 -z-10" />
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a0a2e]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (phase === "loading_data") {
    return (
      <div className="analyzing-phase-root min-h-screen flex items-center justify-center p-6 bg-[#1a0a2e]">
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#1a0a2e]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
        <p className="text-sm text-zinc-400 text-center">Opening analysis…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#1a0a2e]">
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

  if (oauthConnecting) {
    return (
      <div className="analyzing-phase-root min-h-screen flex items-center justify-center p-6 bg-[#1a0a2e]">
        <div className="glass-surface max-w-md w-full p-8 text-center animate-fade-rise">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-2">Finishing GitHub sign-in</h2>
          <p className="text-sm text-gray-400 leading-relaxed">Listing your repositories and preparing the dashboard…</p>
          <div className="mt-6 h-1.5 rounded-full bg-white/5 overflow-hidden shimmer-bar mx-auto max-w-xs" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen flex flex-col overflow-x-hidden overflow-y-auto">
      <div className="fixed inset-0 z-0 landing-purple-canvas" aria-hidden />

      <div className="relative z-20 flex flex-col flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-16 justify-center">
        <h1 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-10 md:mb-12">
          DevImpact Leaderboard
        </h1>

        {oauthError ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-500/35 bg-red-950/50 px-4 py-3 text-sm text-red-100 max-w-lg mx-auto w-full">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <p className="min-w-0 flex-1 leading-relaxed">{oauthError}</p>
            <button
              type="button"
              onClick={() => setOauthError("")}
              className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-red-200 cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <ConnectForm onConnected={loadBaseData} variant="landing" />
      </div>
    </div>
  );
}
