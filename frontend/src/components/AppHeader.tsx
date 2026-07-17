"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RooflineIcon } from "@/components/RooflineIcon";
import { apiLogout } from "@/lib/api";

export function AppHeader({
  active,
  email,
}: {
  active: "dashboard" | "properties";
  email?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await apiLogout();
    router.push("/login");
  }

  return (
    <header className="bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <RooflineIcon className="size-5 text-brass" />
            <span className="font-heading text-sm font-medium tracking-[0.14em] uppercase">
              Rental Ledger
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className={
                active === "dashboard"
                  ? "border-b-2 border-brass pb-0.5 text-paper"
                  : "text-paper/70 hover:text-paper"
              }
            >
              Dashboard
            </Link>
            <Link
              href="/properties"
              className={
                active === "properties"
                  ? "border-b-2 border-brass pb-0.5 text-paper"
                  : "text-paper/70 hover:text-paper"
              }
            >
              Propiedades
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-paper/70">
          {email && <span className="hidden sm:inline">{email}</span>}
          <button type="button" onClick={handleLogout} className="hover:text-paper">
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
