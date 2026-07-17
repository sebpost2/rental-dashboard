import { ExpenseCategory } from "@/lib/api";

export function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  cleaning: "Limpieza",
  maintenance: "Mantenimiento",
  commission: "Comisión",
  other: "Otro",
};

export function formatExpenseCategory(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[category];
}
