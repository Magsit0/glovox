"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "@/lib/use-router";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CampanaReciente,
  CarddaConsumoRow,
  CarddaFeeRow,
  DayCell,
  GcpSemanaRow,
  EventoGridRow,
  NoAtribuidoRow,
  PlanDiarioRow,
  SinEventoCampanaDia,
} from "@/lib/queries/inversion-medios";
import type { CargoExtra } from "@/db/schema";
import {
  cobrosPorDia,
  costoMensual,
  costoSemanal,
  METODO_LABEL,
  METODOS_CARGO,
  resumenCargos,
  type MetodoCargo,
} from "@/lib/inversion-medios/cargos";
import {
  buildFacturacion,
  CANAL_FACT_LABEL,
  CANALES_FACT,
  fmtPeriodo,
  resumenFacturacion,
  type CanalFact,
  type FacturacionMes,
} from "@/lib/inversion-medios/facturacion";
import { esDiaEvento, tituloDiaEvento } from "@/lib/inversion-medios/evento";
import {
  campanaKey,
  describirRegla,
  DND_CAMPANA,
  limpiarNombreIniciativa,
  NOMBRE_INICIATIVA_MAX,
  NOMBRE_INICIATIVA_MIN,
  type CampanaArrastrada,
  type Iniciativa,
} from "@/lib/inversion-medios/iniciativas";
import { COL_CALENDARIO } from "@/lib/inversion-medios/col-nombre";
import { ordenarPorRecencia } from "@/lib/inversion-medios/orden-campanas";
import { nivelPayday, PAYDAY_HEAD, paydayCell, tituloPayday } from "@/lib/inversion-medios/payday";
import {
  archivarIniciativaAction,
  asignarCampanaAction,
  crearIniciativaAction,
  planFuturoIniciativaAction,
  deleteCargoAction,
  desasignarCampanaAction,
  renombrarIniciativaAction,
  upsertCargoAction,
} from "../actions";
import { fmtDiaCorto, fmtUsd } from "./format";
import SubtotalRango from "./SubtotalRango";
import CampanasActivas from "./CampanasActivas";
import GastoGcp from "./GastoGcp";
import { BordeAncho, BotonAncho, CONTENEDOR_NOMBRE, topeAncho, useAnchoColumna, W_NOMBRE } from "./AnchoColumna";

type Props = {
  desde: string; // YYYY-MM-DD, inicio del rango cargado
  hasta: string; // YYYY-MM-DD, fin del rango cargado
  grid: EventoGridRow[];
  /** Totales del evento COMPLETO (histórico), no solo del rango cargado. */
  totales: Record<string, { totalPlan: number; totalReal: number }>;
  /** Gasto diario por campaña SIN evento. El cliente lo reparte entre las
   *  iniciativas (campañas asignadas) y "No atribuido" (el resto). */
  sinEvento: SinEventoCampanaDia[];
  /** Iniciativas (Club Glovox, Now Mag…) con sus campañas asignadas. */
  iniciativas: Iniciativa[];
  /** Plan diario de las iniciativas en el rango cargado. */
  planIniciativas: PlanDiarioRow[];
  /** Totales históricos por iniciativa (su techo es `totalPlan`). */
  totalesIniciativas: Record<string, { totalPlan: number; totalReal: number }>;
  /** Campañas con gasto en los últimos 7 días del mart ("Campañas activas"). */
  campanasRecientes: CampanaReciente[];
  realMaxFecha: string;
  hoy: string;
  cargos: CargoExtra[];
  /** Consumo real de las tarjetas Cardda por mes×canal (facturación histórica). */
  carddaConsumo: CarddaConsumoRow[];
  /** Consumo Cardda por SEMANA (lunes ISO)×canal — granularidad fina del bloque. */
  carddaConsumoSem: CarddaConsumoRow[];
  /** Fee mensual de Cardda por período. */
  carddaFee: CarddaFeeRow[];
  /** Gasto Google Cloud por semana×servicio; `null` = la vista no se pudo leer. */
  gcpSemanal: GcpSemanaRow[] | null;
  /** Habilita editar los cargos extra. Va con el grant del dashboard, no con el rol. */
  canEdit: boolean;
  /** País inicial del filtro (`?pais=CL|PE`); "" = todos. */
  paisInicial: string;
  /** Toggle inicial "sumar cargos extra" (`?cargos=1`). */
  cargosInicial: boolean;
  /** Ancho guardado de la columna de nombres (cookie leída por la page): el
   *  primer render ya sale con él, sin salto al hidratar. */
  anchoNombreInicial: number;
};

// Geometría de la grilla (box-border: el ancho incluye el borde). Las columnas
// de día son fijas; la de nombres (eventos, iniciativas, campañas) es ajustable.
const COL_W = 64; // w-16

// La columna de nombres (eventos, iniciativas, campañas) es AJUSTABLE: ver
// ./AnchoColumna.tsx (`useAnchoColumna`, `W_NOMBRE`, `--col-nombre`).

// Máximo de sub-filas individuales al desplegar "No atribuido" (el resto se
// agrega en una fila "otras N campañas" para no inflar el DOM).
const NA_MAX_FILAS = 20;

const PAIS_LABEL: Record<string, string> = { CL: "Chile", PE: "Perú" };
// Arreglo vacío ESTABLE: con un país elegido el gasto sin evento (no atribuido
// e iniciativas) se vacía, y un `[]` literal nuevo en cada render rompería los
// useMemo que dependen de él.
const SIN_SIN_EVENTO: SinEventoCampanaDia[] = [];

/** Agregado diario de gasto sin evento (fila No atribuido o de iniciativa). */
function naVacio(fecha: string): NoAtribuidoRow & { fxImputado: boolean } {
  return { fecha, gastoUsd: 0, metaUsd: 0, googleUsd: 0, tiktokUsd: 0, otrasUsd: 0, filasSinFx: 0, fxImputado: false };
}

/** Campaña sin evento con su serie del rango cargado (sub-filas). */
type CampanaSinEvento = {
  key: string;
  plataforma: string;
  campaignId: string;
  nombre: string;
  /** Cuenta publicitaria ("" si no se conoce: asignada sin gasto en el rango). */
  cuenta: string;
  dias: number[];
  total: number;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

/** Lee la campaña arrastrada del DataTransfer (null si lo soltado no es una campaña). */
function leerArrastre(dt: DataTransfer): CampanaArrastrada | null {
  const raw = dt.getData(DND_CAMPANA);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<CampanaArrastrada>;
    if (typeof c.plataforma !== "string" || typeof c.campaignId !== "string") return null;
    return {
      plataforma: c.plataforma,
      campaignId: c.campaignId,
      campaignName: typeof c.campaignName === "string" ? c.campaignName : "",
      desde: typeof c.desde === "string" ? c.desde : null,
      porRegla: c.porRegla === true,
    };
  } catch {
    return null;
  }
}

// Valor del <select> "Mover a…" que devuelve la campaña a No atribuido.
const NA_VALOR = "__no_atribuido__";

/**
 * Las primeras `n` campañas (ya ordenadas) como sub-filas individuales y el
 * resto sumado en una fila "otras N", para que el DOM no crezca con cientos de
 * campañas × ~200 columnas. La partición top + otras cierra siempre por día.
 */
function topYResto<T extends CampanaSinEvento>(all: T[], n: number, nDias: number) {
  const top = all.slice(0, n);
  let resto: { nombre: string; dias: number[]; total: number; ocultas: number } | null = null;
  if (all.length > n) {
    const diasResto = new Array<number>(nDias).fill(0);
    let total = 0;
    for (const c of all.slice(n)) {
      c.dias.forEach((v, i) => (diasResto[i] += v));
      total += c.total;
    }
    resto = { nombre: `otras ${all.length - n} campañas`, dias: diasResto, total, ocultas: all.length - n };
  }
  return { top, resto, totalCampanas: all.length };
}

