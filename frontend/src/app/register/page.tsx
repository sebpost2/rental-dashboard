"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLogin, apiRegister, ApiError } from "@/lib/api";
import { RooflineIcon } from "@/components/RooflineIcon";
import { BlueprintHero } from "@/components/BlueprintHero";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRegister(email, password);
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <BlueprintHero />
      <div className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex items-center gap-2 text-ink lg:hidden">
          <RooflineIcon className="size-6 text-brass" />
          <span className="font-heading text-sm font-medium tracking-[0.14em] uppercase">
            Rental Ledger
          </span>
        </div>
        <Card className="reg-marks w-full max-w-sm">
          <CardHeader>
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Registro
            </p>
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
