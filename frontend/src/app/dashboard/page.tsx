"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiMe, User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

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
  }, [router]);

  if (!user) return null;

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
      <p className="mt-4 text-muted-foreground">Sesión iniciada como {user.email}</p>
    </main>
  );
}
