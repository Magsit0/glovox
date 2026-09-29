import {
  ALERTA,
  COBERTURA_BAJA_PCT,
  agruparMediosPago,
  alertasCobertura,
  diaProvisional,
  diasEntre,
  pct,
  type AlertaCobertura,
  type AtribucionCompras,
  type CoberturaDiaRow,
} from "@/lib/marketing/atribucion";
import { fmtFechaCorta, fmtPct } from "@/lib/marketing/formato";
import { BloqueTitulo, Nota, fmtNum } from "./ui";

type Props = {
  a: Pick<
    AtribucionCompras,
    "ordenes" | "porDia" | "porMedioPago" | "etlHasta" | "medibleDesde" | "medibleHasta" | "fechaEvento"
  >;
};

const COLOR_OK = "#0000FF";
const COLOR_BAJA = "#FF0000";
// Texto rojo sobre blanco: #FF0000 da 4,0:1 (bajo AA en texto chico); las barras siguen en #FF0000.
const TEXTO_BAJA = "text-[#CC0000]";

/** Un corte después del primer día del evento se informa sin culpar al tag. */
const esInformativa = (al: AlertaCobertura) => al.tipo === "corte" && al.postEvento;

function textoAlerta(al: AlertaCobertura): string {
  if (al.tipo === "corte") {
    return al.postEvento
      ? `El ${fmtFechaCorta(al.fecha)}, ya iniciado el evento, GA4 no registró ninguna de las ${fmtNum(al.ordenes)} órdenes web. ` +
          "Suelen ser compras en el portal de la ticketera o en la entrada, que el sitio del evento no ve."
      : `El ${fmtFechaCorta(al.fecha)} GA4 no registró ninguna de las ${fmtNum(al.ordenes)} órdenes web. Revisa el tag de compra.`;
  }
  const pp = al.pp.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    `Últimos ${ALERTA.ventanaDias} días: ${fmtPct(al.ultimos)} de cobertura, ${pp} pp bajo el resto del ` +
    `período (${fmtPct(al.base)}). Revisa el tag de compra.`
  );
}

/**
 * "Salud de la medición": qué parte de las órdenes web ve GA4 (con su número de
 * orden), por día y por medio de pago, y alertas de corte o caída del tag de
 * compra. Las barras son divs (sin recharts): cada día tiene un riel del 100%.
 */
