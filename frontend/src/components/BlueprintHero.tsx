export function BlueprintHero() {
  return (
    <div className="bp-grid-ink relative hidden h-full flex-col justify-between overflow-hidden p-10 text-paper lg:flex">
      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase text-paper/60">
        <span>Hoja 01</span>
        <span className="h-px w-6 bg-paper/30" />
        <span>Elevación frontal</span>
      </div>

      <svg
        viewBox="0 0 320 220"
        fill="none"
        className="w-full max-w-md self-center text-paper/85"
        aria-hidden="true"
      >
        {/* roofline */}
        <path
          d="M40 90 160 20 280 90"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* walls */}
        <path
          d="M56 90V180H264V90"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* door */}
        <path
          d="M140 180V132H180V180"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* windows */}
        <rect x="80" y="115" width="32" height="32" rx="1" stroke="currentColor" strokeWidth="1.25" />
        <path d="M96 115V147M80 131H112" stroke="currentColor" strokeWidth="1" />
        <rect x="208" y="115" width="32" height="32" rx="1" stroke="currentColor" strokeWidth="1.25" />
        <path d="M224 115V147M208 131H240" stroke="currentColor" strokeWidth="1" />

        {/* dimension line + ticks under the elevation */}
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

        {/* brass value tag pinned to the roof */}
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
      </svg>

      <div className="max-w-xs">
        <p className="font-heading text-lg leading-snug text-paper">
          Cada propiedad, registrada como un plano.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper/60">
          Ingresos y gastos trazados con la misma precisión con la que se levanta un edificio.
        </p>
      </div>
    </div>
  );
}
