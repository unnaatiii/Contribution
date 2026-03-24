"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function DashboardAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { bootstrapped, result } = useAnalysisSession();

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

  return <DashboardShell>{children}</DashboardShell>;
}
