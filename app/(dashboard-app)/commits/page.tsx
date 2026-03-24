"use client";

import CommitAnalysisTable from "@/app/components/CommitAnalysisTable";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function CommitsPage() {
  const { result } = useAnalysisSession();
  if (!result) return null;

  return (
    <div className="space-y-6">
      <CommitAnalysisTable
        analyzedCommits={result.analyzedCommits}
        modelsUsed={result.modelsUsed}
        aiPowered={result.aiPowered}
        aiDiagnostics={result.aiDiagnostics}
      />
    </div>
  );
}
