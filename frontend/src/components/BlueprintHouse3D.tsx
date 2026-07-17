"use client";

import { useEffect, useRef, useState } from "react";
import { useTilt } from "@/lib/useTilt";

const W = 300; // box width
const H = 230; // box height
const D = 90; // box depth

export function BlueprintHouse3D() {
  const { ref, tilt, reducedMotion, onMouseMove, onMouseLeave } = useTilt(16);
  const [autoRotY, setAutoRotY] = useState(0);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reducedMotion) return;
    function tick(now: number) {
      if (lastRef.current === undefined) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      if (!hovering) {
        setAutoRotY((prev) => prev + dt * 0.012);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = undefined;
    };
  }, [hovering, reducedMotion]);

  const baseRx = -14;
  const baseRy = -26;
  const rx = baseRx + tilt.rx;
  const ry = baseRy + tilt.ry + autoRotY;

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        setHovering(true);
        onMouseMove(e);
      }}
      onMouseLeave={() => {
        setHovering(false);
        onMouseLeave();
      }}
      style={{ perspective: "1400px" }}
      className="mx-auto w-full max-w-md select-none"
      aria-hidden="true"
    >
      <div
        style={{
          width: W,
          height: H,
          margin: "0 auto",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          transition: hovering ? "transform 80ms linear" : "transform 400ms ease-out",
        }}
      >
        {/* floor */}
        <div
          className="bp-grid-ink"
          style={{
            position: "absolute",
            width: W,
            height: D,
            left: 0,
            top: H / 2 - D / 2,
            transform: `rotateX(90deg) translateZ(${H / 2}px)`,
            border: "1px solid color-mix(in srgb, var(--brass) 40%, transparent)",
            opacity: 0.9,
          }}
        />

        {/* back (ghost) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(-${D / 2}px)`,
            opacity: 0.22,
          }}
        >
          <HouseFace />
        </div>

        {/* left side panel */}
        <div
          className="bp-grid-ink"
          style={{
            position: "absolute",
            width: D,
            height: H,
            left: W / 2 - D / 2,
            top: 0,
            transform: `rotateY(-90deg) translateZ(${W / 2}px)`,
            border: "1px solid color-mix(in srgb, white 20%, transparent)",
          }}
        >
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.1em] text-paper/50">
            LATERAL
          </span>
        </div>

        {/* right side panel */}
        <div
          className="bp-grid-ink"
          style={{
            position: "absolute",
            width: D,
            height: H,
            left: W / 2 - D / 2,
            top: 0,
            transform: `rotateY(90deg) translateZ(${W / 2}px)`,
            border: "1px solid color-mix(in srgb, white 20%, transparent)",
          }}
        >
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.1em] text-paper/50">
            LATERAL
          </span>
        </div>

        {/* front (main elevation) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${D / 2}px)`,
          }}
        >
          <HouseFace withDetail />
        </div>
      </div>
    </div>
  );
}

function HouseFace({ withDetail = false }: { withDetail?: boolean }) {
  return (
    <svg viewBox="0 0 320 220" fill="none" className="h-full w-full text-paper/85" aria-hidden="true">
      <path
        d="M40 90 160 20 280 90"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M56 90V180H264V90"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M140 180V132H180V180"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="80" y="115" width="32" height="32" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path d="M96 115V147M80 131H112" stroke="currentColor" strokeWidth="1" />
      <rect x="208" y="115" width="32" height="32" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path d="M224 115V147M208 131H240" stroke="currentColor" strokeWidth="1" />

      {withDetail && (
        <>
          <path d="M56 198H264" stroke="var(--brass)" strokeWidth="1" />
          <path d="M56 193V203M264 193V203M160 193V203" stroke="var(--brass)" strokeWidth="1" />
          <text
            x="160"
            y="216"
            textAnchor="middle"
            fontSize="9"
            fill="var(--brass)"
            fontFamily="var(--font-data)"
            letterSpacing="0.05em"
          >
            6.40 M
          </text>
          <circle cx="160" cy="20" r="2" fill="var(--brass)" />
          <path d="M160 20V8" stroke="var(--brass)" strokeWidth="1" />
          <rect x="118" y="0" width="84" height="16" rx="2" fill="var(--brass)" />
          <text
            x="160"
            y="11"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="600"
            fill="var(--ink)"
            fontFamily="var(--font-data)"
            letterSpacing="0.04em"
          >
            NETO +$2,140
          </text>
        </>
      )}
    </svg>
  );
}
