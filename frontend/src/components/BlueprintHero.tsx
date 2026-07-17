import { BlueprintHouse3D } from "@/components/BlueprintHouse3D";

export function BlueprintHero() {
  return (
    <div className="bp-grid-ink relative hidden h-full flex-col justify-between overflow-hidden p-10 text-paper lg:flex">
      <div className="flex items-center justify-between text-xs font-medium tracking-[0.14em] uppercase text-paper/60">
        <span className="flex items-center gap-2">
          <span>Hoja 01</span>
          <span className="h-px w-6 bg-paper/30" />
          <span>Elevación frontal</span>
        </span>
        <span className="hidden text-paper/35 sm:inline">Mueve el cursor para girar</span>
      </div>

      <BlueprintHouse3D />

      <div className="max-w-xs">
        <p className="font-heading text-lg leading-snug text-paper">
          Cada propiedad, registrada como un plano.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper/60">
          Ingresos y gastos trazados con la misma precisión con la que se levanta un edificio.
        </p>
      </div>
    </div>
  );
}
