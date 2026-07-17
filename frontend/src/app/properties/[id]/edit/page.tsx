"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiGetProperty, apiUpdateProperty, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EditPropertyPage() {
  const user = useAuthGuard();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const propertyId = Number(params.id);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiGetProperty(propertyId).then((p) => {
      setName(p.name);
      setAddress(p.address);
      setPropertyType(p.property_type);
      setCurrency(p.currency);
      setLoaded(true);
    });
  }, [user, propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiUpdateProperty(propertyId, {
        name,
        address,
        property_type: propertyType,
        currency,
      });
      router.push("/properties");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al actualizar la propiedad");
    } finally {
      setLoading(false);
    }
  }

  if (!user || !loaded) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Editar propiedad</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property_type">Tipo</Label>
              <Input
                id="property_type"
                required
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Input
                id="currency"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
