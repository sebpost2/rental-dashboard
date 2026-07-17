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
    return data.detail ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export type User = { id: number; email: string };

export async function apiRegister(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new ApiError(await parseError(response));
  return response.json();
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new ApiError(await parseError(response));
  const data = await response.json();
  return data.access_token as string;
}

export async function apiMe(token: string): Promise<User> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(await parseError(response));
  return response.json();
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

async function authedFetch(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new ApiError(await parseError(response));
  return response;
}

export async function apiListProperties(token: string): Promise<Property[]> {
  return (await authedFetch(token, "/properties")).json();
}

export async function apiGetProperty(token: string, id: number): Promise<Property> {
  return (await authedFetch(token, `/properties/${id}`)).json();
}

export async function apiCreateProperty(
  token: string,
  input: PropertyInput
): Promise<Property> {
  return (
    await authedFetch(token, "/properties", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiUpdateProperty(
  token: string,
  id: number,
  input: Partial<PropertyInput>
): Promise<Property> {
  return (
    await authedFetch(token, `/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteProperty(token: string, id: number): Promise<void> {
  await authedFetch(token, `/properties/${id}`, { method: "DELETE" });
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
  token: string,
  propertyId: number,
  startDate?: string,
  endDate?: string
): Promise<Income[]> {
  return (
    await authedFetch(
      token,
      `/properties/${propertyId}/incomes${dateRangeQuery(startDate, endDate)}`
    )
  ).json();
}

export async function apiCreateIncome(
  token: string,
  propertyId: number,
  input: IncomeInput
): Promise<Income> {
  return (
    await authedFetch(token, `/properties/${propertyId}/incomes`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteIncome(
  token: string,
  propertyId: number,
  incomeId: number
): Promise<void> {
  await authedFetch(token, `/properties/${propertyId}/incomes/${incomeId}`, {
    method: "DELETE",
  });
}

export async function apiListExpenses(
  token: string,
  propertyId: number,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> {
  return (
    await authedFetch(
      token,
      `/properties/${propertyId}/expenses${dateRangeQuery(startDate, endDate)}`
    )
  ).json();
}

export async function apiCreateExpense(
  token: string,
  propertyId: number,
  input: ExpenseInput
): Promise<Expense> {
  return (
    await authedFetch(token, `/properties/${propertyId}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).json();
}

export async function apiDeleteExpense(
  token: string,
  propertyId: number,
  expenseId: number
): Promise<void> {
  await authedFetch(token, `/properties/${propertyId}/expenses/${expenseId}`, {
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

export async function apiReportSummary(
  token: string,
  filters: ReportFilters
): Promise<ReportSummary> {
  return (await authedFetch(token, `/reports/summary${reportQuery(filters)}`)).json();
}

export async function apiReportTimeseries(
  token: string,
  filters: ReportFilters
): Promise<TimeseriesPoint[]> {
  return (
    await authedFetch(token, `/reports/timeseries${reportQuery(filters)}`)
  ).json();
}

export async function apiExportCsv(token: string, filters: ReportFilters): Promise<Blob> {
  return (await authedFetch(token, `/reports/export${reportQuery(filters)}`)).blob();
}
