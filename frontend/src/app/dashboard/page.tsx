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
import { clearToken, getToken } from "@/lib/auth";
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

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    apiMe(token)
      .then(setUser)
      .catch(() => {
        clearToken();
        router.push("/login");
      });
    apiListProperties(token).then(setProperties);
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;
    const filters = {
      propertyId: propertyId === "all" ? undefined : Number(propertyId),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    apiReportSummary(token, filters).then(setSummary);
    apiReportTimeseries(token, filters).then(setTimeseries);
  }, [user, propertyId, startDate, endDate]);

  const cumulativeTrend = useMemo(() => {
    let running = 0;
    return timeseries.map((t) => {
      running += t.income - t.expenses;
      return { period: t.period, cumulative: running };
    });
  }, [timeseries]);

  async function handleExport() {
    const token = getToken();
    if (!token) return;
    const blob = await apiExportCsv(token, {
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
        <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="filter-property">Propiedad</Label>
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
          <Label htmlFor="filter-start">Desde</Label>
          <Input
            id="filter-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-end">Hasta</Label>
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
