"use client";

import { useState } from "react";
import { TimeseriesPoint } from "@/lib/api";

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function IncomeExpenseChart({ data }: { data: TimeseriesPoint[] }) {
  const [tableView, setTableView] = useState(false);
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const [hover, setHover] = useState<{ period: string; series: string; value: number } | null>(
    null
  );

  return (
    <div className="rd-chart rounded-md border border-border bg-card p-4">
      <style>{`
        .rd-chart { --series-income: #3d6e9e; --series-expenses: #b4453a; }
        @media (prefers-color-scheme: dark) {
          .rd-chart { --series-income: #5a93c4; --series-expenses: #d9695c; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: "var(--series-income)" }}
            />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: "var(--series-expenses)" }}
            />
            Gastos
          </span>
        </div>
        <button
          type="button"
          onClick={() => setTableView((v) => !v)}
          className="text-xs text-muted-foreground underline"
        >
          {tableView ? "Ver gráfica" : "Ver tabla"}
        </button>
      </div>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Sin datos para el período seleccionado.
        </p>
      ) : tableView ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Período</th>
              <th className="py-1 font-normal">Ingresos</th>
              <th className="py-1 font-normal">Gastos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.period} className="border-t border-border">
                <td className="py-1.5">{d.period}</td>
                <td className="py-1.5 font-mono tabular-nums">{d.income.toFixed(2)}</td>
                <td className="py-1.5 font-mono tabular-nums">{d.expenses.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-6 flex h-48 items-end gap-4">
          {data.map((d) => (
            <div key={d.period} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-40 items-end gap-0.5">
                <div
                  className="group relative w-3 rounded-t-[4px]"
                  style={{
                    height: `${(d.income / max) * 100}%`,
                    backgroundColor: "var(--series-income)",
                  }}
                  onMouseEnter={() =>
                    setHover({ period: d.period, series: "Ingresos", value: d.income })
                  }
                  onMouseLeave={() => setHover(null)}
                >
                  {hover?.period === d.period && hover.series === "Ingresos" && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-1.5 py-0.5 font-mono text-xs tabular-nums text-popover-foreground shadow-md">
                      {d.income.toFixed(2)}
                    </div>
                  )}
                </div>
                <div
                  className="group relative w-3 rounded-t-[4px]"
                  style={{
                    height: `${(d.expenses / max) * 100}%`,
                    backgroundColor: "var(--series-expenses)",
                  }}
                  onMouseEnter={() =>
                    setHover({ period: d.period, series: "Gastos", value: d.expenses })
                  }
                  onMouseLeave={() => setHover(null)}
                >
                  {hover?.period === d.period && hover.series === "Gastos" && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-1.5 py-0.5 font-mono text-xs tabular-nums text-popover-foreground shadow-md">
                      {d.expenses.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{d.period}</span>
            </div>
          ))}
        </div>
      )}
      {!tableView && data.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Escala máxima: {formatCompact(max)}
        </p>
      )}
    </div>
  );
}
