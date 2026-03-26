"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Star = {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
};

export default function StarBurst() {
  const [stars, setStars] = useState<Star[]>([]);
  const nextId = useRef(0);

  const createBurst = useCallback((clientX: number, clientY: number) => {
    const batch: Star[] = [];
    for (let i = 0; i < 20; i++) {
      nextId.current += 1;
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 120 + 40;
      batch.push({
        id: nextId.current,
        x: clientX,
        y: clientY,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
      });
    }

    setStars((prev) => {
      let next = [...prev, ...batch];
      if (next.length > 200) {
        next = next.slice(-100);
      }
      return next;
    });

    const ids = new Set(batch.map((s) => s.id));
    window.setTimeout(() => {
      setStars((prev) => prev.filter((s) => !ids.has(s.id)));
    }, 800);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      createBurst(e.clientX, e.clientY);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [createBurst]);

  return (
    <>
      {stars.map((star) => (
        <span
          key={star.id}
          className="cosmic-star-burst-particle"
          style={
            {
              left: star.x,
              top: star.y,
              "--tx": `${star.tx}px`,
              "--ty": `${star.ty}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}
