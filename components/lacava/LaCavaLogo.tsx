import { LACAVA } from "./theme";

/**
 * Recreación en HTML/CSS del lock-up de La Cava de Jumbo (marco fino crema,
 * "LA / CAVA" en serif y el pill verde JUMBO), tal como aparece en la gráfica
 * del evento. Se recrea en vez de hotlinkear un asset porque el original solo
 * existe rasterizado dentro de los banners de puntoticket/jumbo.cl.
 *
 * Pensado para fondos oscuros (verde botella). `scale` ajusta el tamaño
 * completo del lock-up.
 */
export default function LaCavaLogo({ scale = 1 }: { scale?: number }) {
  return (
    <div
      className="inline-flex flex-col items-center"
      style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "left center" }}
    >
      <div
        className="flex flex-col items-center rounded-md border px-5 pb-3 pt-2"
        style={{ borderColor: LACAVA.marfil, borderWidth: 1.5 }}
      >
        <span
          className="font-lacava text-sm font-medium leading-none tracking-[0.45em]"
          style={{ color: LACAVA.marfil, marginRight: "-0.45em" }}
        >
          LA
        </span>
        <span
          className="font-lacava text-4xl font-semibold leading-none tracking-[0.12em]"
          style={{ color: LACAVA.marfil, marginRight: "-0.12em", marginTop: 4 }}
        >
          CAVA
        </span>
      </div>
      <span
        className="-mt-2 rounded-full px-3 py-0.5 font-sans text-xs font-extrabold italic tracking-wide text-white"
        style={{ backgroundColor: LACAVA.jumbo }}
      >
        JUMBO
      </span>
    </div>
  );
}
