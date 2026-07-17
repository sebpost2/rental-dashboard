"use client";

import { useEffect, useRef, useState } from "react";

const W = 300; // box width
const H = 230; // box height
const D = 90; // box depth

const BASE_RX = -18;
const BASE_RY = -28;
const MIN_RX = -70;
const MAX_RX = 40;

export function BlueprintHouse3D() {
  const [rot, setRot] = useState({ rx: BASE_RX, ry: BASE_RY });
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, rx: BASE_RX, ry: BASE_RY });
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || dragging) return;
    function tick(now: number) {
      if (lastRef.current === undefined) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      setRot((prev) => ({ ...prev, ry: prev.ry + dt * 0.01 }));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = undefined;
    };
  }, [dragging, reducedMotion]);

  function onPointerDown(e: React.PointerEvent) {
    if (reducedMotion) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, rx: rot.rx, ry: rot.ry };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRot({
      ry: dragStart.current.ry + dx * 0.35,
      rx: Math.min(MAX_RX, Math.max(MIN_RX, dragStart.current.rx - dy * 0.35)),
    });
  }

  function onPointerUp() {
    setDragging(false);
  }

  return (
    <div
      style={{ perspective: "1400px" }}
      className="mx-auto w-full max-w-md select-none"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: W,
          height: H,
          margin: "0 auto",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`,
          transition: dragging ? "none" : "transform 300ms ease-out",
          cursor: reducedMotion ? "default" : dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        aria-hidden="true"
      >
        {/* roof plan (top) */}
        <div
          className="bp-grid-ink"
          style={{
            position: "absolute",
            width: W,
            height: D,
            left: 0,
            top: H / 2 - D / 2,
            transform: `rotateX(90deg) translateZ(${-H / 2}px)`,
            border: "1px solid color-mix(in srgb, var(--brass) 45%, transparent)",
          }}
        >
          <svg viewBox="0 0 300 90" className="h-full w-full" aria-hidden="true">
            <line x1="0" y1="45" x2="300" y2="45" stroke="var(--brass)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <path d="M150 16 145 28 155 28 Z" fill="var(--brass)" />
            <text
              x="150"
              y="42"
              textAnchor="middle"
              fontSize="8"
              fill="var(--brass)"
              fontFamily="var(--font-data)"
              letterSpacing="0.1em"
            >
              N
            </text>
            <text
              x="150"
              y="72"
              textAnchor="middle"
              fontSize="7.5"
              fill="var(--paper)"
              fillOpacity="0.4"
              fontFamily="var(--font-data)"
              letterSpacing="0.08em"
            >
              CUBIERTA
            </text>
          </svg>
        </div>

        {/* floor / site plan (bottom) */}
        <div
          className="bp-grid-ink"
          style={{
            position: "absolute",
            width: W,
            height: D,
            left: 0,
            top: H / 2 - D / 2,
            transform: `rotateX(90deg) translateZ(${H / 2}px)`,
            border: "1px solid color-mix(in srgb, var(--brass) 45%, transparent)",
          }}
        >
          <svg viewBox="0 0 300 90" className="h-full w-full" aria-hidden="true">
            <rect x="30" y="15" width="240" height="60" fill="none" stroke="var(--brass)" strokeWidth="1" strokeOpacity="0.65" />
            <circle cx="30" cy="15" r="2" fill="var(--brass)" />
            <circle cx="270" cy="15" r="2" fill="var(--brass)" />
            <circle cx="30" cy="75" r="2" fill="var(--brass)" />
            <circle cx="270" cy="75" r="2" fill="var(--brass)" />
            <text
              x="150"
              y="49"
              textAnchor="middle"
              fontSize="7.5"
              fill="var(--paper)"
              fillOpacity="0.4"
              fontFamily="var(--font-data)"
              letterSpacing="0.08em"
            >
              PLANTA
            </text>
          </svg>
        </div>

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

        {/* left side elevation */}
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
          <SideFace />
        </div>

        {/* right side elevation */}
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
          <SideFace />
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

function SideFace() {
  return (
    <svg viewBox="0 0 90 230" fill="none" className="h-full w-full text-paper/70" aria-hidden="true">
      <path
        d="M12 90 45 38 78 90"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 90V172H70V90"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="33" y="112" width="24" height="28" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M45 112V140M33 126H57" stroke="currentColor" strokeWidth="0.75" />
      <text
        x="45"
        y="200"
        textAnchor="middle"
        fontSize="8"
        fill="var(--brass)"
        fillOpacity="0.7"
        fontFamily="var(--font-data)"
        letterSpacing="0.08em"
      >
        LATERAL
      </text>
    </svg>
  );
}
