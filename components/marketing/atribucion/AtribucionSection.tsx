import { Suspense } from "react";
import {
  getAtribucionCompras,
  getContenidosQueVenden,
  getRendimientoConjuntos,
  type Scope,
} from "@/lib/queries/marketing";
import {
  pct,
  ventanaMedida,
  type ContenidosQueVenden,
  type Moneda,
  type RendimientoConjuntos,
  type VentanaMedida,
} from "@/lib/marketing/atribucion";
import AtribucionVista, { AtribucionMarco, BloqueCargando, BloqueError } from "./AtribucionVista";
import ContenidosTable from "./ContenidosTable";
import ConjuntosMetaTable from "./ConjuntosMetaTable";

export { ANCLA_ATRIBUCION } from "./AtribucionVista";

type Props = {
  eventoId: string;
  country: Scope["country"];
};

/**
 * Sección "Atribución de compras" de Venta Diaria. Usa SOLO la ventana en que
 * GA4 mide compras con número de orden (D6), no la ventana de venta del resto de
 * la página. Una consulta principal (getAtribucionCompras, compartida por
 * React.cache con el panel Paid Media y el Funnel) alimenta las lentes, el
 * origen real, la salud y el gráfico por día; "Qué contenido vende" y
 * "Rendimiento por conjunto" traen su propia consulta y llegan en streaming.
 * Un error de BigQuery deja un mensaje en la sección, no tumba la página.
 */
export default async function AtribucionSection({ eventoId, country }: Props) {
  // Dos argumentos exactos: un tercero crearía otra entrada de React.cache.
  const a = await getAtribucionCompras(eventoId, country).catch((err: unknown) => {
    console.error(`[atribucion] getAtribucionCompras(${eventoId})`, err);
    return null;
  });

  if (!a) {
    return (
      <AtribucionMarco>
        <p className="font-mono-data text-sm text-black/60">
          No se pudo cargar la atribución de compras. Vuelve a cargar la página en unos minutos.
        </p>
      </AtribucionMarco>
    );
  }

  const ventana = ventanaMedida(a);
  const cobertura = pct(a.ordenes.vistas, a.ordenes.medibles);
  return (
    <AtribucionVista
      a={a}
      eventoId={eventoId}
      contenidos={
        ventana && (
          <Suspense fallback={<BloqueCargando titulo="Qué contenido vende" />}>
            <ContenidosSlot eventoId={eventoId} country={country} ventana={ventana} moneda={a.moneda} />
          </Suspense>
        )
      }
      conjuntos={
        ventana && (
          <Suspense fallback={<BloqueCargando titulo="Rendimiento por conjunto (Meta)" />}>
            <ConjuntosSlot eventoId={eventoId} country={country} ventana={ventana} cobertura={cobertura} />
          </Suspense>
        )
      }
    />
  );
}

type SlotProps = { eventoId: string; country: Scope["country"]; ventana: VentanaMedida };

async function ContenidosSlot({ eventoId, country, ventana, moneda }: SlotProps & { moneda: Moneda }) {
  const data: ContenidosQueVenden | null = await getContenidosQueVenden(eventoId, country, ventana).catch(
    (err: unknown) => {
      console.error(`[atribucion] getContenidosQueVenden(${eventoId})`, err);
      return null;
    },
  );
  if (!data) return <BloqueError titulo="Qué contenido vende" />;
  return (
    <ContenidosTable data={data} moneda={moneda} desde={ventana.desde} hasta={ventana.hasta} eventoId={eventoId} />
  );
}

async function ConjuntosSlot({ eventoId, country, ventana, cobertura }: SlotProps & { cobertura: number | null }) {
  const data: RendimientoConjuntos | null = await getRendimientoConjuntos(eventoId, country, ventana).catch(
    (err: unknown) => {
      console.error(`[atribucion] getRendimientoConjuntos(${eventoId})`, err);
      return null;
    },
  );
  if (!data) return <BloqueError titulo="Rendimiento por conjunto (Meta)" />;
  return (
    <ConjuntosMetaTable
      data={data}
      coberturaPct={cobertura}
      desde={ventana.desde}
      hasta={ventana.hasta}
      eventoId={eventoId}
    />
  );
}
