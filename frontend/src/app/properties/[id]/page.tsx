"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  apiCreateExpense,
  apiCreateIncome,
  apiDeleteExpense,
  apiDeleteIncome,
  apiGetProperty,
  apiListExpenses,
  apiListIncome,
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
  Income,
  Property,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/AppHeader";
import { RooflineIcon } from "@/components/RooflineIcon";

export default function PropertyDetailPage() {
  const user = useAuthGuard();
  const params = useParams<{ id: string }>();
  const propertyId = Number(params.id);

  const [property, setProperty] = useState<Property | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [incomeDate, setIncomeDate] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState("");

  const [expenseDate, setExpenseDate] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("cleaning");

  useEffect(() => {
    if (!user) return;
    apiGetProperty(propertyId).then(setProperty);
    apiListIncome(propertyId).then(setIncomes);
    apiListExpenses(propertyId).then(setExpenses);
  }, [user, propertyId]);

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    const created = await apiCreateIncome(propertyId, {
      date: incomeDate,
      amount: Number(incomeAmount),
      source: incomeSource,
    });
    setIncomes((prev) => [...prev, created]);
    setIncomeDate("");
    setIncomeAmount("");
    setIncomeSource("");
  }

  async function handleDeleteIncome(id: number) {
    await apiDeleteIncome(propertyId, id);
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const created = await apiCreateExpense(propertyId, {
      date: expenseDate,
      amount: Number(expenseAmount),
      category: expenseCategory,
    });
    setExpenses((prev) => [...prev, created]);
    setExpenseDate("");
    setExpenseAmount("");
  }

  async function handleDeleteExpense(id: number) {
    await apiDeleteExpense(propertyId, id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  if (!user || !property) return null;

  return (
    <>
      <AppHeader active="properties" />
      <main className="mx-auto w-full max-w-6xl space-y-8 p-8">
        <div className="flex items-center gap-3">
          <RooflineIcon className="size-8 text-blueprint" />
          <div>
            <h1 className="text-2xl font-semibold">{property.name}</h1>
            <p className="text-muted-foreground">{property.address}</p>
          </div>
        </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddIncome} className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="income-date">Fecha</Label>
                <Input
                  id="income-date"
                  type="date"
                  required
                  value={incomeDate}
                  onChange={(e) => setIncomeDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="income-amount">Monto</Label>
                <Input
                  id="income-amount"
                  type="number"
                  step="0.01"
                  required
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="income-source">Fuente</Label>
                <Input
                  id="income-source"
                  required
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                />
              </div>
              <Button type="submit" className="col-span-3">
                Agregar ingreso
              </Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono tabular-nums">{i.date}</TableCell>
                    <TableCell className="font-mono tabular-nums">{i.amount}</TableCell>
                    <TableCell>{i.source}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteIncome(i.id)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddExpense} className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="expense-date">Fecha</Label>
                <Input
                  id="expense-date"
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expense-amount">Monto</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expense-category">Categoría</Label>
                <Select
                  value={expenseCategory}
                  onValueChange={(v) => setExpenseCategory(v as ExpenseCategory)}
                >
                  <SelectTrigger id="expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="col-span-3">
                Agregar gasto
              </Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono tabular-nums">{e.date}</TableCell>
                    <TableCell className="font-mono tabular-nums">{e.amount}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteExpense(e.id)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>
      </main>
    </>
  );
}
