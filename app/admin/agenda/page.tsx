import { and, gte, lte } from "drizzle-orm";
import { requireSuperadmin } from "@/lib/access";
import { db } from "@/db";
import { adminAgendaNotas } from "@/db/schema";
import AgendaBoard from "./_components/AgendaBoard";

export const dynamic = "force-dynamic";

const TZ = "America/Santiago";
const DIAS_ATRAS = 3; // pequeño margen pasado para arrastrar pendientes de ayer
const DIAS_ADELANTE_DEFAULT = 30;

interface PageProps {
  searchParams: Promise<{ dias?: string }>;
}

/** "Hoy" en la zona horaria de operación (Chile), como YYYY-MM-DD. */
function hoyEnTZ(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Aritmética de fechas anclada a UTC medianoche para evitar el off-by-one de DST.
function ymdToUTC(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function utcToYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDias(ymd: string, n: number): string {
  const d = ymdToUTC(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToYMD(d);
}

export default async function AdminAgendaPage({ searchParams }: PageProps) {
  await requireSuperadmin();
  const { dias } = await searchParams;
  const adelante = Math.min(
    Math.max(Number(dias) || DIAS_ADELANTE_DEFAULT, 1),
    120,
  );

  const hoy = hoyEnTZ();
  const desde = addDias(hoy, -DIAS_ATRAS);
  const hasta = addDias(hoy, adelante);

  // Lista de fechas del rango (inclusive).
  const fechas: string[] = [];
  for (let f = desde; f <= hasta; f = addDias(f, 1)) {
    fechas.push(f);
  }

  // Sólo el fetch va en el try/catch; el JSX se arma afuera (regla de Next).
  let notas: { fecha: string; contenido: string }[] = [];
  let errorMsg: string | null = null;
  try {
    notas = await db
      .select({
        fecha: adminAgendaNotas.fecha,
        contenido: adminAgendaNotas.contenido,
      })
      .from(adminAgendaNotas)
      .where(
        and(
          gte(adminAgendaNotas.fecha, desde),
          lte(adminAgendaNotas.fecha, hasta),
        ),
      );
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "No se pudo cargar la agenda.";
  }

  const porFecha = new Map(notas.map((n) => [n.fecha, n.contenido]));
  const diasView = fechas.map((fecha) => ({
    fecha,
    contenido: porFecha.get(fecha) ?? "",
    esHoy: fecha === hoy,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">Agenda</h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Anota lo que hay que hacer cada día. Se guarda solo y lo ve todo el
          equipo.
        </p>
      </div>

      {errorMsg ? (
        <ErrorCard msg={errorMsg} />
      ) : (
        <AgendaBoard dias={diasView} />
      )}
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
      <p className="flex-1 font-sans text-sm text-[#333333]">{msg}</p>
    </div>
  );
}
