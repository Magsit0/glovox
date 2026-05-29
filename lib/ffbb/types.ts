export interface FfbbEventOption {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  categoriaEvento: string;
}

export interface FfbbListadoRow {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  categoriaEvento: string;
  ventas: number;
  unidades: number;
  productosUnicos: number;
  barras: number;
}

export interface FfbbKpis {
  ventas: number;
  unidades: number;
  transacciones: number;
  productosUnicos: number;
  ticketPromedio: number;
}

export interface FfbbCategoriaRow {
  categoria: string;
  ventas: number;
  unidades: number;
  sharePct: number;
}

export interface FfbbProductoRow {
  producto: string;
  ventas: number;
  unidades: number;
}

export interface FfbbBarraRow {
  nombreBarra: string;
  ventas: number;
  unidades: number;
  transacciones: number;
  ticketPromedio: number;
}

export interface FfbbEventDetail {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  categoriaEvento: string;
  kpis: FfbbKpis;
  porCategoria: FfbbCategoriaRow[];
  topProductos: FfbbProductoRow[];
  porBarra: FfbbBarraRow[];
}

export interface InsumoConsumoRow {
  nombreBarra: string;
  insumo: string;
  cantidadConsumida: number;
}

export interface EvolucionRow {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  valor: number;
}
