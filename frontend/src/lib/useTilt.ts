"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export function useTilt(maxDeg: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 50, py: 50 });
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reducedMotion || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      const ry = ((px - 50) / 50) * maxDeg;
      const rx = -((py - 50) / 50) * maxDeg;
      setTilt({ rx, ry, px, py });
      setHovering(true);
    },
    [maxDeg, reducedMotion]
  );

  const onMouseLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0, px: 50, py: 50 });
    setHovering(false);
  }, []);

  return { ref, tilt, hovering, reducedMotion, onMouseMove, onMouseLeave };
}
