const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (Array.isArray(data.detail)) {
      return data.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join("; ");
    }
    return data.detail ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new ApiError(await parseError(response));
  return response;
}

export type User = { id: number; email: string };

export async function apiRegister(email: string, password: string): Promise<User> {
  return (
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  ).json();
}

export async function apiLogin(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password });
  await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function apiMe(): Promise<User> {
  return (await apiFetch("/auth/me")).json();
}

export type Property = {
  id: number;
  name: string;
  address: string;
  property_type: string;
  currency: string;
};

export type PropertyInput = {
  name: string;
  address: string;
  property_type: string;
  currency: string;
};

export async function apiListProperties(): Promise<Property[]> {
  return (await apiFetch("/properties")).json();
}

export async function apiGetProperty(id: number): Promise<Property> {
  return (await apiFetch(`/properties/${id}`)).json();
}

export async function apiCreateProperty(input: PropertyInput): Promise<Property> {
  return (
    await apiFetch("/properties", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiUpdateProperty(
  id: number,
  input: Partial<PropertyInput>
): Promise<Property> {
  return (
    await apiFetch(`/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteProperty(id: number): Promise<void> {
  await apiFetch(`/properties/${id}`, { method: "DELETE" });
}

export type Income = {
  id: number;
  date: string;
  amount: number;
  source: string;
  notes: string | null;
};

export type IncomeInput = {
  date: string;
  amount: number;
  source: string;
  notes?: string;
};

export const EXPENSE_CATEGORIES = [
  "cleaning",
  "maintenance",
  "commission",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: number;
  date: string;
  amount: number;
  category: ExpenseCategory;
  notes: string | null;
};

export type ExpenseInput = {
  date: string;
  amount: number;
  category: ExpenseCategory;
  notes?: string;
};

function dateRangeQuery(startDate?: string, endDate?: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function apiListIncome(
  propertyId: number,
  startDate?: string,
  endDate?: string
): Promise<Income[]> {
  return (
    await apiFetch(
      `/properties/${propertyId}/incomes${dateRangeQuery(startDate, endDate)}`
    )
  ).json();
}

export async function apiCreateIncome(
  propertyId: number,
  input: IncomeInput
): Promise<Income> {
  return (
    await apiFetch(`/properties/${propertyId}/incomes`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteIncome(propertyId: number, incomeId: number): Promise<void> {
  await apiFetch(`/properties/${propertyId}/incomes/${incomeId}`, {
    method: "DELETE",
  });
}

export async function apiListExpenses(
  propertyId: number,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> {
  return (
    await apiFetch(
      `/properties/${propertyId}/expenses${dateRangeQuery(startDate, endDate)}`
    )
  ).json();
}

export async function apiCreateExpense(
  propertyId: number,
  input: ExpenseInput
): Promise<Expense> {
  return (
    await apiFetch(`/properties/${propertyId}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteExpense(propertyId: number, expenseId: number): Promise<void> {
  await apiFetch(`/properties/${propertyId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}

export type ReportSummary = {
  total_income: number;
  total_expenses: number;
  net_balance: number;
};

export type TimeseriesPoint = {
  period: string;
  income: number;
  expenses: number;
};

export type ReportFilters = {
  propertyId?: number;
  startDate?: string;
  endDate?: string;
};

function reportQuery(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.propertyId) params.set("property_id", String(filters.propertyId));
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function apiReportSummary(filters: ReportFilters): Promise<ReportSummary> {
  return (await apiFetch(`/reports/summary${reportQuery(filters)}`)).json();
}

export async function apiReportTimeseries(
  filters: ReportFilters
): Promise<TimeseriesPoint[]> {
  return (await apiFetch(`/reports/timeseries${reportQuery(filters)}`)).json();
}

export async function apiExportCsv(filters: ReportFilters): Promise<Blob> {
  return (await apiFetch(`/reports/export${reportQuery(filters)}`)).blob();
}