export default function SaludMedicion({ a }: Props) {
  const { ordenes, porDia, porMedioPago, etlHasta } = a;
  const cobertura = pct(ordenes.vistas, ordenes.medibles);
  const alertas = alertasCobertura(porDia, etlHasta, a.fechaEvento);
  const medios = agruparMediosPago(porMedioPago);

  // Un slot por día de la ventana medida (los días sin órdenes quedan vacíos),
  // para que el eje no salte días.
  const porFecha = new Map(porDia.map((d) => [d.date, d]));
  const fechas =
    a.medibleDesde && a.medibleHasta ? diasEntre(a.medibleDesde, a.medibleHasta) : porDia.map((d) => d.date);
  for (const d of porDia) if (!fechas.includes(d.date)) fechas.push(d.date);
  fechas.sort();
  const dias: (CoberturaDiaRow & { provisional: boolean })[] = fechas.map((date) => ({
    ...(porFecha.get(date) ?? { date, ordenes: 0, vistas: 0, pasarela: 0 }),
    provisional: diaProvisional(date, etlHasta),
  }));

  return (
    <div className="min-w-0">
      <BloqueTitulo>Salud de la medición</BloqueTitulo>

      <p className="font-display text-4xl leading-none tabular-nums">{fmtPct(cobertura)}</p>
      <p className="font-mono-data uppercase text-xs mt-1">Órdenes web vistas por GA4</p>
      <p className="font-mono-data text-xs text-black/60">
        {fmtNum(ordenes.vistas)} de {fmtNum(ordenes.medibles)}
      </p>

      {alertas.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Alertas de medición">
          {alertas.map((al) => (
            <li
              key={al.tipo === "corte" ? `corte-${al.fecha}` : "caida"}
              role={esInformativa(al) ? "note" : "alert"}
              className={`border-4 border-black font-mono-data text-xs p-2 ${
                esInformativa(al) ? "bg-white text-black" : "bg-[#FF0000] text-white"
              }`}
            >
              {textoAlerta(al)}
            </li>
          ))}
        </ul>
      )}

      {dias.length > 0 && (
        <div className="mt-4">
          <p className="font-mono-data uppercase text-xs mb-1">Cobertura diaria</p>
          <div
            className="relative flex items-end gap-px h-16 border-b-2 border-black"
            role="list"
            aria-label="Cobertura diaria de GA4"
          >
            {/* Línea del 50%: bajo ella la barra va en rojo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-black/40"
              style={{ bottom: `${COBERTURA_BAJA_PCT}%` }}
            />
            {dias.map((d) => {
              const p = pct(d.vistas, d.ordenes);
              const detalle =
                d.ordenes === 0
                  ? `${fmtFechaCorta(d.date)}: sin órdenes web`
                  : `${fmtFechaCorta(d.date)}: ${fmtNum(d.vistas)} de ${fmtNum(d.ordenes)} órdenes (${fmtPct(p)})`;
              const titulo = d.provisional ? `${detalle} · dato provisional, GA4 puede seguir procesando` : detalle;
              const baja = p != null && p < COBERTURA_BAJA_PCT;
              return (
                <div
                  key={d.date}
                  role="listitem"
                  aria-label={titulo}
                  title={titulo}
                  className={`relative flex-1 min-w-px h-full flex items-end bg-black/10 ${d.provisional ? "opacity-40" : ""}`}
                >
                  {d.ordenes > 0 && (
                    <div
                      className="w-full"
                      style={{
                        // Un corte (0 vistas) deja una marca mínima para que se vea.
                        height: `${Math.max(p ?? 0, 3)}%`,
                        backgroundColor: baja ? COLOR_BAJA : COLOR_OK,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-mono-data text-[10px] text-black/60 mt-1">
            <span>{fmtFechaCorta(dias[0].date)}</span>
            {dias.length > 1 && <span>{fmtFechaCorta(dias[dias.length - 1].date)}</span>}
          </div>
        </div>
      )}

      {medios.length > 0 && (
        <div className="mt-4">
          <p className="font-mono-data uppercase text-xs mb-1">Por medio de pago</p>
          <ul className="font-mono-data text-xs divide-y divide-black/20 border-y-2 border-black">
            {medios.map((m) => (
              <li
                key={m.medioPago}
                className={`flex items-baseline justify-between gap-2 py-1 ${m.baja ? `${TEXTO_BAJA} font-bold` : ""}`}
                title={m.baja ? `Cobertura bajo ${COBERTURA_BAJA_PCT}%: GA4 casi no ve este medio de pago.` : undefined}
              >
                <span className="min-w-0 truncate" title={m.medioPago}>
                  {m.medioPago || "(sin medio de pago)"}
                </span>
                <span className="shrink-0 tabular-nums whitespace-nowrap">
                  {fmtNum(m.vistas)}/{fmtNum(m.ordenes)} · {fmtPct(m.pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ordenes.vistas > 0 && (
        <p className="font-mono-data text-xs mt-3">
          Pasarela como origen: {fmtNum(ordenes.vistasPasarela)} de {fmtNum(ordenes.vistas)} compras vistas (
          {fmtPct(pct(ordenes.vistasPasarela, ordenes.vistas))}). Son compras que perdieron su canal al volver del
          pago.
        </p>
      )}

      <Nota>
        Cómo leer: cobertura = órdenes del checkout web que GA4 registró con su número de orden. Los pagos que
        redirigen al banco (Pago en Línea, Mach) suelen no volver al sitio y GA4 no los ve. Una caída brusca suele
        indicar un cambio en el tag de compra. El último día cargado es provisional (barra tenue). Después del
        primer día del evento, un día sin compras vistas no culpa al tag: esas ventas suelen ir por el portal de la
        ticketera o la entrada.
      </Nota>
    </div>
  );
}
