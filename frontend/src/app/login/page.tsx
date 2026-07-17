"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLogin, ApiError } from "@/lib/api";
import { RooflineIcon } from "@/components/RooflineIcon";
import { BlueprintHero } from "@/components/BlueprintHero";

export default function LoginPage() {
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
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      await apiLogin("demo@rentalledger.com", "demopass123");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al iniciar la demo");
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
              Acceso
            </p>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={handleDemoLogin}
            >
              Ver demo en vivo
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="underline">
                Regístrate
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
