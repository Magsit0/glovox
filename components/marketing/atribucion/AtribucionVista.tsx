import {
  etlAtrasado,
  tieneMedicion,
  ventanaMedida,
  type AtribucionCompras,
  type VentanaMedida,
} from "@/lib/marketing/atribucion";
import { fmtFechaCorta } from "@/lib/marketing/formato";
import BrutalChartPanel from "@/components/marketing/BrutalChartPanel";
import LentesPaidMedia from "./LentesPaidMedia";
import OrigenRealTable from "./OrigenRealTable";
import SaludMedicion from "./SaludMedicion";
import ComprasDiaCanalChart from "./ComprasDiaCanalChart";
import { BloqueTitulo, fmtFechaLarga, fmtNum, plural } from "./ui";

/** id del bloque: el panel Paid Media enlaza aquí ("Compara con GA4 y Referido ↓"). */
export const ANCLA_ATRIBUCION = "atribucion-compras";

type Props = {
  a: AtribucionCompras;
  eventoId: string;
  // Bloques con consulta propia (llegan en streaming desde AtribucionSection).
  // Solo se muestran cuando hay ventana medida.
  contenidos: React.ReactNode;
  conjuntos: React.ReactNode;
};

/**
 * Vista de la sección "Atribución de compras": sin consultas (las hace
 * AtribucionSection), para que la composición se pueda renderizar con datos
 * fijos. Cabecera con chips y aviso de medición parcial; con ventana medida,
 * tres filas (lentes | origen real | salud; compras por día | contenidos;
 * conjuntos Meta); sin ella, una línea que explica el estado.
 */
export default function AtribucionVista({ a, eventoId, contenidos, conjuntos }: Props) {
  const ventana = ventanaMedida(a);
  return (
    <AtribucionMarco>
      <Cabecera a={a} />
      {ventana ? (
        <Cuerpo a={a} ventana={ventana} eventoId={eventoId} contenidos={contenidos} conjuntos={conjuntos} />
      ) : (
        <MensajeEstado a={a} />
      )}
    </AtribucionMarco>
  );
}

export function AtribucionMarco({ children }: { children: React.ReactNode }) {
  return (
    <div id={ANCLA_ATRIBUCION} className="scroll-mt-6">
      <BrutalChartPanel title="Atribución de compras" className="">
        {children}
      </BrutalChartPanel>
    </div>
  );
}

