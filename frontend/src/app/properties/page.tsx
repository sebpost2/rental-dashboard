"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiDeleteProperty, apiListProperties, Property } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PropertiesPage() {
  const token = useAuthGuard();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiListProperties(token)
      .then(setProperties)
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(id: number) {
    if (!token) return;
    await apiDeleteProperty(token, id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  if (!token) return null;

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Propiedades</h1>
        <Link href="/properties/new" className={buttonVariants()}>
          Nueva propiedad
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-muted-foreground">Cargando...</p>
      ) : properties.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          Aún no tienes propiedades registradas.
        </p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.address}</TableCell>
                <TableCell>{p.property_type}</TableCell>
                <TableCell>{p.currency}</TableCell>
                <TableCell className="flex justify-end gap-2">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
