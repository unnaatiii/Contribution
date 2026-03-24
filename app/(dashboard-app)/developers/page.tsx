"use client";

import ContributorCard from "@/app/components/ContributorCard";
import { useAnalysisSession } from "@/components/AnalysisSessionProvider";

export default function DevelopersPage() {
  const { result, selectedDev, hoveredProfile, setHoveredProfile } = useAnalysisSession();
  if (!result) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Contributor Profiles</h2>
      <p className="text-sm text-gray-400 mb-6">
        Hover a card to focus it; others blur. Click to open full timeline and AI analysis.
      </p>
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
        onMouseLeave={() => setHoveredProfile(null)}
      >
        {result.developers.map((dev) => (
          <ContributorCard
            key={dev.login}
            developer={dev}
            isSelected={selectedDev === dev.login}
            hoveredLogin={hoveredProfile}
            onHoverLogin={setHoveredProfile}
          />
        ))}
      </div>
    </div>
  );
}