/** Cambia un parámetro de la URL sin ir al servidor (filtros de cliente, compartibles). */
function setQueryParam(name: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(name, value);
  else params.delete(name);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function shiftMes(iso: string, delta: number, edge: "inicio" | "fin"): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ym = d.toISOString().slice(0, 7);
  if (edge === "inicio") return `${ym}-01`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

export default function InversionMediosPanel({
  desde,
  hasta,
  grid,
  totales,
  sinEvento,
  iniciativas,
  planIniciativas,
  totalesIniciativas,
  campanasRecientes,
  realMaxFecha,
  hoy,
  cargos,
  carddaConsumo,
  carddaConsumoSem,
  carddaFee,
  gcpSemanal,
  canEdit,
  paisInicial,
  cargosInicial,
  anchoNombreInicial,
}: Props) {
  const router = useRouter();
  // Filtro de país (categoriaEvento.Pais). El gasto "no atribuido" no tiene
  // evento y por lo tanto tampoco país: con un país elegido sale de la grilla y
  // de los totales, para que lo que se ve sea SOLO de ese país.
  const [pais, setPais] = useState(paisInicial);
  const paises = useMemo(
    () =>
      Array.from(new Set(grid.map((r) => r.pais).filter(Boolean))).sort(
        (a, b) => (a === "CL" ? -1 : b === "CL" ? 1 : a.localeCompare(b)),
      ),
    [grid],
  );
  const elegirPais = useCallback((p: string) => {
    setPais(p);
    // Solo la URL (compartible) — sin ida al servidor: el filtro es de cliente.
    setQueryParam("pais", p || null);
  }, []);
  // Toggle "sumar cargos extra" al total diario y semanal (`?cargos=1`). Los
  // cargos son de compañía, sin país: con un país elegido no se suman.
  const [conCargos, setConCargos] = useState(cargosInicial);
  const elegirCargos = useCallback((v: boolean) => {
    setConCargos(v);
    setQueryParam("cargos", v ? "1" : null);
  }, []);
  const sumarCargos = conCargos && !pais;
  const qsExtra = `${pais ? `&pais=${pais}` : ""}${conCargos ? "&cargos=1" : ""}`;
  // Con un país elegido sale todo el gasto sin evento: no tiene país (ni el no
  // atribuido ni las iniciativas, que se arman con él).
  const sinEventoVis = pais ? SIN_SIN_EVENTO : sinEvento;
  // Resumen superior: KPIs globales o desglose por canal (mismo tramo visible).
  const [modo, setModo] = useState<"resumen" | "canal">("resumen");
  // Listado de campañas "no atribuido" (desplegable desde su fila). naShown =
  // cuántas van como fila individual; el resto vive agregado en "otras N" y se
  // libera por tandas con "mostrar 20 más" (control del tamaño del DOM).
  const [naOpen, setNaOpen] = useState(false);
  const [naShown, setNaShown] = useState(NA_MAX_FILAS);

  const dias = useMemo(() => {
    const out: string[] = [];
    const d = new Date(`${desde}T00:00:00Z`);
    const end = new Date(`${hasta}T00:00:00Z`);
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }, [desde, hasta]);

  // Los eventos vienen de la tabla madre categoriaEvento (vía mergeGrid): filas
  // ordenadas por fecha del evento. No hay alta manual.
  const rows = useMemo<EventoGridRow[]>(
    () =>
      grid
        .filter((r) => !pais || r.pais === pais)
        .sort(
          (a, b) =>
            a.ordenFecha.localeCompare(b.ordenFecha) || a.eventoId.localeCompare(b.eventoId),
        ),
    [grid, pais],
  );

  // Índices con datos por fila (para la visibilidad según viewport).
  const dataIdx = useMemo(
    () => rows.map((r) => r.days.map((d) => d.plan != null || d.real != null)),
    [rows],
  );

  const fechaIdx = useMemo(() => new Map(dias.map((f, i) => [f, i])), [dias]);

  // ---------- Iniciativas: asignación de campañas (optimista) ----------
  // Lo que dice el servidor y, encima, lo que se acaba de arrastrar mientras la
  // action viaja: la campaña cambia de fila al instante, y al volver la página
  // revalidada el estado optimista se descarta solo.
  const asignServidor = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of iniciativas) {
      for (const c of i.campanas) m.set(campanaKey(c.plataforma, c.campaignId), i.id);
    }
    return m;
  }, [iniciativas]);
  // Reglas automáticas. `reglaDe`: campañas que CALZAN con una regla (la tenga
  // ella o estén asignadas a mano a otra iniciativa): se mueven entre
  // iniciativas, nunca a "No atribuido" — la regla las recapturaría. `deRegla`:
  // las que hoy son de la regla (pill «regla»).
  const { reglaDe, deRegla } = useMemo(() => {
    const reglaDe = new Map<string, string>();
    const deRegla = new Set<string>();
    for (const i of iniciativas) {
      for (const c of i.campanas) {
        const key = campanaKey(c.plataforma, c.campaignId);
        if (c.porRegla) {
          deRegla.add(key);
          reglaDe.set(key, c.iniciativaId);
        } else if (c.reglaIni) reglaDe.set(key, c.reglaIni);
      }
    }
    return { reglaDe, deRegla };
  }, [iniciativas]);
  const [asign, moverOptimista] = useOptimistic(
    asignServidor,
    (m: Map<string, string>, mov: { key: string; a: string | null }) => {
      const n = new Map(m);
      if (mov.a) n.set(mov.key, mov.a);
      else n.delete(mov.key);
      return n;
    },
  );
  const [, startMover] = useTransition();
  const [errorMover, setErrorMover] = useState<string | null>(null);
  // Campaña que se está arrastrando: las filas que la aceptan se marcan.
  const [arrastrando, setArrastrando] = useState<CampanaArrastrada | null>(null);
  // La fila "No atribuido" como destino (devolver una campaña de una iniciativa).
  const [naEncima, setNaEncima] = useState(false);
  const [iniOpen, setIniOpen] = useState<Set<string>>(() => new Set());
  const toggleIni = useCallback(
    (id: string) =>
      setIniOpen((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  /** Mueve una campaña a una iniciativa (`a`) o de vuelta a No atribuido (null). */
  const mover = useCallback(
    (c: CampanaArrastrada, a: string | null) => {
      setArrastrando(null);
      if (c.desde === a) return;
      setErrorMover(null);
      // Abre la iniciativa de destino: que se vea dónde quedó la campaña.
      if (a) setIniOpen((s) => (s.has(a) ? s : new Set(s).add(a)));
      startMover(async () => {
        moverOptimista({ key: campanaKey(c.plataforma, c.campaignId), a });
        const res = a
          ? await asignarCampanaAction({
              plataforma: c.plataforma,
              campaignId: c.campaignId,
              campaignName: c.campaignName,
              iniciativaId: a,
            })
          : await desasignarCampanaAction({ plataforma: c.plataforma, campaignId: c.campaignId });
        if (!res.ok) setErrorMover(res.error);
      });
    },
    [moverOptimista],
  );
  // Destinos del arrastre / "Mover a…": solo las ACTIVAS (una archivada no
  // recibe campañas). Para nombrar grupos (Campañas activas) van todas.
  const destinos = useMemo(
    () => iniciativas.filter((i) => i.activa).map((i) => ({ id: i.id, nombre: i.nombre })),
    [iniciativas],
  );
  const nombresIniciativas = useMemo(
    () => iniciativas.map((i) => ({ id: i.id, nombre: i.nombre })),
    [iniciativas],
  );
  const iniActiva = useMemo(() => new Map(iniciativas.map((i) => [i.id, i.activa])), [iniciativas]);
  const reglasIni = useMemo(
    () =>
      new Map(
        iniciativas
          .filter((i) => i.reglas.length > 0)
          .map((i) => [i.id, i.reglas.map(describirRegla)]),
      ),
    [iniciativas],
  );
  const nArchivadas = iniciativas.length - destinos.length;
  // "ver archivadas": muestra TODAS las archivadas, tengan o no datos en el
  // tramo — sin esto, una archivada sin gasto quedaba invisible y no había cómo
  // reactivarla (y el aviso de nombre repetido pedía justo eso).
  const [verArchivadas, setVerArchivadas] = useState(false);

  // ---------- Reparto del gasto sin evento ----------
  // Cada campaña sin evento va a su iniciativa si está asignada, o a "No
  // atribuido" si no: las dos partes suman siempre el total sin evento.
  const reparto = useMemo(() => {
    type Agg = NoAtribuidoRow & { fxImputado: boolean };
    const na = new Map<string, Agg>();
    const ini = new Map<string, Map<string, Agg>>();
    const camps = new Map<string, CampanaSinEvento & { ultima: string }>();
    for (const r of sinEventoVis) {
      const col = fechaIdx.get(r.fecha);
      if (col === undefined) continue;
      const key = campanaKey(r.plataforma, r.campaignId);
      const iniId = asign.get(key);
      let porFecha = na;
      if (iniId) {
        if (!ini.has(iniId)) ini.set(iniId, new Map());
        porFecha = ini.get(iniId)!;
      }
      let d = porFecha.get(r.fecha);
      if (!d) {
        d = naVacio(r.fecha);
        porFecha.set(r.fecha, d);
      }
      d.gastoUsd += r.gastoUsd;
      if (r.plataforma === "meta") d.metaUsd += r.gastoUsd;
      else if (r.plataforma === "google") d.googleUsd += r.gastoUsd;
      else if (r.plataforma === "tiktok") d.tiktokUsd += r.gastoUsd;
      else d.otrasUsd += r.gastoUsd;
      d.filasSinFx += r.filasSinFx;
      d.fxImputado ||= r.fxImputado;
      let c = camps.get(key);
      if (!c) {
        c = {
          key,
          plataforma: r.plataforma,
          campaignId: r.campaignId,
          nombre: r.campaignName,
          cuenta: r.cuenta,
          dias: new Array<number>(dias.length).fill(0),
          total: 0,
          ultima: "",
        };
        camps.set(key, c);
      }
      c.dias[col] += r.gastoUsd;
      c.total += r.gastoUsd;
      // El nombre vigente es el del último día con gasto (las campañas se renombran).
      if (r.fecha >= c.ultima) {
        c.ultima = r.fecha;
        c.nombre = r.campaignName;
        if (r.cuenta) c.cuenta = r.cuenta;
      }
    }
    return { na, ini, camps };
  }, [sinEventoVis, fechaIdx, asign, dias]);
  const noAtribuidoByFecha = reparto.na;

  // Etiqueta del período CARGADO del calendario (desde–hasta) para los totales
  // de las sub-filas — "en el rango" a secas resultaba ambiguo.
  const rangoCargadoLabel = `${fmtDiaCorto(desde)} – ${fmtDiaCorto(hasta)}`;
  const verMasNa = useCallback(() => setNaShown((n) => n + NA_MAX_FILAS), []);

  // Campañas de "No atribuido" (sin orden: el orden depende del tramo mirado y
  // se aplica más abajo, en `naCamps`). `arrastre` va armado acá, en un memo que
  // NO depende del scroll, para que cada objeto sea el mismo al scrollear y
  // NaCampRow siga memoizada.
  const naBase = useMemo(
    () =>
      [...reparto.camps.values()]
        .filter((c) => !asign.has(c.key) && c.total > 0)
        .map((c) => ({
          ...c,
          arrastre: {
            plataforma: c.plataforma,
            campaignId: c.campaignId,
            campaignName: c.nombre,
            desde: null,
          } satisfies CampanaArrastrada,
        })),
    [reparto, asign],
  );

  // Campañas de cada iniciativa: las que tienen gasto en el rango cargado y,
  // además, las asignadas SIN gasto en él (igual se listan, para poder
  // quitarlas o moverlas).
  const iniCamps = useMemo(() => {
    type Fila = CampanaSinEvento & { arrastre: CampanaArrastrada; deRegla: boolean };
    const out = new Map<string, Fila[]>(iniciativas.map((i) => [i.id, []]));
    const vistos = new Set<string>();
    const push = (iniId: string, c: CampanaSinEvento) => {
      out.get(iniId)?.push({
        ...c,
        deRegla: deRegla.has(c.key),
        arrastre: {
          plataforma: c.plataforma,
          campaignId: c.campaignId,
          campaignName: c.nombre,
          desde: iniId,
          porRegla: reglaDe.has(c.key),
        },
      });
      vistos.add(c.key);
    };
    for (const c of reparto.camps.values()) {
      const iniId = asign.get(c.key);
      if (iniId) push(iniId, c);
    }
    for (const i of iniciativas) {
      for (const c of i.campanas) {
        // Las de una regla sin gasto en el rango NO se listan: son cientos (todos
        // los boosts históricos) y no hay nada que hacer con ellas acá — para
        // soltarlas se cambia la regla.
        if (c.porRegla) continue;
        const key = campanaKey(c.plataforma, c.campaignId);
        const iniId = asign.get(key);
        if (!iniId || vistos.has(key)) continue;
        push(iniId, {
          key,
          plataforma: c.plataforma,
          campaignId: c.campaignId,
          nombre: c.campaignName || c.campaignId,
          cuenta: "",
          dias: new Array<number>(dias.length).fill(0),
          total: 0,
        });
      }
    }
    return out;
  }, [reparto, asign, iniciativas, dias, reglaDe, deRegla]);

  // Filas de iniciativa: plan de Neon + real de sus campañas, con la MISMA
  // forma que una fila de evento (reusan la celda del calendario).
  const iniRows = useMemo<EventoGridRow[]>(() => {
    const planTot = new Map<string, number>();
    for (const p of planIniciativas) {
      const k = `${p.eventoId}|${p.fecha}`;
      planTot.set(k, (planTot.get(k) ?? 0) + p.montoUsd);
    }
    return iniciativas.map((i) => {
      const reales = reparto.ini.get(i.id);
      let totalPlan = 0;
      let totalReal = 0;
      const days: DayCell[] = dias.map((fecha) => {
        const pk = `${i.id}|${fecha}`;
        const plan = planTot.has(pk) ? planTot.get(pk)! : null;
        const r = reales?.get(fecha);
        if (plan != null) totalPlan += plan;
        if (r) totalReal += r.gastoUsd;
        return {
          fecha,
          plan,
          planNota: null,
          real: r ? r.gastoUsd : null,
          metaUsd: r?.metaUsd ?? 0,
          googleUsd: r?.googleUsd ?? 0,
          tiktokUsd: r?.tiktokUsd ?? 0,
          otrasUsd: r?.otrasUsd ?? 0,
          fxImputado: r?.fxImputado ?? false,
          sinFx: (r?.filasSinFx ?? 0) > 0,
        };
      });
      return {
        eventoId: i.id,
        nombre: i.nombre,
        fechaEvento: "",
        diasEvento: 1,
        pais: "",
        ordenFecha: "",
        techoUsd: null,
        days,
        totalPlan,
        totalReal,
        pctPlanVsTecho: 0,
        pctRealVsTecho: 0,
      };
    });
  }, [iniciativas, planIniciativas, reparto, dias]);
  // Filas que SUMAN plan y real (KPIs, canal, totales): eventos + iniciativas.
  // Con un país elegido las iniciativas salen, como el no atribuido.
  const rowsTot = useMemo(() => (pais ? rows : [...rows, ...iniRows]), [pais, rows, iniRows]);

  // Cobros de los cargos extra en cada día del rango (solo si se suman).
  const cobros = useMemo(() => cobrosPorDia(cargos, dias), [cargos, dias]);

  // ---------- Viewport: qué tramo del calendario se está mirando ----------
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [view, setView] = useState<{ a: number; b: number }>({ a: 0, b: 30 });

  // Columna de nombres ajustable (arrastre, botón ⇔, teclado; se recuerda en
  // cookie). Ver ./AnchoColumna.tsx.
  const { calRef, ctl: ancho } = useAnchoColumna(COL_CALENDARIO, anchoNombreInicial, scrollRef);

  // Depende del ancho de la columna de nombres: más ancha = menos días a la vista
  // (KPIs y filas visibles se recalculan con el tramo real).
  const medirViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // El tope se calcula con offsetWidth (= `100cqw` del tope en CSS); los días
    // visibles, con el área útil (clientWidth, sin la barra de scroll).
    const nombreW = topeAncho(ancho.anchoGuardado, el.offsetWidth, COL_CALENDARIO);
    const a = Math.max(0, Math.floor(el.scrollLeft / COL_W));
    const visibleCols = Math.max(1, Math.ceil((el.clientWidth - nombreW) / COL_W));
    const b = Math.min(dias.length - 1, a + visibleCols - 1);
    setView((v) => (v.a === a && v.b === b ? v : { a, b }));
  }, [dias.length, ancho.anchoGuardado]);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(medirViewport);
  }, [medirViewport]);

  const irA = useCallback(
    (fecha: string, smooth = true) => {
      const el = scrollRef.current;
      const idx = dias.indexOf(fecha);
      if (!el || idx < 0) return;
      el.scrollTo({
        left: Math.max(0, idx * COL_W - COL_W * 2),
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [dias],
  );

  // Al montar: arrancar mirando hoy. Al EXTENDER el rango, mostrar el mes que
  // se acaba de cargar (no volver a hoy — eso haría inalcanzable lo cargado).
  const rangoPrevio = useRef<{ desde: string; hasta: string } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const prev = rangoPrevio.current;
    rangoPrevio.current = { desde, hasta };
    if (prev === null) {
      irA(hoy, false); // primer montaje
    } else if (el && prev.desde !== desde) {
      el.scrollTo({ left: 0, behavior: "auto" }); // se prependió un mes: mostrarlo
    } else if (el && prev.hasta !== hasta) {
      el.scrollTo({ left: el.scrollWidth, behavior: "auto" }); // se apendió: mostrarlo
    }
    medirViewport();
  }, [desde, hasta, irA, medirViewport, hoy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(medirViewport);
    obs.observe(el);
    return () => obs.disconnect();
  }, [medirViewport]);

  // ---------- Filas visibles: con plan o gasto en el tramo mirado ----------
  // Las filas NO se desmontan (se ocultan por CSS): desmontar descartaría una
  // edición en curso si su fila sale del tramo mientras se escribe.
  // Un evento cuya fecha aún NO pasó al inicio del tramo se muestra SIEMPRE,
  // tenga o no datos: su plan $0 es la alerta de que falta cargar presupuesto.
  // ---------- Orden de las sub-filas de campaña: RECENCIA en el tramo ----------
  // Primero las que gastaron en el tramo mirado, de la más reciente a la menos
  // (ver lib/inversion-medios/orden-campanas.ts). Antes era el gasto total del
  // período cargado, y las que explicaban el gasto de ayer quedaban enterradas
  // en "otras N". Sub-filas de "No atribuido": las primeras `naShown`
  // individuales + una fila agregada "otras N" (control del DOM: 187 campañas ×
  // ~200 columnas serían ~40k celdas); la partición top+otras == fila NA cierra
  // siempre. Con ≤ naShown campañas con gasto en el tramo, "otras" ya no
  // esconde ninguna que se vea en pantalla.
  const naCamps = useMemo(
    () => topYResto(ordenarPorRecencia(naBase, view.a, view.b), naShown, dias.length),
    [naBase, view.a, view.b, naShown, dias.length],
  );
  // Igual en cada iniciativa: con una regla puede tener cientos de campañas en
  // el rango cargado (los boosts de Instagram de FER Y CAMI), así que también
  // van por tandas con su "mostrar 20 más".
  const [iniShown, setIniShown] = useState<Map<string, number>>(() => new Map());
  const verMasIni = useCallback(
    (id: string) => setIniShown((m) => new Map(m).set(id, (m.get(id) ?? NA_MAX_FILAS) + NA_MAX_FILAS)),
    [],
  );
  const iniCampsOrden = useMemo(
    () =>
      new Map(
        [...iniCamps].map(([id, l]) => [
          id,
          topYResto(ordenarPorRecencia(l, view.a, view.b), iniShown.get(id) ?? NA_MAX_FILAS, dias.length),
        ]),
      ),
    [iniCamps, view.a, view.b, iniShown, dias.length],
  );

  const visibleIds = useMemo(() => {
    const out = new Set<string>();
    const inicioTramo = dias[view.a] ?? "";
    rows.forEach((r, i) => {
      if (r.fechaEvento && r.fechaEvento >= inicioTramo) {
        out.add(r.eventoId);
        return;
      }
      const flags = dataIdx[i];
      for (let j = view.a; j <= view.b && j < flags.length; j++) {
        if (flags[j]) {
          out.add(r.eventoId);
          return;
        }
      }
    });
    return out;
  }, [rows, dataIdx, view, dias]);

  // ---------- KPIs del tramo visible ----------
  const kpis = useMemo(() => {
    let plan = 0;
    let real = 0;
    let na = 0;
    for (const r of rowsTot) {
      for (let j = view.a; j <= view.b && j < r.days.length; j++) {
        const c = r.days[j];
        if (c.plan != null) plan += c.plan;
        if (c.real != null) real += c.real;
      }
    }
    for (let j = view.a; j <= view.b && j < dias.length; j++) {
      na += noAtribuidoByFecha.get(dias[j])?.gastoUsd ?? 0;
    }
    return { plan, real, na };
  }, [rowsTot, view, dias, noAtribuidoByFecha]);

  // ---------- Desglose por canal del tramo visible ----------
  // El gasto real trae split por plataforma en cada celda (y en no-atribuido);
  // el presupuesto es un monto diario TOTAL (la hoja nunca tuvo canal), así que
  // el plan se muestra como total y el real se abre por plataforma.
  const canal = useMemo(() => {
    let meta = 0;
    let google = 0;
    let tiktok = 0;
    let otras = 0;
    let plan = 0;
    for (const r of rowsTot) {
      for (let j = view.a; j <= view.b && j < r.days.length; j++) {
        const c = r.days[j];
        meta += c.metaUsd;
        google += c.googleUsd;
        tiktok += c.tiktokUsd;
        otras += c.otrasUsd;
        if (c.plan != null) plan += c.plan;
      }
    }
    // El gasto no atribuido igual ocurrió en alguna plataforma → suma al canal.
    for (let j = view.a; j <= view.b && j < dias.length; j++) {
      const na = noAtribuidoByFecha.get(dias[j]);
      if (na) {
        meta += na.metaUsd;
        google += na.googleUsd;
        tiktok += na.tiktokUsd;
        otras += na.otrasUsd;
      }
    }
    // real incluye "otras" → reconcilia con kpis.real (gasto_usd total).
    return { meta, google, tiktok, otras, plan, real: meta + google + tiktok + otras };
  }, [rowsTot, view, dias, noAtribuidoByFecha]);

  // Totales por día (columna) — sobre todas las filas cargadas: eventos +
  // iniciativas y, con el toggle, los cargos extra en su día de pago. Un cargo
  // se presupuesta ese día y se da por cobrado ese mismo día (suma al real
  // cuando el día ya tiene dato).
  const totalesDia = useMemo(
    () =>
      dias.map((fecha, i) => {
        let plan = 0;
        let real = 0;
        let conDatos = false;
        for (const ev of rowsTot) {
          const c = ev.days[i];
          if (c.plan != null) plan += c.plan;
          if (c.real != null) real += c.real;
          if (c.plan != null || c.real != null) conDatos = true;
        }
        const cargosDia = sumarCargos
          ? (cobros.porFecha.get(fecha) ?? []).reduce((a, c) => a + c.montoUsd, 0)
          : 0;
        return {
          fecha,
          plan: plan + cargosDia,
          real: real + (fecha <= realMaxFecha ? cargosDia : 0),
          cargos: cargosDia,
          conDatos: conDatos || cargosDia > 0,
        };
      }),
    [rowsTot, dias, sumarCargos, cobros, realMaxFecha],
  );

  // Mismo alcance del subtotal semanal: eventos + iniciativas + gasto no
  // atribuido (+ cargos con el toggle). Independiente del scroll; no modifica
  // los totales de la fila del calendario.
  const totalesDiaOperacion = useMemo(
    () => totalesDia.map((dia) => ({
      ...dia,
      real: dia.real + (noAtribuidoByFecha.get(dia.fecha)?.gastoUsd ?? 0),
      conDatos: dia.conDatos || (noAtribuidoByFecha.get(dia.fecha)?.gastoUsd ?? 0) > 0,
    })),
    [totalesDia, noAtribuidoByFecha],
  );

  const rangoLabel =
    dias.length > 0
      ? `${fmtDiaCorto(dias[Math.min(view.a, dias.length - 1)])} – ${fmtDiaCorto(dias[Math.min(view.b, dias.length - 1)])}`
      : "";

  // Lunes de la semana de HOY, la siguiente y la subsiguiente (hoy ya viene en
  // TZ Santiago). Sus cards se destacan en intensidad decreciente (100/50/25)
  // para ver de un vistazo el gasto planificado que viene.
  const lunesDestacados = useMemo(() => {
    const d = new Date(`${hoy}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const actual = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 7);
    const siguiente = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 7);
    const subsiguiente = d.toISOString().slice(0, 10);
    return { actual, siguiente, subsiguiente };
  }, [hoy]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--ink)]">
            Inversión en medios
          </h1>
          <p className="mt-1 font-sans text-sm text-[var(--ink-muted)]">
            Plan diario de publicidad digital (USD) vs gasto real por evento.
            Muévete libremente por el calendario: aparecen los eventos con presupuesto o
            gasto en el tramo que estás mirando
            {realMaxFecha ? ` · real al ${realMaxFecha}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de país (solo si el rango cargado tiene más de uno) */}
          {paises.length > 1 && (
            <div
              className="flex overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] font-sans text-sm"
              role="group"
              aria-label="Filtrar por país"
            >
              {(["", ...paises] as string[]).map((k) => (
                <button
                  key={k || "todos"}
                  onClick={() => elegirPais(k)}
                  aria-pressed={pais === k}
                  className={`px-3 py-2 transition-colors ${
                    pais === k
                      ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
                  }`}
                >
                  {k ? (PAIS_LABEL[k] ?? k) : "Todos"}
                </button>
              ))}
            </div>
          )}
          {/* Switch resumen ↔ por canal */}
          <div className="flex overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] font-sans text-sm">
            {(
              [
                ["resumen", "Resumen"],
                ["canal", "Por canal"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setModo(k)}
                className={`px-3 py-2 transition-colors ${
                  modo === k
                    ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => irA(hoy)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 font-sans text-sm text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
          >
            <CalendarDays className="h-4 w-4 text-[var(--ink-muted)]" /> Hoy
          </button>
        </div>
      </header>

      {/* Resumen del tramo visible: KPIs globales o desglose por canal */}
      {modo === "resumen" ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Kpi label={`Plan · ${rangoLabel}`} value={fmtUsd(kpis.plan)} />
          <Kpi label={`Real · ${rangoLabel}`} value={fmtUsd(kpis.real)} />
          <Kpi
            label="Varianza (real − plan)"
            value={fmtUsd(kpis.real - kpis.plan)}
            tone={kpis.real > kpis.plan ? "neg" : "pos"}
          />
          <Kpi
            label="No atribuido"
            value={pais ? "—" : fmtUsd(kpis.na)}
            hint={
              pais
                ? "no tiene país: se excluye al filtrar"
                : "gasto sin evento en el tramo visible"
            }
          />
        </div>
      ) : (
        <CanalResumen canal={canal} rangoLabel={rangoLabel} noAtribuido={kpis.na} />
      )}

      {/* Qué campañas están corriendo AHORA (gasto de los 2 últimos días del
          mart). No sigue el tramo del calendario: ancla en la última fecha. */}
      <CampanasActivas
        campanas={campanasRecientes}
        realMaxFecha={realMaxFecha}
        hoy={hoy}
        pais={pais}
        asignaciones={asign}
        iniciativas={nombresIniciativas}
      />

      {errorMover && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 font-sans text-sm text-[var(--ink)]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ED75A0]" />
          No se pudo mover la campaña: {errorMover}
          <button
            onClick={() => setErrorMover(null)}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]"
            aria-label="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}

      {/* Calendario. `isolate`: contiene los sticky internos (z-10/20/30) en su
          propio stacking context para que no pinten sobre la GroupNav (z-30). */}
      <div
        ref={calRef}
        className={`isolate overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] ${CONTENEDOR_NOMBRE}`}
        style={ancho.estiloContenedor}
      >
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[600px] overflow-auto overscroll-x-contain"
        >
          <table className="border-separate border-spacing-0 font-sans text-sm">
            <thead>
              <tr>
                <th
                  aria-label="Evento"
                  className={`sticky left-0 top-0 z-30 ${W_NOMBRE} border-b border-r border-[var(--divider)] bg-[var(--surface-alt)] py-2 pl-4 pr-3 text-left text-xs font-medium text-[var(--ink-muted)]`}
                >
                  {/* El botón va junto al título (a la izquierda): así nunca
                      queda fuera de pantalla, por ancha que sea la columna. */}
                  <span className="flex items-center gap-1.5">
                    Evento
                    <BotonAncho ctl={ancho} />
                  </span>
                  <span className="block font-normal text-[var(--ink-subtle)]">
                    {visibleIds.size} en el tramo visible
                  </span>
                  {/* Borde arrastrable: cambia el ancho de TODA la columna de
                      nombres. Doble clic = ajustar a los nombres visibles. Con
                      puntero grueso (touch) el área crece hacia la derecha, sobre
                      el encabezado del primer día, que no es interactivo. */}
                  <BordeAncho ctl={ancho} />
                </th>
                {dias.map((fecha, i) => {
                  const dia = Number(fecha.slice(8, 10));
                  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
                  const esHoy = fecha === hoy;
                  const primerDia = dia === 1 || i === 0;
                  const payday = nivelPayday(fecha);
                  return (
                    <th
                      key={fecha}
                      title={tituloPayday(fecha)}
                      className={`sticky top-0 z-20 w-16 min-w-16 max-w-16 border-b border-[var(--divider)] px-0 py-1.5 text-center text-xs font-medium ${
                        esHoy
                          ? "bg-[var(--purple-tint)] text-[#9F99F8]"
                          : payday
                            ? PAYDAY_HEAD[payday]
                            : primerDia
                              ? "bg-[var(--surface)] text-[var(--ink)]"
                              : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"
                      } ${primerDia && i > 0 ? "border-l" : ""}`}
                    >
                      <span className="block text-[10px] font-normal uppercase text-[var(--ink-subtle)]">
                        {primerDia
                          ? `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(2, 4)}`
                          : DIAS_SEMANA[dow]}
                      </span>
                      {dia}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <FilaEvento
                  key={ev.eventoId}
                  ev={ev}
                  totales={totales[ev.eventoId]}
                  hoy={hoy}
                  realMaxFecha={realMaxFecha}
                  hidden={!visibleIds.has(ev.eventoId)}
                />
              ))}
              {visibleIds.size === 0 && (
                <tr>
                  <td className="sticky left-0 z-10 border-t border-r border-[var(--divider)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--ink-subtle)]">
                    Sin eventos con presupuesto o gasto en este tramo
                  </td>
                  <td colSpan={dias.length} className="border-t border-[var(--divider)]" />
                </tr>
              )}
              {/* ── INICIATIVAS: frentes sin fecha de evento (Club Glovox, Now
                  Mag…), debajo de los eventos y arriba de "No atribuido", de
                  donde se les arrastran campañas. Sin país: se ocultan al
                  filtrar, igual que el no atribuido del que salen. */}
              {!pais && (
                <>
                  <tr>
                    <td className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-1.5 align-top`}>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        Iniciativas
                      </span>
                      <p className="text-[11px] leading-snug text-[var(--ink-subtle)]">
                        sin fecha de evento · arrastra campañas desde No atribuido
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3">
                        {canEdit && <NuevaIniciativa />}
                        {nArchivadas > 0 && (
                          <button
                            type="button"
                            onClick={() => setVerArchivadas((v) => !v)}
                            aria-pressed={verArchivadas}
                            className="mt-1 text-xs text-[var(--ink-muted)] underline-offset-2 transition-colors hover:text-[var(--ink)] hover:underline"
                          >
                            {verArchivadas ? "ocultar archivadas" : `ver archivadas (${nArchivadas})`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td colSpan={dias.length} className="border-t border-[var(--divider)] bg-[var(--surface-alt)]" />
                  </tr>
                  {iniRows.map((r) => {
                    const camps = iniCampsOrden.get(r.eventoId) ?? { top: [], resto: null, totalCampanas: 0 };
                    const abierta = iniOpen.has(r.eventoId);
                    const activa = iniActiva.get(r.eventoId) ?? true;
                    // Archivada: su fila aparece solo si tiene plan o gasto en el
                    // tramo mirado (como un evento pasado). Oculta por CSS, no
                    // desmontada (misma mecánica que las filas de evento).
                    const oculta =
                      !activa &&
                      !verArchivadas &&
                      !r.days.slice(view.a, view.b + 1).some((d) => d.plan != null || d.real != null);
                    return (
                      <Fragment key={r.eventoId}>
                        <FilaIniciativa
                          activa={activa}
                          hidden={oculta}
                          canEdit={canEdit}
                          fila={r}
                          totales={totalesIniciativas[r.eventoId]}
                          nCampanas={camps.totalCampanas}
                          reglas={reglasIni.get(r.eventoId)}
                          abierta={abierta}
                          onToggle={toggleIni}
                          arrastrando={arrastrando}
                          onSoltar={mover}
                          hoy={hoy}
                          realMaxFecha={realMaxFecha}
                        />
                        {abierta &&
                          !oculta &&
                          camps.top.map((c) => (
                            <NaCampRow
                              key={c.key}
                              nombre={c.nombre}
                              cuenta={c.cuenta}
                              deRegla={c.deRegla}
                              dot={PLAT_DOT[c.plataforma] ?? "#B4B2A9"}
                              dotTitle={PLAT_LABEL[c.plataforma] ?? c.plataforma}
                              diasVals={c.dias}
                              fechas={dias}
                              total={c.total}
                              rango={rangoCargadoLabel}
                              hidden={false}
                              // Archivada: sus campañas quedan congeladas (sacarlas
                              // reescribiría su historial); el servidor también lo rechaza.
                              arrastre={activa ? c.arrastre : undefined}
                              destinos={activa ? destinos : undefined}
                              onMover={activa ? mover : undefined}
                              onArrastrar={setArrastrando}
                            />
                          ))}
                        {abierta && !oculta && camps.resto && (
                          <NaCampRow
                            nombre={camps.resto.nombre}
                            dot="#B4B2A9"
                            dotTitle="Varias campañas"
                            diasVals={camps.resto.dias}
                            fechas={dias}
                            total={camps.resto.total}
                            rango={rangoCargadoLabel}
                            hidden={false}
                            onVerMas={() => verMasIni(r.eventoId)}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </>
              )}
              {/* Fila NO ATRIBUIDO: el gasto sin evento nunca desaparece… salvo
                  con un país elegido, porque no tiene país. También es zona para
                  soltar: una campaña de una iniciativa arrastrada acá vuelve a
                  "No atribuido". */}
              <tr
                className={pais ? "hidden" : "bg-[var(--surface-alt)]"}
                onDragOver={(e) => {
                  // Una campaña de una REGLA no vuelve acá: la regla la recapturaría.
                  if (!arrastrando?.desde || arrastrando.porRegla || !e.dataTransfer.types.includes(DND_CAMPANA)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (!naEncima) setNaEncima(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setNaEncima(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setNaEncima(false);
                  const c = leerArrastre(e.dataTransfer);
                  if (c) mover(c, null);
                }}
              >
                <td
                  className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--divider)] px-4 py-2 ${
                    naEncima
                      ? "bg-[var(--purple-tint)] ring-2 ring-inset ring-[#9F99F8]"
                      : arrastrando?.desde && !arrastrando.porRegla
                        ? "bg-[var(--surface-alt)] outline-dashed outline-1 -outline-offset-4 outline-[#9F99F8]"
                        : "bg-[var(--surface-alt)]"
                  }`}
                >
                  <span className="font-medium text-[var(--ink-muted)]">No atribuido</span>
                  <p className="text-xs text-[var(--ink-subtle)]">
                    {arrastrando?.desde && !arrastrando.porRegla
                      ? "suelta acá para quitarla de la iniciativa"
                      : destinos.length > 0
                        ? "sin evento · arrástralas a una iniciativa"
                        : "campañas sin evento reconocible"}
                  </p>
                  {naCamps.totalCampanas > 0 && (
                    <button
                      onClick={() => setNaOpen((o) => !o)}
                      className="mt-1 inline-flex items-center gap-1 font-sans text-xs font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)]"
                      aria-expanded={naOpen}
                    >
                      {naOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {naOpen ? "ocultar campañas" : `ver campañas (${naCamps.totalCampanas})`}
                    </button>
                  )}
                </td>
                {dias.map((fecha) => {
                  const r = noAtribuidoByFecha.get(fecha);
                  return (
                    <td
                      key={fecha}
                      className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] px-1 py-2 text-center tabular-nums text-xs text-[var(--ink-muted)] ${paydayCell(fecha)}`}
                    >
                      {r && r.gastoUsd > 0 ? fmtUsd(r.gastoUsd, 0) : "·"}
                    </td>
                  );
                })}
              </tr>
              {/* Sub-filas: campañas del grupo "no atribuido", alineadas a los
                  mismos días. Las de mayor gasto individuales + "otras N"
                  agregada. Se ocultan (CSS) si no tienen gasto en el tramo
                  mirado — misma mecánica que las filas de evento. */}
              {naOpen &&
                naCamps.top.map((c) => (
                  <NaCampRow
                    key={c.key}
                    nombre={c.nombre}
                    cuenta={c.cuenta}
                    dot={PLAT_DOT[c.plataforma] ?? "#B4B2A9"}
                    dotTitle={PLAT_LABEL[c.plataforma] ?? c.plataforma}
                    diasVals={c.dias}
                    fechas={dias}
                    total={c.total}
                    rango={rangoCargadoLabel}
                    hidden={!c.dias.slice(view.a, view.b + 1).some((v) => v > 0)}
                    arrastre={destinos.length > 0 ? c.arrastre : undefined}
                    destinos={destinos}
                    onMover={mover}
                    onArrastrar={setArrastrando}
                  />
                ))}
              {naOpen && naCamps.resto && (
                <NaCampRow
                  nombre={naCamps.resto.nombre}
                  dot="#B4B2A9"
                  dotTitle="Varias plataformas"
                  diasVals={naCamps.resto.dias}
                  fechas={dias}
                  total={naCamps.resto.total}
                  rango={rangoCargadoLabel}
                  // La fila agregada SIEMPRE se ve al expandir (aunque no tenga
                  // gasto en el tramo): es donde vive el botón "mostrar más".
                  hidden={false}
                  onVerMas={verMasNa}
                />
              )}
              {/* Cargos extra en su día de pago (toggle del subtotal semanal).
                  Justo arriba del total del día, que los suma. */}
              {sumarCargos && (
                <tr className="bg-[var(--surface-alt)]">
                  <td className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-2`}>
                    <span className="font-medium text-[var(--ink-muted)]">Cargos extra</span>
                    <p className="text-xs text-[var(--ink-subtle)]">en su día de pago (Adobe, DRIP…)</p>
                  </td>
                  {dias.map((fecha) => {
                    const cs = cobros.porFecha.get(fecha) ?? [];
                    const total = cs.reduce((a, c) => a + c.montoUsd, 0);
                    return (
                      <td
                        key={fecha}
                        title={cs.map((c) => `${c.proveedor} ${fmtUsd(c.montoUsd)}`).join(" · ") || undefined}
                        className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] px-1 py-2 text-center tabular-nums text-xs ${paydayCell(fecha)}`}
                      >
                        {total > 0 ? (
                          <>
                            <span className="block font-medium text-[var(--plan)]">{fmtUsd(total, 0)}</span>
                            <span className="block text-[11px] text-[var(--ink)]">
                              {fecha <= realMaxFecha ? fmtUsd(total, 0) : <span className="text-[var(--divider)]">·</span>}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--divider)]">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={`sticky bottom-0 left-0 z-30 ${W_NOMBRE} border-r border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--ink)]`}>
                  Total día (plan / real)
                </td>
                {totalesDia.map((d) => (
                  <td
                    key={d.fecha}
                    className="sticky bottom-0 z-20 w-16 min-w-16 max-w-16 border-t border-[var(--divider)] bg-[var(--surface)] px-1 py-2 text-center tabular-nums text-xs"
                  >
                    <span className="block font-medium text-[var(--plan)]">
                      {d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}
                    </span>
                    <span className="block text-[var(--ink)]">
                      {d.real > 0 ? fmtUsd(d.real, 0) : "·"}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Extender el calendario por los bordes */}
        <div className="flex items-center justify-between border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-2">
          <button
            onClick={() =>
              router.push(
                `/inversion-medios?desde=${shiftMes(desde, -1, "inicio")}&hasta=${hasta}${qsExtra}`,
              )
            }
            className="inline-flex items-center gap-1 font-sans text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <ChevronLeft className="h-3 w-3" /> cargar {MESES[(Number(desde.slice(5, 7)) + 10) % 12]}
          </button>
          <span className="font-sans text-xs text-[var(--ink-subtle)]">
            {fmtDiaCorto(desde)} {desde.slice(0, 4)} → {fmtDiaCorto(hasta)} {hasta.slice(0, 4)}
          </span>
          <button
            onClick={() =>
              router.push(
                `/inversion-medios?desde=${desde}&hasta=${shiftMes(hasta, 1, "fin")}${qsExtra}`,
              )
            }
            className="inline-flex items-center gap-1 font-sans text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            cargar {MESES[Number(hasta.slice(5, 7)) % 12]} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <SubtotalRango
        dias={totalesDiaOperacion}
        realMaxFecha={realMaxFecha}
        view={view}
        rangoLabel={rangoLabel}
        lunesDestacados={lunesDestacados}
        conCargos={conCargos}
        onConCargos={elegirCargos}
        cargosBloqueados={!!pais}
        cargosSinDia={cobros.sinDia.map((c) => c.proveedor)}
      />

      {/* Cargos extra CARDDA (pagos recurrentes de plataformas) */}
      <CargosExtra cargos={cargos} canEdit={canEdit} />

      {/* Facturación histórica: lo realmente cobrado a la tarjeta Cardda */}
      <FacturacionHistorica consumo={carddaConsumo} consumoSem={carddaConsumoSem} fee={carddaFee} />

      {/* Gasto semanal de Google Cloud (export de facturación GCP) */}
      <GastoGcp rows={gcpSemanal} />

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        Cada celda: <span className="font-medium text-[var(--plan)]">plan</span> total del día (arriba, en
        morado) y <span className="font-medium text-[var(--ink)]">real</span> (abajo, en negro). El plan se edita{" "}
        <span className="text-[var(--ink)]">por plataforma</span> abriendo el evento. El techo por
        evento es el budgetPm de la tabla madre (se edita en{" "}
        <Link href="/admin/eventos" className="underline hover:text-[var(--ink)]">
          /admin/eventos
        </Link>
        ). El real de hoy es parcial (los datos de ads llegan a las 09:45). La atribución usa
        el EventoID al inicio del nombre de campaña — lo que no calza queda en &ldquo;No
        atribuido&rdquo;, que no tiene país y por eso se oculta al filtrar por Chile o Perú.
        Las <span className="text-[var(--ink)]">iniciativas</span> (Club Glovox, Now Mag) no tienen fecha
        de evento: su gasto son las campañas sin evento que se les arrastran desde &ldquo;No
        atribuido&rdquo; (todo el gasto de la campaña, también el anterior), y su techo es la suma de
        su plan. Si una campaña asignada pasa a traer un EventoID en el nombre, ese gasto vuelve al
        evento. Con <span className="text-[var(--ink)]">Sumar cargos extra</span> (en el subtotal por
        semana), el total del día y las semanas incluyen los cargos en su día de pago.
        Los días en <span className="font-medium text-[var(--payday-ink)]">verde</span> son la
        ventana de payday (pago de sueldos en Chile, aprox. del 28 al 3): más intenso el
        último día del mes, más suave hacia D±3.
      </p>
    </div>
  );
}

// ---------- Sub-fila de campaña "no atribuido" (dentro de la matriz) ----------

const PLAT_DOT: Record<string, string> = {
  meta: "#9F99F8",
  google: "#B1D750",
  tiktok: "#87DACD",
};
const PLAT_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

/**
 * Fila de campaña bajo "No atribuido": gasto real diario alineado a las mismas
 * columnas del calendario. Read-only. El nombre completo va en el title (la
 * columna sticky lo trunca). memo: el scroll actualiza `view` constantemente y
 * estas filas solo cambian su flag `hidden`.
 */
const NaCampRow = memo(function NaCampRow({
  nombre,
  cuenta,
  deRegla,
  dot,
  dotTitle,
  diasVals,
  fechas,
  total,
  rango,
  hidden,
  onVerMas,
  arrastre,
  destinos,
  onMover,
  onArrastrar,
}: {
  nombre: string;
  /** Cuenta publicitaria: el nombre de un boost ("Publicación de Instagram…")
   *  no dice de qué cuenta es. Ausente en la fila agregada "otras N". */
  cuenta?: string;
  /** Hoy la tiene la regla automática de su iniciativa (pill «regla»). */
  deRegla?: boolean;
  dot: string;
  dotTitle: string;
  diasVals: number[];
  /** Fecha de cada columna (mismo orden que `diasVals`), para el payday. */
  fechas: string[];
  total: number;
  /** Período CARGADO del calendario (desde–hasta), ej. "1 jun – 31 dic". */
  rango: string;
  hidden: boolean;
  /** Solo la fila agregada "otras N": libera 20 filas individuales más. */
  onVerMas?: () => void;
  /** Campaña arrastrable a una iniciativa (o de vuelta). Sin esto la fila es
   *  fija (la agregada "otras N", o si no hay iniciativas). */
  arrastre?: CampanaArrastrada;
  /** Iniciativas para el "Mover a…" (alternativa al arrastre: teclado, touch). */
  destinos?: { id: string; nombre: string }[];
  onMover?: (c: CampanaArrastrada, a: string | null) => void;
  onArrastrar?: (c: CampanaArrastrada | null) => void;
}) {
  const puntoYNombre = (
    <>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
        title={dotTitle}
      />
      <span className="truncate" title={nombre} data-nombre>
        {nombre}
      </span>
    </>
  );
  return (
    <tr className={`group/na bg-[var(--surface-sunken)] ${hidden ? "hidden" : ""}`}>
      <td className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--grid)] bg-[var(--surface-sunken)] py-1.5 pl-3 pr-2`}>
        <span className="flex items-center gap-1.5 font-sans text-xs text-[var(--ink)]">
          {arrastre ? (
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_CAMPANA, JSON.stringify(arrastre));
                e.dataTransfer.effectAllowed = "move";
                onArrastrar?.(arrastre);
              }}
              onDragEnd={() => onArrastrar?.(null)}
              className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 active:cursor-grabbing"
              title={`${nombre} — arrástrala a ${
                arrastre.porRegla
                  ? "otra iniciativa (calza con una regla automática: no vuelve a No atribuido)"
                  : arrastre.desde
                    ? "otra iniciativa o a No atribuido"
                    : "una iniciativa"
              }`}
            >
              <GripVertical className="h-3 w-3 shrink-0 text-[var(--ink-subtle)]" />
              {puntoYNombre}
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-[18px]">{puntoYNombre}</span>
          )}
          {deRegla && (
            <span
              className="shrink-0 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-1.5 text-[10px] font-medium text-[var(--ink-muted)]"
              title="La asignó la regla automática de la iniciativa. Puedes moverla a otra iniciativa; a No atribuido no, porque la regla la volvería a asignar."
            >
              regla
            </span>
          )}
          {arrastre &&
            destinos &&
            onMover &&
            (destinos.some((d) => d.id !== arrastre.desde) || (arrastre.desde && !arrastre.porRegla)) && (
            <label
              className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--ink-subtle)] opacity-0 transition-opacity focus-within:opacity-100 hover:bg-[var(--grid)] hover:text-[var(--ink)] group-hover/na:opacity-100 pointer-coarse:opacity-100"
              title="Mover a…"
            >
              <ArrowRightLeft className="h-3 w-3" />
              <select
                aria-label={`Mover ${nombre} a…`}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onMover(arrastre, v === NA_VALOR ? null : v);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">Mover a…</option>
                {destinos
                  .filter((d) => d.id !== arrastre.desde)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                {arrastre.desde && !arrastre.porRegla && <option value={NA_VALOR}>No atribuido (quitar)</option>}
              </select>
            </label>
          )}
        </span>
        <p
          className="pl-[18px] text-[11px] tabular-nums text-[var(--ink-subtle)]"
          title={`${cuenta ? `Cuenta ${cuenta}. ` : ""}Gasto total de la campaña en el período cargado del calendario (${rango})`}
        >
          {cuenta ? `${cuenta} · ` : ""}
          {total > 0 ? `${fmtUsd(total, 0)} · ${rango}` : `sin gasto en ${rango}`}
        </p>
        {onVerMas && (
          <button
            onClick={onVerMas}
            className="mt-0.5 pl-[18px] font-sans text-[11px] font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)]"
          >
            mostrar 20 más
          </button>
        )}
      </td>
      {diasVals.map((v, i) => (
        <td
          key={i}
          className={`w-16 min-w-16 max-w-16 border-t border-[var(--grid)] px-1 py-1.5 text-center tabular-nums text-[11px] text-[var(--ink-muted)] ${paydayCell(fechas[i])}`}
        >
          {v > 0 ? fmtUsd(v, 0) : <span className="text-[var(--divider)]">·</span>}
        </td>
      ))}
    </tr>
  );
});

// ---------- Fila de evento ----------

// memo: el scroll actualiza `view` muchas veces por segundo; las props de la
// fila son estables, así que solo re-renderizan header/KPIs, no ~200 celdas.
const FilaEvento = memo(function FilaEvento({
  ev,
  totales,
  hoy,
  realMaxFecha,
  hidden,
}: {
  ev: EventoGridRow;
  totales?: { totalPlan: number; totalReal: number };
  hoy: string;
  realMaxFecha: string;
  hidden: boolean;
}) {
  const totalPlanEvento = totales?.totalPlan ?? ev.totalPlan;
  const totalRealEvento = totales?.totalReal ?? ev.totalReal;
  const pctReal =
    ev.techoUsd && ev.techoUsd > 0 ? (totalRealEvento / ev.techoUsd) * 100 : null;

  return (
    <tr className={`group ${hidden ? "hidden" : ""}`}>
      <td className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-2 align-top group-hover:bg-[var(--surface-alt)]`}>
        <Link
          href={`/inversion-medios?evento=${ev.eventoId}`}
          className="block truncate font-medium text-[var(--ink)] hover:text-[#9F99F8]"
          title={ev.nombre || ev.eventoId}
          data-nombre
        >
          {ev.nombre || ev.eventoId}
        </Link>
        <p className="text-xs text-[var(--ink-subtle)]">
          {ev.eventoId}
          {ev.fechaEvento ? ` · ${ev.fechaEvento}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className="inline-flex items-center rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2 py-0.5 font-medium text-[var(--ink)]"
            title="Techo = budgetPm de categoriaEvento (se edita en /admin/eventos)"
          >
            Techo {ev.techoUsd != null ? fmtUsd(ev.techoUsd) : "—"}
          </span>
          {totalPlanEvento === 0 && ev.fechaEvento && ev.fechaEvento >= hoy && (
            <span
              className="inline-flex items-center rounded-full bg-[var(--evento-tint)] px-2 py-0.5 font-medium text-[var(--evento-ink)]"
              title="Evento sin presupuesto diario cargado — abre el evento y llena el plan por plataforma"
            >
              Sin plan
            </span>
          )}
          {pctReal != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2 py-0.5 font-medium text-[var(--ink)]"
              title={`Real histórico ${fmtUsd(totalRealEvento)} vs techo`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  pctReal > 100 ? "bg-[#ED75A0]" : pctReal > 85 ? "bg-[#F6C544]" : "bg-[#B1D750]"
                }`}
              />
              {pctReal.toFixed(0)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs tabular-nums text-[var(--ink-subtle)]">
          Plan <span className="font-medium text-[var(--plan)]">{fmtUsd(totalPlanEvento, 0)}</span> · Real{" "}
          <span className="font-medium text-[var(--ink)]">{fmtUsd(totalRealEvento, 0)}</span>
        </p>
      </td>
      {ev.days.map((cell) => {
        // TODOS los días del evento van en ámbar, no solo el primero: Bocas
        // Moradas dura 2 días, FDS 3 y Yein Fonda 4, y esos días tienen gasto y
        // venta reales. Ver lib/inversion-medios/evento.ts.
        const diaEvento = esDiaEvento(cell.fecha, ev.fechaEvento, ev.diasEvento);
        return (
          <td
            key={cell.fecha}
            title={diaEvento ? tituloDiaEvento(cell.fecha, ev.fechaEvento, ev.diasEvento) : undefined}
            className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] p-0 text-center align-top ${
              diaEvento
                ? "bg-[var(--evento-tint)]"
                : cell.fecha === hoy
                  ? "bg-[var(--purple-tint)]/40"
                  : paydayCell(cell.fecha)
            }`}
          >
            <CeldaResumen cell={cell} parcial={cell.fecha === hoy || cell.fecha > realMaxFecha} />
          </td>
        );
      })}
    </tr>
  );
});

// ---------- Nueva iniciativa (encabezado de la sección) ----------

/**
 * "+ Nueva iniciativa": formulario en línea en el encabezado de la sección.
 * Crea la iniciativa con el siguiente id `INI###` y al final del orden; aparece
 * al revalidarse la página, lista para recibir campañas y plan.
 */
function NuevaIniciativa() {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Al cerrar el formulario el foco vuelve al botón (si no, cae en <body>).
  const botonRef = useRef<HTMLButtonElement>(null);
  const volverFoco = useRef(false);
  useEffect(() => {
    if (!abierto && volverFoco.current) {
      volverFoco.current = false;
      botonRef.current?.focus();
    }
  }, [abierto]);
  const cerrar = () => {
    volverFoco.current = true;
    setAbierto(false);
    setNombre("");
    setError(null);
  };
  const crear = () => {
    const limpio = limpiarNombreIniciativa(nombre);
    if (!limpio) return setError(`Entre ${NOMBRE_INICIATIVA_MIN} y ${NOMBRE_INICIATIVA_MAX} caracteres`);
    setError(null);
    start(async () => {
      const res = await crearIniciativaAction({ nombre: limpio });
      // Dentro de la transición: el formulario se cierra junto con la página
      // revalidada (la fila nueva aparece en el mismo cuadro).
      if (!res.ok) start(() => setError(res.error));
      else start(() => cerrar());
    });
  };

  if (!abierto) {
    return (
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)]"
      >
        <Plus className="h-3 w-3" /> Nueva iniciativa
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        crear();
      }}
      className="mt-1.5 flex w-full flex-col gap-1.5"
    >
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cerrar();
        }}
        maxLength={NOMBRE_INICIATIVA_MAX}
        placeholder="Nombre (ej. Marca Glovox)"
        aria-label="Nombre de la nueva iniciativa"
        className="w-full rounded-md border border-[var(--divider)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)] placeholder:text-[var(--ink-subtle)] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#9F99F8] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="rounded-md px-2 py-1 text-xs text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
        >
          Cancelar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[11px] leading-snug text-[#ED75A0]">
          {error}
        </p>
      )}
    </form>
  );
}

// ---------- Fila de iniciativa ----------

/**
 * Fila de una iniciativa (Club Glovox, Now Mag…): la misma celda que un evento
 * (plan arriba, real abajo) pero sin día de evento ni budgetPm — su techo es la
 * suma de su plan. Es zona para SOLTAR campañas: borde punteado mientras se
 * arrastra una que puede recibir, y relleno al pasar por encima.
 */
const FilaIniciativa = memo(function FilaIniciativa({
  activa,
  hidden,
  canEdit,
  fila,
  totales,
  nCampanas,
  reglas,
  abierta,
  onToggle,
  arrastrando,
  onSoltar,
  hoy,
  realMaxFecha,
}: {
  /** false = archivada: no recibe campañas, se reactiva desde acá. */
  activa: boolean;
  hidden: boolean;
  canEdit: boolean;
  fila: EventoGridRow;
  /** Totales HISTÓRICOS (todo el plan = el techo, todo el gasto asignado). */
  totales?: { totalPlan: number; totalReal: number };
  nCampanas: number;
  /** Reglas de asignación automática, ya descritas ("Meta · Glovox · …"). */
  reglas?: string[];
  abierta: boolean;
  onToggle: (id: string) => void;
  arrastrando: CampanaArrastrada | null;
  onSoltar: (c: CampanaArrastrada, iniciativaId: string) => void;
  hoy: string;
  realMaxFecha: string;
}) {
  const [encima, setEncima] = useState(false);
  const acepta = activa && arrastrando != null && arrastrando.desde !== fila.eventoId;
  const resaltada = encima && acepta;
  const totalPlan = totales?.totalPlan ?? fila.totalPlan;
  const totalReal = totales?.totalReal ?? fila.totalReal;

  // Renombrar en línea y archivar / reactivar (las actions revalidan la página).
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(fila.nombre);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Al cerrar el editor el foco vuelve al lápiz (si no, cae en <body>).
  const lapizRef = useRef<HTMLButtonElement>(null);
  const volverFoco = useRef(false);
  useEffect(() => {
    if (!editando && volverFoco.current) {
      volverFoco.current = false;
      lapizRef.current?.focus();
    }
  }, [editando]);
  const cerrarEdicion = () => {
    volverFoco.current = true;
    setEditando(false);
    setError(null);
  };
  const guardarNombre = () => {
    const limpio = limpiarNombreIniciativa(nombre);
    if (!limpio) return setError(`Entre ${NOMBRE_INICIATIVA_MIN} y ${NOMBRE_INICIATIVA_MAX} caracteres`);
    if (limpio === fila.nombre) return cerrarEdicion();
    start(async () => {
      const res = await renombrarIniciativaAction({ id: fila.eventoId, nombre: limpio });
      // Dentro de la transición: el editor se cierra junto con la página
      // revalidada, sin mostrar un instante el nombre viejo.
      if (!res.ok) start(() => setError(res.error));
      else start(() => cerrarEdicion());
    });
  };
  const archivar = (archivarla: boolean) => {
    start(async () => {
      let borrarPlanFuturo = false;
      if (archivarla) {
        // Cuánto plan desde hoy tiene: se borra al archivar (un frente cortado
        // no puede seguir sumando al presupuesto). El pasado se conserva.
        const pf = await planFuturoIniciativaAction({ id: fila.eventoId });
        if (!pf.ok) return start(() => setError(pf.error));
        const futuro = pf.data && pf.data.dias > 0 ? pf.data : null;
        const ok = window.confirm(
          `¿Archivar «${fila.nombre}»?\n\n` +
            (futuro
              ? `Tiene ${fmtUsd(futuro.usd, 0)} de plan desde hoy (${futuro.dias} ${futuro.dias === 1 ? "día" : "días"}): ese plan futuro se BORRA al archivarla, para que no siga sumando al presupuesto del día y de la semana.\n\n`
              : "") +
            "Deja de recibir plan y campañas. Su historial se conserva: el plan pasado, sus campañas y su gasto siguen siendo suyos. Su fila solo aparece cuando tiene datos en los días que estás mirando (o con «ver archivadas»), y puedes reactivarla cuando quieras.",
        );
        if (!ok) return;
        borrarPlanFuturo = futuro != null;
      }
      const res = await archivarIniciativaAction({ id: fila.eventoId, archivar: archivarla, borrarPlanFuturo });
      start(() => setError(res.ok ? null : res.error));
    });
  };
  const iconBtn =
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--ink-muted)] opacity-0 transition-opacity hover:bg-[var(--grid)] hover:text-[var(--ink)] focus:opacity-100 focus-visible:outline-2 focus-visible:outline-[#9F99F8] group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 disabled:opacity-40";

  return (
    <tr
      className={`group ${hidden ? "hidden" : ""}`}
      onDragOver={(e) => {
        if (!acepta || !e.dataTransfer.types.includes(DND_CAMPANA)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!encima) setEncima(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const c = leerArrastre(e.dataTransfer);
        if (c) onSoltar(c, fila.eventoId);
      }}
    >
      <td
        className={`sticky left-0 z-10 ${W_NOMBRE} border-r border-t border-[var(--divider)] px-4 py-2 align-top ${
          resaltada
            ? "bg-[var(--purple-tint)] ring-2 ring-inset ring-[#9F99F8]"
            : acepta
              ? "bg-[var(--surface)] outline-dashed outline-1 -outline-offset-4 outline-[#9F99F8]"
              : "bg-[var(--surface)] group-hover:bg-[var(--surface-alt)]"
        }`}
      >
        {editando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardarNombre();
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cerrarEdicion();
              }}
              maxLength={NOMBRE_INICIATIVA_MAX}
              aria-label={`Nuevo nombre de ${fila.nombre}`}
              className="min-w-0 flex-1 rounded-md border border-[var(--divider)] bg-[var(--surface)] px-2 py-0.5 text-sm text-[var(--ink)] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
            />
            <button type="submit" disabled={pending} className={`${iconBtn} opacity-100`} aria-label="Guardar nombre">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={cerrarEdicion} className={`${iconBtn} opacity-100`} aria-label="Cancelar">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <span className="flex items-center gap-1">
            <Link
              href={`/inversion-medios?evento=${fila.eventoId}`}
              className={`block min-w-0 flex-1 truncate font-medium hover:text-[#9F99F8] ${
                activa ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
              }`}
              title={
                activa
                  ? `${fila.nombre} — abrir para planificar por plataforma (techo = suma del plan)`
                  : `${fila.nombre} — abrir en solo lectura (archivada)`
              }
              data-nombre
            >
              {fila.nombre}
            </Link>
            {canEdit && (
              <>
                <button
                  ref={lapizRef}
                  type="button"
                  onClick={() => {
                    setNombre(fila.nombre);
                    setError(null);
                    setEditando(true);
                  }}
                  className={iconBtn}
                  title="Cambiar el nombre"
                  aria-label={`Cambiar el nombre de ${fila.nombre}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {activa && (
                  <button
                    type="button"
                    onClick={() => archivar(true)}
                    disabled={pending}
                    className={iconBtn}
                    title="Archivar (se conserva su historial)"
                    aria-label={`Archivar ${fila.nombre}`}
                  >
                    <Archive className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </span>
        )}
        <p
          className="text-xs tabular-nums text-[var(--ink-subtle)]"
          title="Totales históricos. El techo de una iniciativa es la suma de su plan."
        >
          Plan <span className="font-medium text-[var(--plan)]">{fmtUsd(totalPlan, 0)}</span> · Real{" "}
          <span className="font-medium text-[var(--ink)]">{fmtUsd(totalReal, 0)}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {resaltada ? (
            <span className="font-medium text-[var(--plan)]">suelta para asignar la campaña</span>
          ) : (
            <>
              {!activa && (
                <span
                  className="inline-flex items-center rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2 py-0.5 font-medium text-[var(--ink-muted)]"
                  title="Archivada: no recibe plan ni campañas; su historial se conserva"
                >
                  Archivada
                </span>
              )}
              {!activa && canEdit && (
                <button
                  type="button"
                  onClick={() => archivar(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)] disabled:opacity-60"
                >
                  <ArchiveRestore className="h-3 w-3" /> Reactivar
                </button>
              )}
              {activa && totalPlan === 0 && (
                <span
                  className="inline-flex items-center rounded-full bg-[var(--evento-tint)] px-2 py-0.5 font-medium text-[var(--evento-ink)]"
                  title="La iniciativa no tiene plan cargado — ábrela y llena el plan por plataforma"
                >
                  Sin plan
                </span>
              )}
              {reglas && reglas.length > 0 && (
                <span
                  className="inline-flex items-center rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2 py-0.5 font-medium text-[var(--ink-muted)]"
                  title={`Se le asignan solas las campañas sin evento de: ${reglas.join("; ")}. También las que se creen después.`}
                >
                  regla automática
                </span>
              )}
              {nCampanas > 0 ? (
                <button
                  onClick={() => onToggle(fila.eventoId)}
                  aria-expanded={abierta}
                  className="inline-flex items-center gap-1 font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)]"
                >
                  {abierta ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {abierta ? "ocultar campañas" : `ver campañas (${nCampanas})`}
                </button>
              ) : (
                <span className="text-[var(--ink-subtle)]">
                  {reglas && reglas.length > 0 ? "sin gasto en el período" : "sin campañas"}
                </span>
              )}
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[11px] leading-snug text-[#ED75A0]">
            {error}
          </p>
        )}
      </td>
      {fila.days.map((cell) => (
        <td
          key={cell.fecha}
          className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] p-0 text-center align-top ${
            cell.fecha === hoy ? "bg-[var(--purple-tint)]/40" : paydayCell(cell.fecha)
          }`}
        >
          <CeldaResumen cell={cell} parcial={cell.fecha === hoy || cell.fecha > realMaxFecha} />
        </td>
      ))}
    </tr>
  );
});

// Celda read-only del grid: plan TOTAL del día (suma plataformas) + real. La
// edición por plataforma vive en el drill del evento.
function CeldaResumen({ cell, parcial }: { cell: DayCell; parcial: boolean }) {
  return (
    <div className="flex min-w-16 flex-col items-stretch px-0.5 py-1.5">
      <span className="text-center tabular-nums text-xs font-medium text-[var(--plan)]">
        {cell.plan != null ? fmtUsd(cell.plan, 0) : <span className="text-[var(--divider)]">·</span>}
      </span>
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[var(--ink)]"
        title={
          cell.real != null
            ? `Real ${fmtUsd(cell.real)}${cell.fxImputado ? " · FX imputado (último disponible)" : ""}${parcial ? " · parcial (los ads llegan ~09:45)" : ""}`
            : cell.sinFx
              ? "Gasto en moneda sin ningún FX conocido"
              : ""
        }
      >
        {cell.sinFx ? (
          <>
            {cell.real != null && cell.real > 0 ? `${fmtUsd(cell.real, 0)} ` : ""}
            <span className="font-medium text-[#EF8C34]">+sin FX</span>
          </>
        ) : cell.real != null && cell.real > 0 ? (
          // Sin sufijo "…" para el día parcial (se leía como monto truncado);
          // el aviso va en el title.
          fmtUsd(cell.real, 0)
        ) : (
          <span className="text-[var(--divider)]">·</span>
        )}
      </span>
    </div>
  );
}

// ---------- Resumen por canal ----------

const CANAL_COLORS: Record<string, string> = {
  Meta: "#9F99F8",
  Google: "#B1D750",
  TikTok: "#87DACD",
  Otras: "#B4B2A9",
};

function CanalResumen({
  canal,
  rangoLabel,
  noAtribuido,
}: {
  canal: { meta: number; google: number; tiktok: number; otras: number; plan: number; real: number };
  rangoLabel: string;
  noAtribuido: number;
}) {
  const canales = [
    { label: "Meta", val: canal.meta },
    { label: "Google", val: canal.google },
    { label: "TikTok", val: canal.tiktok },
    // "Otras" solo aparece si el mart trae gasto fuera de las tres.
    ...(canal.otras > 0 ? [{ label: "Otras", val: canal.otras }] : []),
  ];
  const pctEjec = canal.plan > 0 ? (canal.real / canal.plan) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Kpi
          label={`Presupuesto · ${rangoLabel}`}
          value={fmtUsd(canal.plan)}
          hint="monto diario total (sin desglose por canal)"
        />
        {canales.map((c) => (
          <PlataformaCard
            key={c.label}
            label={c.label}
            value={fmtUsd(c.val)}
            color={CANAL_COLORS[c.label]}
            share={canal.real > 0 ? (c.val / canal.real) * 100 : 0}
          />
        ))}
      </div>

      {/* Barra de composición + totales */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
        <p className="font-sans text-sm text-[var(--ink)]">
          Gasto real total{" "}
          <span className="font-display text-lg font-bold">{fmtUsd(canal.real)}</span>
          {pctEjec != null && (
            <span className="ml-2 text-[var(--ink-muted)]">
              · {pctEjec.toFixed(0)}% del presupuesto
            </span>
          )}
          {noAtribuido > 0 && (
            <span className="ml-2 text-[var(--ink-subtle)]">
              · incluye {fmtUsd(noAtribuido)} no atribuido
            </span>
          )}
        </p>
        <div className="flex h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-[var(--grid)]">
          {canal.real > 0 &&
            canales.map((c) => (
              <div
                key={c.label}
                style={{
                  width: `${(c.val / canal.real) * 100}%`,
                  backgroundColor: CANAL_COLORS[c.label],
                }}
                title={`${c.label}: ${fmtUsd(c.val)}`}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function PlataformaCard({
  label,
  value,
  color,
  share,
}: {
  label: string;
  value: string;
  color: string;
  share: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
      <p className="inline-flex items-center gap-1.5 font-sans text-xs text-[var(--ink-muted)]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-3 font-sans text-xs text-[var(--ink-muted)]">
        {share.toFixed(0)}% del gasto real
      </p>
    </div>
  );
}

// ---------- KPI card ----------

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
      <p className="font-sans text-xs text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
        {value}
      </p>
      {(hint || tone) && (
        <p className="mt-3 inline-flex items-center gap-1.5 font-sans text-xs text-[var(--ink-muted)]">
          {tone && (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                tone === "neg" ? "bg-[#ED75A0]" : "bg-[#B1D750]"
              }`}
            />
          )}
          {hint ?? (tone === "neg" ? "sobre el plan" : "bajo el plan")}
        </p>
      )}
    </div>
  );
}

// ---------- Cargos extra CARDDA (pagos recurrentes de plataformas) ----------

type CargoForm = { proveedor: string; detalle: string; metodo: MetodoCargo; monto: string; diaPago: string };
const CARGO_VACIO: CargoForm = { proveedor: "", detalle: "", metodo: "mensual", monto: "", diaPago: "" };

function CargosExtra({ cargos, canEdit }: { cargos: CargoExtra[]; canEdit: boolean }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null); // id en edición, "" = alta nueva, null = cerrado
  const [form, setForm] = useState<CargoForm>(CARGO_VACIO);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = useMemo(() => resumenCargos(cargos), [cargos]);

  function abrirAlta() {
    setEditId("");
    setForm(CARGO_VACIO);
    setMsg(null);
  }
  function abrirEdicion(c: CargoExtra) {
    setEditId(c.id);
    setForm({
      proveedor: c.proveedor,
      detalle: c.detalle ?? "",
      metodo: (METODOS_CARGO as readonly string[]).includes(c.metodo) ? (c.metodo as MetodoCargo) : "mensual",
      monto: String(c.montoUsd),
      diaPago: c.diaPago ?? "",
    });
    setMsg(null);
  }
  function guardar() {
    const monto = Number(form.monto.replace(/[$\s]/g, "").replace(",", "."));
    if (!form.proveedor.trim()) return setMsg({ ok: false, text: "Falta el proveedor" });
    if (!Number.isFinite(monto) || monto <= 0) return setMsg({ ok: false, text: "Monto inválido" });
    start(async () => {
      const res = await upsertCargoAction({
        id: editId || undefined,
        proveedor: form.proveedor,
        detalle: form.detalle,
        metodo: form.metodo,
        montoUsd: monto,
        diaPago: form.diaPago,
      });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else {
        setEditId(null);
        setMsg(null);
        router.refresh();
      }
    });
  }
  function borrar(id: string) {
    start(async () => {
      const res = await deleteCargoAction({ id });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  const inputCls =
    "rounded-lg border border-[var(--divider)] px-3 py-2 font-sans text-sm text-[var(--ink)] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--ink)]">Cargos extra CARDDA</h2>
          <p className="font-sans text-xs text-[var(--ink-muted)]">
            Pagos recurrentes de plataformas (DRIP, Adobe, Google Workspace, GPT…) normalizados
            para presupuestar.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={abrirAlta}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
          >
            <Plus className="h-4 w-4" /> Agregar proveedor
          </button>
        )}
      </div>

      {/* Resumen normalizado */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">Costo mensual (normalizado)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(total.mensual, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">lo que conviene presupuestar por mes</p>
        </div>
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">Costo semanal (normalizado)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(total.semanal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">promedio por semana</p>
        </div>
      </div>

      {/* Form alta/edición */}
      {canEdit && editId !== null && (
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
              Proveedor
              <input
                value={form.proveedor}
                onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                placeholder="DRIP, Adobe, Google Workspace…"
                className={`${inputCls} w-48`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
              Detalle
              <input
                value={form.detalle}
                onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
                placeholder="cuenta, plan, notas"
                className={`${inputCls} w-48`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
              Método
              <select
                value={form.metodo}
                onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value as MetodoCargo }))}
                className={inputCls}
              >
                {METODOS_CARGO.map((m) => (
                  <option key={m} value={m}>
                    {METODO_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
              Monto USD
              <input
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                inputMode="decimal"
                placeholder="0.00"
                className={`${inputCls} w-28 text-right tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
              Día de pago
              <input
                value={form.diaPago}
                onChange={(e) => setForm((f) => ({ ...f, diaPago: e.target.value }))}
                placeholder="15 · 1 de marzo · lunes"
                className={`${inputCls} w-40`}
              />
            </label>
            <button
              onClick={guardar}
              disabled={pending}
              className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
            >
              {editId ? "Guardar" : "Agregar"}
            </button>
            <button
              onClick={() => setEditId(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
            {msg && !msg.ok && <span className="font-sans text-xs text-[#ED75A0]">{msg.text}</span>}
          </div>
        </div>
      )}

      {/* Tabla de cargos */}
      {cargos.length === 0 ? (
        <p className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
          Sin cargos extra cargados{canEdit ? " — agrega el primero." : "."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="border-b border-[var(--divider)] px-4 py-2 text-left font-medium">Proveedor</th>
                <th className="border-b border-[var(--divider)] px-4 py-2 text-left font-medium">Método</th>
                <th className="border-b border-[var(--divider)] px-4 py-2 text-right font-medium">Monto</th>
                <th className="border-b border-[var(--divider)] px-4 py-2 text-left font-medium">Día</th>
                <th className="border-b border-[var(--divider)] px-4 py-2 text-right font-medium">≈ Mensual</th>
                {canEdit && <th className="border-b border-[var(--divider)] px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-[var(--surface-alt)]">
                  <td className="border-t border-[var(--divider)] px-4 py-2">
                    <span className="font-medium text-[var(--ink)]">{c.proveedor}</span>
                    {c.detalle && <p className="text-xs text-[var(--ink-subtle)]">{c.detalle}</p>}
                  </td>
                  <td className="border-t border-[var(--divider)] px-4 py-2 text-[var(--ink-muted)]">
                    {METODO_LABEL[c.metodo as MetodoCargo] ?? c.metodo}
                  </td>
                  <td className="border-t border-[var(--divider)] px-4 py-2 text-right tabular-nums text-[var(--ink)]">
                    {fmtUsd(c.montoUsd)}
                  </td>
                  <td className="border-t border-[var(--divider)] px-4 py-2 text-[var(--ink-subtle)]">{c.diaPago || "—"}</td>
                  <td className="border-t border-[var(--divider)] px-4 py-2 text-right tabular-nums text-[var(--ink-muted)]">
                    {fmtUsd(costoMensual(c), 0)}
                    <span className="block text-[11px] text-[var(--ink-subtle)]">{fmtUsd(costoSemanal(c), 0)}/sem</span>
                  </td>
                  {canEdit && (
                    <td className="border-t border-[var(--divider)] px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => abrirEdicion(c)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--ink-muted)] hover:bg-[var(--grid)]"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => borrar(c.id)}
                          disabled={pending}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[#ED75A0]"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Facturación histórica (Cardda) ----------

/**
 * Evolución temporal del consumo Cardda como ÁREA APILADA por canal: el eje Y
 * es el consumo total del período y cada plataforma es una banda del total —
 * se lee cuánto pesa cada una y cómo varía respecto del total. X asciende en
 * el tiempo (la tabla va desc; acá se invierte). Fill 15% + stroke 2px según
 * la guía; el orden de apilado fija Meta abajo (la banda dominante).
 */
function FacturacionChart({ filas, gran }: { filas: FacturacionMes[]; gran: "mes" | "semana" }) {
  const data = useMemo(
    () =>
      [...filas].reverse().map((m) => ({
        periodo: m.periodo,
        label: fmtPeriodo(m.periodo),
        meta: Math.round(m.meta),
        google: Math.round(m.google),
        tiktok: Math.round(m.tiktok),
        otras: Math.round(m.otras),
        total: Math.round(m.consumoUsd),
      })),
    [filas],
  );
  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
        Sin consumo para graficar.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-sm text-[var(--ink)]">
          Consumo {gran === "mes" ? "mensual" : "semanal"} apilado por plataforma
        </p>
        <div className="flex flex-wrap items-center gap-3 font-sans text-xs text-[var(--ink-muted)]">
          {CANALES_FACT.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CANAL_COLORS[CANAL_FACT_LABEL[c]] }}
              />
              {CANAL_FACT_LABEL[c]}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--ink-subtle)" }}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--ink-subtle)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
              width={52}
            />
            <ChartTooltip content={<FacturacionTooltip />} cursor={{ stroke: "var(--divider)" }} />
            {/* Orden de apilado: Meta (dominante) abajo → Otras arriba. */}
            {CANALES_FACT.map((c) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stackId="total"
                stroke={CANAL_COLORS[CANAL_FACT_LABEL[c]]}
                strokeWidth={2}
                fill={CANAL_COLORS[CANAL_FACT_LABEL[c]]}
                fillOpacity={0.15}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Tooltip del área apilada: dot + canal + monto, y el total del período. */
function FacturacionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((a, p) => a + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 font-sans text-sm text-[var(--ink)] shadow-md">
      <p className="text-xs text-[var(--ink-muted)]">{label}</p>
      {[...payload].reverse().map((p) => (
        <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {CANAL_FACT_LABEL[p.dataKey as CanalFact] ?? String(p.dataKey)}{" "}
          <span className="ml-auto pl-3 font-medium">{fmtUsd(Number(p.value) || 0, 0)}</span>
        </p>
      ))}
      <p className="mt-1.5 border-t border-[var(--grid)] pt-1 text-xs text-[var(--ink-muted)]">
        Total <span className="font-medium text-[var(--ink)]">{fmtUsd(total, 0)}</span>
      </p>
    </div>
  );
}

function FacturacionHistorica({
  consumo,
  consumoSem,
  fee,
}: {
  consumo: CarddaConsumoRow[];
  consumoSem: CarddaConsumoRow[];
  fee: CarddaFeeRow[];
}) {
  const meses = useMemo<FacturacionMes[]>(() => buildFacturacion(consumo, fee), [consumo, fee]);
  const resumen = useMemo(() => resumenFacturacion(meses), [meses]);
  // Semanal: sin fee (el fee es una boleta MENSUAL; prorratearlo mentiría).
  const semanas = useMemo<FacturacionMes[]>(() => buildFacturacion(consumoSem, []), [consumoSem]);
  const [vista, setVista] = useState<"tabla" | "grafico">("tabla");
  const [gran, setGran] = useState<"mes" | "semana">("mes");
  const filas = gran === "mes" ? meses : semanas;
  const conFee = gran === "mes"; // la columna Fee solo existe a nivel mes

  if (meses.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--ink)]">Facturación histórica (Cardda)</h2>
          <p className="font-sans text-xs text-[var(--ink-muted)]">
            Lo realmente cobrado a la tarjeta Cardda con que se pagan los ads.
          </p>
        </div>
        <p className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
          Sin facturación cargada todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">Facturación histórica (Cardda)</h2>
        <p className="max-w-3xl font-sans text-xs text-[var(--ink-muted)]">
          Lo realmente <span className="text-[var(--ink)]">cobrado a la tarjeta Cardda</span> (solo
          cargos aprobados, en USD por fecha). Es distinto del gasto declarado de las cuentas de
          ads de arriba: acá manda el cargo real a la tarjeta.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">Consumo tarjeta (histórico)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(resumen.consumoTotal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">todos los comercios, aprobado</p>
        </div>
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">Fee de Cardda (histórico)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(resumen.feeTotal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">costo del servicio Cardda</p>
        </div>
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">
            Consumo {resumen.ultimoPeriodo ? fmtPeriodo(resumen.ultimoPeriodo) : "último mes"}
          </p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(resumen.consumoUltimoMes, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">último mes con datos</p>
        </div>
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <p className="font-sans text-xs text-[var(--ink-muted)]">
            Fee {resumen.ultimoPeriodo ? fmtPeriodo(resumen.ultimoPeriodo) : "último mes"}
          </p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">
            {fmtUsd(resumen.feeUltimoMes, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">fee del último mes</p>
        </div>
      </div>

      {/* Controles: Tabla↔Gráfico y Mes↔Semana */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] font-sans text-sm">
          {(
            [
              ["tabla", "Tabla"],
              ["grafico", "Gráfico"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setVista(k)}
              className={`px-4 py-2 transition-colors ${
                vista === k
                  ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] font-sans text-sm">
          {(
            [
              ["mes", "Mes"],
              ["semana", "Semana"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setGran(k)}
              className={`px-4 py-2 transition-colors ${
                gran === k
                  ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {gran === "semana" && (
          <span className="font-sans text-xs text-[var(--ink-subtle)]">
            semanas de lunes a domingo · el fee de Cardda es mensual (no se muestra por semana)
          </span>
        )}
      </div>

      {vista === "grafico" ? (
        <FacturacionChart filas={filas} gran={gran} />
      ) : (
        <>
      {/* Tabla por período×canal + fee (scrolleable, header sticky) */}
      <div className="max-h-[440px] overflow-auto rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
        <table className="w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)] text-xs text-[var(--ink-muted)] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[var(--surface-alt)]">
              <th className="px-4 py-3 text-left font-medium">Período</th>
              {CANALES_FACT.map((c) => (
                <th key={c} className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CANAL_COLORS[CANAL_FACT_LABEL[c]] }}
                    />
                    {CANAL_FACT_LABEL[c]}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-[var(--ink)]">Consumo total</th>
              {conFee && <th className="px-4 py-3 text-right font-medium">Fee Cardda</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.periodo} className="border-b border-[var(--grid)] last:border-0 hover:bg-[var(--surface-alt)]">
                <td className="px-4 py-2.5 text-left font-medium text-[var(--ink)]">{fmtPeriodo(m.periodo)}</td>
                {CANALES_FACT.map((c) => (
                  <td key={c} className="px-4 py-2.5 text-right tabular-nums text-[var(--ink-muted)]">
                    {m[c] > 0 ? fmtUsd(m[c], 0) : "·"}
                  </td>
                ))}
                <td
                  className="px-4 py-2.5 text-right font-medium tabular-nums text-[var(--ink)]"
                  title={`CLP ${m.consumoClp.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`}
                >
                  {fmtUsd(m.consumoUsd, 0)}
                </td>
                {conFee && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--ink-muted)]">
                    {m.feeUsd > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtUsd(m.feeUsd, 0)}
                        {m.feeStatus === "draft" && (
                          <span className="rounded-full bg-[var(--evento-tint)] px-1.5 py-0.5 text-[10px] text-[var(--evento-ink)]">
                            borrador
                          </span>
                        )}
                      </span>
                    ) : (
                      "·"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--divider)] bg-[var(--surface-alt)] text-[var(--ink)]">
              <td className="px-4 py-3 text-left font-medium">Total histórico</td>
              {CANALES_FACT.map((c) => (
                <td key={c} className="px-4 py-3 text-right font-medium tabular-nums">
                  {fmtUsd(resumen.porCanalTotal[c], 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtUsd(resumen.consumoTotal, 0)}</td>
              {conFee && (
                <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtUsd(resumen.feeTotal, 0)}</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
        </>
      )}

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        &ldquo;Otras&rdquo; agrupa SaaS y otros comercios (Drip, Adobe, Webflow, Workspace…) — se
        solapa con los cargos extra de arriba. Meta = Facebook/Instagram; Google = solo Google Ads
        (Workspace/Cloud caen en Otras); montos convertidos a USD con el tipo de cambio del día.
      </p>
    </div>
  );
}
