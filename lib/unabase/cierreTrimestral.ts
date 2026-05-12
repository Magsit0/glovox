import type {
  CierreEventoTrimestralRow,
  NegocioVentaRow,
} from "@/lib/queries/cierreTrimestral";

export interface CategoriaBreakdownRow {
  categoria: string;
  totalEventos: number;
  totalAsistentes: number;
  totalVentaTickets: number;
  totalVentaFFBB: number;
  perCapitaTickets: number;
  perCapitaFFBB: number;
}

export interface EventoDetalleRow {
  eventoId: string;
  nombreId: string;
  fechaEvento: string | null;
  categoria: string;
  totalAsistentes: number;
  totalVentaTickets: number;
  totalVentaFFBB: number;
  perCapitaTickets: number;
  perCapitaFFBB: number;
  gastoPM: number;
}

export interface TrimestreAggregate {
  totalEventos: number;
  totalAsistentes: number;
  totalTicketsVendidos: number;
  totalVentaTickets: number;
  totalVentaFFBB: number;
  perCapitaTicketsPromedio: number; // ponderado por asistentes
  perCapitaFFBBPromedio: number; // ponderado por asistentes
  gastoPMTotal: number;
  porCategoria: CategoriaBreakdownRow[];
  eventos: EventoDetalleRow[];
}

function v(x: number | null | undefined): number {
  return x == null ? 0 : x;
}

export interface VentasAreaRow {
  area: string;
  totalNeto: number;
  cantidadNegocios: number;
}

export interface VentasAggregate {
  totalNeto: number;
  totalNegocios: number;
  porArea: VentasAreaRow[];
}

export function aggregateVentas(rows: NegocioVentaRow[]): VentasAggregate {
  const map = new Map<string, VentasAreaRow>();
  let totalNeto = 0;
  for (const r of rows) {
    const area = (r.areaNegocio && r.areaNegocio.trim()) || "Sin área";
    const existing = map.get(area);
    if (existing) {
      existing.totalNeto += r.totalNeto;
      existing.cantidadNegocios += 1;
    } else {
      map.set(area, { area, totalNeto: r.totalNeto, cantidadNegocios: 1 });
    }
    totalNeto += r.totalNeto;
  }
  const porArea = Array.from(map.values()).sort((a, b) => b.totalNeto - a.totalNeto);
  return { totalNeto, totalNegocios: rows.length, porArea };
}

export function aggregateTrimestre(rows: CierreEventoTrimestralRow[]): TrimestreAggregate {
  let totalAsistentes = 0;
  let totalTicketsVendidos = 0;
  let totalVentaTickets = 0;
  let totalVentaFFBB = 0;
  let gastoPMTotal = 0;

  const catMap = new Map<string, CategoriaBreakdownRow>();
  const eventos: EventoDetalleRow[] = [];

  for (const r of rows) {
    const asistentes = v(r.TotalAsistentes);
    const ventaTickets = v(r.TotalVentaTICKETS);
    const ventaFFBB = v(r.TotalVentaFFBB);
    const ticketsVendidos = v(r.TotalTicketsVendidos);
    const gastoPM = v(r.GastoPM);

    totalAsistentes += asistentes;
    totalTicketsVendidos += ticketsVendidos;
    totalVentaTickets += ventaTickets;
    totalVentaFFBB += ventaFFBB;
    gastoPMTotal += gastoPM;

    const categoria = r.CategoriaEvento ?? "Sin categoría";
    const existing = catMap.get(categoria);
    if (existing) {
      existing.totalEventos += 1;
      existing.totalAsistentes += asistentes;
      existing.totalVentaTickets += ventaTickets;
      existing.totalVentaFFBB += ventaFFBB;
    } else {
      catMap.set(categoria, {
        categoria,
        totalEventos: 1,
        totalAsistentes: asistentes,
        totalVentaTickets: ventaTickets,
        totalVentaFFBB: ventaFFBB,
        perCapitaTickets: 0,
        perCapitaFFBB: 0,
      });
    }

    eventos.push({
      eventoId: r.EventoID ?? "",
      nombreId: r.NombreID ?? r.NombreGlovox ?? r.EventoID ?? "—",
      fechaEvento: r.FechaEvento,
      categoria,
      totalAsistentes: asistentes,
      totalVentaTickets: ventaTickets,
      totalVentaFFBB: ventaFFBB,
      perCapitaTickets: v(r.PerCapitaTicketsVenta),
      perCapitaFFBB: v(r.PerCapitaFFyBB),
      gastoPM,
    });
  }

  const porCategoria = Array.from(catMap.values())
    .map((c) => ({
      ...c,
      perCapitaTickets: c.totalAsistentes > 0 ? c.totalVentaTickets / c.totalAsistentes : 0,
      perCapitaFFBB: c.totalAsistentes > 0 ? c.totalVentaFFBB / c.totalAsistentes : 0,
    }))
    .sort((a, b) => b.totalVentaTickets - a.totalVentaTickets);

  eventos.sort((a, b) => {
    const fa = a.fechaEvento ?? "";
    const fb = b.fechaEvento ?? "";
    return fb.localeCompare(fa);
  });

  return {
    totalEventos: rows.length,
    totalAsistentes,
    totalTicketsVendidos,
    totalVentaTickets,
    totalVentaFFBB,
    perCapitaTicketsPromedio: totalAsistentes > 0 ? totalVentaTickets / totalAsistentes : 0,
    perCapitaFFBBPromedio: totalAsistentes > 0 ? totalVentaFFBB / totalAsistentes : 0,
    gastoPMTotal,
    porCategoria,
    eventos,
  };
}
