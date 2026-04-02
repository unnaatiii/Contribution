/**
 * Dual-origin confetti: bottom-left and bottom-right corners, shooting upward toward center.
 * Used when opening #1 on the Impact Leaderboard.
 */
export function fireLeaderboardMeetConfetti(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  void import("canvas-confetti").then(({ default: confetti }) => {
    const colors = ["#a855f7", "#818cf8", "#c084fc", "#e9d5ff", "#22d3ee", "#f0abfc"];
    const base = {
      particleCount: 52,
      spread: 38,
      startVelocity: 52,
      gravity: 0.92,
      ticks: 320,
      colors,
      scalar: 1.05,
      zIndex: 9999,
    } as const;

    void confetti({ ...base, angle: 68, origin: { x: 0.02, y: 0.99 } });
    void confetti({ ...base, angle: 112, origin: { x: 0.98, y: 0.99 } });

    window.setTimeout(() => {
      void confetti({
        ...base,
        particleCount: 36,
        spread: 32,
        startVelocity: 44,
        angle: 74,
        origin: { x: 0.06, y: 1 },
      });
      void confetti({
        ...base,
        particleCount: 36,
        spread: 32,
        startVelocity: 44,
        angle: 106,
        origin: { x: 0.94, y: 1 },
      });
    }, 140);
  });
}
