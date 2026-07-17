"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiDeleteProperty, apiListProperties, Property } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { RooflineIcon } from "@/components/RooflineIcon";

export default function PropertiesPage() {
  const user = useAuthGuard();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiListProperties()
      .then(setProperties)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleDelete(id: number) {
    await apiDeleteProperty(id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  if (!user) return null;

  return (
    <>
      <AppHeader active="properties" />
      <main className="mx-auto w-full max-w-6xl p-8">
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Hoja 03 · Inventario
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold">Propiedades</h1>
          </div>
          <Link href="/properties/new" className={buttonVariants()}>
            Nueva propiedad
          </Link>
        </div>

        {loading ? (
          <p className="mt-6 text-muted-foreground">Cargando...</p>
        ) : properties.length === 0 ? (
          <p className="mt-6 text-muted-foreground">
            Aún no tienes propiedades registradas.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <div
                key={p.id}
                className="reg-marks flex flex-col justify-between rounded-md border border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div>
                  <Link
                    href={`/properties/${p.id}`}
                    className="flex items-start gap-3 hover:underline"
                  >
                    <RooflineIcon className="size-6 shrink-0 text-blueprint" />
                    <span className="font-heading text-lg font-medium leading-tight">
                      {p.name}
                    </span>
                  </Link>
                  <p className="mt-2 text-sm text-muted-foreground">{p.address}</p>
                  <dl className="mt-4 flex gap-4 border-t border-border pt-3 font-mono text-xs">
                    <div>
                      <dt className="text-muted-foreground uppercase tracking-[0.08em]">Tipo</dt>
                      <dd className="mt-0.5">{p.property_type}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground uppercase tracking-[0.08em]">Moneda</dt>
                      <dd className="mt-0.5">{p.currency}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Link
                    href={`/properties/${p.id}/edit`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Editar
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
