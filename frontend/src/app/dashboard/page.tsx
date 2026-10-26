"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiExportCsv,
  apiListProperties,
  apiMe,
  apiReportSummary,
  apiReportTimeseries,
  Property,
  ReportSummary,
  TimeseriesPoint,
  User,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/StatTile";
import { IncomeExpenseChart } from "@/components/IncomeExpenseChart";
import { AppHeader } from "@/components/AppHeader";
import { HeroBalance } from "@/components/HeroBalance";
import { formatMoney } from "@/lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);

  useEffect(() => {
    apiMe()
      .then(setUser)
      .catch(() => {
        router.push("/login");
      });
    apiListProperties()
      .then(setProperties)
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const filters = {
      propertyId: propertyId === "all" ? undefined : Number(propertyId),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    apiReportSummary(filters).then(setSummary);
    apiReportTimeseries(filters).then(setTimeseries);
  }, [user, propertyId, startDate, endDate]);

  const cumulativeTrend = useMemo(
    () =>
      timeseries.reduce<{ period: string; cumulative: number }[]>(
        (acc, t) => [...acc, { period: t.period, cumulative: (acc.at(-1)?.cumulative ?? 0) + t.income - t.expenses }],
        [],
      ),
    [timeseries],
  );

  async function handleExport() {
    const blob = await apiExportCsv({
      propertyId: propertyId === "all" ? undefined : Number(propertyId),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) return null;

  return (
    <>
      <AppHeader active="dashboard" email={user.email} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-8">
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Hoja 02 · Resumen
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold">Dashboard</h1>
          </div>
          <p className="hidden font-mono text-xs text-muted-foreground sm:block">
            {new Date().toLocaleDateString("es", { year: "numeric", month: "long" })}
          </p>
        </div>

      <div className="reg-marks flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="filter-property" className="text-xs tracking-[0.08em] uppercase">
            Propiedad
          </Label>
          <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "all")}>
            <SelectTrigger id="filter-property" className="w-48">
              <SelectValue>
                {(value: string) =>
                  value === "all"
                    ? "Todas las propiedades"
                    : (properties.find((p) => String(p.id) === value)?.name ?? value)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las propiedades</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-start" className="text-xs tracking-[0.08em] uppercase">
            Desde
          </Label>
          <Input
            id="filter-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-end" className="text-xs tracking-[0.08em] uppercase">
            Hasta
          </Label>
          <Input
            id="filter-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={handleExport} className="ml-auto">
          Exportar CSV
        </Button>
      </div>

      {summary && (
        <>
          <HeroBalance netBalance={summary.net_balance} trend={cumulativeTrend} />

          <div className="rise-in rise-in-2 grid gap-4 sm:grid-cols-2">
            <StatTile label="Ingresos totales" value={formatMoney(summary.total_income)} />
            <StatTile label="Gastos totales" value={formatMoney(summary.total_expenses)} />
          </div>
        </>
      )}

        <div className="rise-in rise-in-3">
          <IncomeExpenseChart data={timeseries} />
        </div>
      </main>
    </>
  );
}
