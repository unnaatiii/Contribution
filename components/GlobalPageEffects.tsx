"use client";

import { useEffect, useRef } from "react";
import StarBurst from "@/components/StarBurst";

/**
 * App-wide: aurora ribbon parallax + click star burst (styled in globals.css).
 */
export default function GlobalPageEffects() {
  const auroraWavesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const wavesRoot = auroraWavesRef.current;
      if (!wavesRoot) return;
      const wx = (e.clientX / window.innerWidth - 0.5) * 30;
      const wy = (e.clientY / window.innerHeight - 0.5) * 20;
      wavesRoot.querySelectorAll(".aurora-wave-parallax-wrap").forEach((wrap, i) => {
        const depth = (i + 1) * 8;
        (wrap as HTMLElement).style.transform = `translate(${wx / depth}px, ${wy / depth}px)`;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      <div ref={auroraWavesRef} className="aurora-waves" aria-hidden>
        <div className="aurora-wave-parallax-wrap">
          <div className="wave wave-1" />
        </div>
        <div className="aurora-wave-parallax-wrap">
          <div className="wave wave-2" />
        </div>
        <div className="aurora-wave-parallax-wrap">
          <div className="wave wave-3" />
        </div>
      </div>
      <StarBurst />
    </>
  );
}
