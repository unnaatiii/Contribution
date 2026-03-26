"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import CommitAnalysisTable from "@/app/components/CommitAnalysisTable";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

function CommitsPageInner() {
  const { dataResult, result, wideSnapshot, loadBaseData, displayMode } = useAnalysisSession();
  const searchParams = useSearchParams();
  const shaParam = searchParams.get("sha") ?? searchParams.get("highlight") ?? undefined;
  const triedRefresh = useRef(false);
  const lastShaParam = useRef<string | undefined>(undefined);

  const view = dataResult ?? result;

  useEffect(() => {
    if (shaParam !== lastShaParam.current) {
      lastShaParam.current = shaParam;
      triedRefresh.current = false;
    }
  }, [shaParam]);

  useEffect(() => {
    const q = shaParam?.trim();
    if (!q || !wideSnapshot?.config || !view) return;
    if (displayMode === "restored") return;
    const found = view.analyzedCommits.some(
      (c) => c.sha === q || c.sha.toLowerCase().startsWith(q.toLowerCase()),
    );
    if (!found && !triedRefresh.current) {
      triedRefresh.current = true;
      void loadBaseData(wideSnapshot.config, { refresh: true });
    }
  }, [shaParam, view, wideSnapshot, loadBaseData, displayMode]);

  if (!view) return null;

  const sourceHint =
    wideSnapshot?.commitsDataSource === "database" ?
      "Commit list for this view was hydrated from your synced database (GitHub refresh runs on each load)."
    : null;

  return (
    <div className="space-y-6">
      {displayMode === "restored" ? (
        <p className="text-xs text-amber-200/85 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
          Showing commits from the <strong className="text-amber-100">saved analysis</strong> only (all
          non-merge rows in that snapshot, same as when the run completed). AI cache is unchanged; return to
          live view for the full org timeline.
        </p>
      ) : null}
      {sourceHint ? (
        <p className="text-xs text-zinc-500 leading-relaxed">{sourceHint}</p>
      ) : null}
      <CommitAnalysisTable
        analyzedCommits={view.analyzedCommits}
        modelsUsed={view.modelsUsed}
        aiPowered={view.aiPowered}
        aiDiagnostics={view.aiDiagnostics}
        highlightSha={shaParam}
      />
    </div>
  );
}

export default function CommitsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-zinc-500">Loading commits…</div>
      }
    >
      <CommitsPageInner />
    </Suspense>
  );
}