function Chip({ children, rojo = false, title }: { children: React.ReactNode; rojo?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block font-mono-data uppercase text-xs px-2 py-1 text-white ${rojo ? "bg-[#FF0000]" : "bg-black"}`}
    >
      {children}
    </span>
  );
}

/** Fechas de un rango: con año solo si los dos extremos caen en años distintos. */
function fechasRango(desde: string | null, hasta: string | null): [string, string] {
  const otroAnio = desde != null && hasta != null && desde.slice(0, 4) !== hasta.slice(0, 4);
  const f = otroAnio ? fmtFechaLarga : fmtFechaCorta;
  return [f(desde), f(hasta)];
}

function Cabecera({ a }: { a: AtribucionCompras }) {
  const medicion = tieneMedicion(a);
  // El chip de carga solo aporta cuando hay propiedad GA4 que cargar.
  const muestraEtl = a.etlHasta != null && a.estado !== "sin_ordenes" && a.estado !== "sin_propiedad";
  const atrasado = muestraEtl && etlAtrasado(a.etlHasta);
  if (!medicion && !muestraEtl) return null;

  const [desde, hasta] = fechasRango(a.medibleDesde, a.medibleHasta);
  const [ventaDesde, medDesde] = fechasRango(a.ventanaDesde, a.medibleDesde);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {medicion && (
          <>
            <Chip title="Período en que GA4 registra las compras con su número de orden.">
              Medición GA4 · {desde} – {hasta}
            </Chip>
            <Chip>{plural(a.ordenes.medibles, "orden web medida", "órdenes web medidas")}</Chip>
          </>
        )}
        {muestraEtl && (
          <Chip
            rojo={atrasado}
            title="Último día que cargó el ETL de GA4. GA4 llega con un día de atraso y ese último día es provisional."
          >
            {atrasado
              ? `GA4 atrasado: datos hasta el ${fmtFechaCorta(a.etlHasta)}`
              : `GA4 cargado hasta el ${fmtFechaCorta(a.etlHasta)}`}
          </Chip>
        )}
      </div>
      {a.estado === "parcial" && (
        <p role="note" className="bg-[#FFFF00] border-4 border-black p-4 font-mono-data text-sm mb-4">
          Este evento vende desde el {ventaDesde}, pero GA4 mide sus compras recién desde el {medDesde}. Esta
          sección usa solo ese período ({fmtNum(a.ordenes.medibles)} de {fmtNum(a.ordenes.noPase)} órdenes); el resto
          del dashboard usa toda la ventana de venta.
        </p>
      )}
    </>
  );
}

function MensajeEstado({ a }: { a: AtribucionCompras }) {
  let texto: string;
  switch (a.estado) {
    case "sin_ordenes":
      texto = "Sin órdenes para este evento.";
      break;
    case "sin_propiedad":
      texto =
        "Este evento no tiene una propiedad GA4 asignada, así que no hay compras GA4 para cruzar con las órdenes.";
      break;
    case "sin_tracking":
      texto =
        "GA4 no registra compras con número de orden para este evento. Si vende por web, revisa que el tag de compra (GTM) envíe el transactionId.";
      break;
    case "sin_dias":
      // Si la venta terminó antes del primer día medible, esperar no sirve.
      texto =
        a.ventanaHasta && a.medibleDesde && a.medibleDesde > a.ventanaHasta
          ? `La venta de este evento terminó el ${fmtFechaLarga(a.ventanaHasta)}, antes del primer día completo en que GA4 mide sus compras (${fmtFechaLarga(a.medibleDesde)}).`
          : `GA4 empieza a medir este evento el ${fmtFechaCorta(a.medibleDesde)}. Los datos de GA4 llegan con un día de atraso: vuelve mañana.`;
      break;
    default:
      // parcial / completa sin ventana: no debería ocurrir (ventanaMedida la exige).
      texto = "Sin datos de medición GA4 para este evento.";
  }
  return <p className="font-mono-data text-sm text-black/60">{texto}</p>;
}

function Cuerpo({
  a,
  ventana,
  eventoId,
  contenidos,
  conjuntos,
}: {
  a: AtribucionCompras;
  ventana: VentanaMedida;
  eventoId: string;
  contenidos: React.ReactNode;
  conjuntos: React.ReactNode;
}) {
  return (
    <>
      {/* Fila 1: lentes | origen real | salud. En pantallas medianas el origen
          baja a su propia fila para que las dos columnas angostas respiren. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="min-w-0 xl:col-span-1">
          <LentesPaidMedia a={a} />
        </div>
        <div className="min-w-0 lg:col-span-2 lg:order-last xl:order-none xl:col-span-2">
          <OrigenRealTable
            rows={a.canalReal}
            medibles={a.ordenes.medibles}
            moneda={a.moneda}
            excluidas={{
              pase: a.ordenes.pase,
              antes: a.ordenes.antes,
              pendientes: a.ordenes.pendientes,
              fueraWeb: a.ordenes.fueraWeb,
            }}
            desde={ventana.desde}
            hasta={ventana.hasta}
            eventoId={eventoId}
          />
        </div>
        <div className="min-w-0 xl:col-span-1">
          <SaludMedicion a={a} />
        </div>
      </div>

      {/* Fila 2: compras por día y canal | qué contenido vende (lado a lado solo
          en pantallas muy anchas: la tabla de contenidos necesita 7 columnas). */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 mt-6 pt-6 border-t-2 border-black">
        <ComprasDiaCanalChart
          rows={a.porDiaCanal}
          desde={ventana.desde}
          hasta={ventana.hasta}
          etlHasta={a.etlHasta}
        />
        {contenidos}
      </div>

      {/* Fila 3: rendimiento por conjunto (Meta) */}
      <div className="mt-6 pt-6 border-t-2 border-black">
        {conjuntos}
      </div>
    </>
  );
}

export function BloqueCargando({ titulo }: { titulo: string }) {
  return (
    <div className="min-w-0" aria-busy="true">
      <BloqueTitulo>{titulo}</BloqueTitulo>
      <div className="h-40 bg-black/5 animate-pulse" />
    </div>
  );
}

export function BloqueError({ titulo }: { titulo: string }) {
  return (
    <div className="min-w-0">
      <BloqueTitulo>{titulo}</BloqueTitulo>
      <p className="font-mono-data text-sm text-black/60">
        No se pudo cargar este bloque. Vuelve a cargar la página en unos minutos.
      </p>
    </div>
  );
}

