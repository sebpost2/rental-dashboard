"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const prefersReducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (prefersReducedMotion.current) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function HeroBalance({
  netBalance,
  trend,
}: {
  netBalance: number;
  trend: { period: string; cumulative: number }[];
}) {
  const animated = useCountUp(netBalance);
  const tone = netBalance >= 0 ? "text-brass" : "text-brick";

  const values = trend.map((t) => t.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const points = trend.map((t, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * 100 : 50;
    const y = 40 - ((t.cumulative - min) / range) * 36 - 2;
    return `${x},${y}`;
  });
  const areaPath =
    points.length > 1
      ? `M0,40 L${points.join(" L")} L100,40 Z`
      : "";
  const linePath = points.length > 1 ? `M${points.join(" L")}` : "";

  return (
    <div className="rise-in rise-in-1 rounded-md border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">Balance neto</p>
      <p className={`mt-1 font-heading text-5xl font-semibold tabular-nums ${tone}`}>
        {formatMoney(animated)}
      </p>
      {points.length > 1 && (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-4 h-16 w-full">
          <path d={areaPath} fill="var(--blueprint)" opacity="0.1" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--blueprint)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
