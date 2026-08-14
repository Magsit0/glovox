import Link from "next/link";
import type { DisplayCurrency } from "@/lib/queries/paidMedia";
import { DISPLAY_CURRENCIES } from "@/lib/queries/paidMedia";

interface Props {
  active: DisplayCurrency;
  /**
   * Genera el href para cada moneda preservando el resto del scope. Lo arma la
   * página, que es la que conoce los searchParams vigentes de cada tab.
   */
  hrefFor: (moneda: DisplayCurrency) => string;
}

/**
 * Switch de moneda de DESPLIEGUE (USD ↔ CLP).
 *
 * No filtra datos: el scope es siempre el mismo (todas las cuentas, todas las
 * monedas de origen). Lo único que cambia es la unidad en que se expresa el
 * consolidado, y la reexpresión se hace en SQL fila a fila con la tasa del día
 * de cada fila — no aplicando una tasa promedio al total.
 *
 * Es un par de links, no un `<select>` ni un input controlado: con dos opciones
 * el segmentado se lee de un vistazo, deja el estado en la URL (compartible,
 * navegable con el botón atrás) y funciona sin JavaScript.
 */
export default function CurrencySwitch({ active, hrefFor }: Props) {
  return (
    <section className="flex items-center gap-2">
      <span className="font-sans text-xs text-[#666666]">Moneda</span>
      <div
        role="group"
        aria-label="Moneda de despliegue"
        className="inline-flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1"
      >
        {DISPLAY_CURRENCIES.map((m) => {
          const isActive = m === active;
          return (
            <Link
              key={m}
              href={hrefFor(m)}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#F0EFFE] text-[#9F99F8]"
                  : "text-[#666666] hover:text-[#333333]"
              }`}
            >
              {m}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
