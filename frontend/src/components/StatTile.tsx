"use client";

import { useTilt } from "@/lib/useTilt";

export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-brass"
      : tone === "negative"
        ? "text-brick"
        : "text-foreground";

  const { ref, tilt, hovering, onMouseMove, onMouseLeave } = useTilt(6);

  return (
    <div style={{ perspective: "700px" }}>
      <div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: "transform 150ms ease-out",
        }}
        className="relative overflow-hidden rounded-md border border-border bg-card p-4 shadow-sm"
      >
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: hovering ? 1 : 0,
            background: `radial-gradient(160px circle at ${tilt.px}% ${tilt.py}%, color-mix(in srgb, var(--blueprint) 10%, transparent), transparent 70%)`,
          }}
        />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
