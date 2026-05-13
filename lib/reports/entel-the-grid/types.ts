export interface ReportMeta {
  evento: string;
  marca: string;
  fecha: string;
  fechaLarga: string;
  venue: string;
  responsable: string;
  supervisor: string;
  asistentesEstimados: number;
}

export interface ReportStock {
  inicial: number;
  metaKpi: number;
  reposicion: number;
  descuentoManual: number;
  ajustado: number;
}

export interface ReportHorario {
  inicio: string;
  cierre: string;
  peakInicio: string;
  peakTermino: string;
}

export interface ReportKpis {
  totalCanjes: number;
  stockRestante: number;
  pctStockUsado: number;
  metaAlcanzada: boolean;
  pctAvanceVsMeta: number;
  conversionEstimada: number;
  horaMayorDemanda: string;
}

export interface FlujoHora {
  hora: string;
  vasos: number;
  canjesAcum: number;
  stockRestante: number;
  pctStock: number;
  peak: boolean;
  condicion: string | null;
  observacion: string | null;
  fotos: string[];
  validadoPor: string | null;
}

export interface FlujoAgrupado {
  hora: string;
  vasos: number;
  peak: boolean;
}

export interface Incidente {
  hora: string;
  tipo: string;
  descripcion: string;
  accionTomada: string;
  seguimiento: string;
}

export interface GuardarropiaTramo {
  hora: string;
  cuposGuardados: number | null;
  cuposAcum: number;
  stockRestante: number;
  condicion: string;
  observacion: string | null;
}

export interface GuardarropiaEval {
  aspecto: string;
  detalle: string;
}

export interface GuardarropiaRecom {
  n: number;
  problema: string;
  solucion: string;
  prioridad: "ALTA" | "MEDIA" | "BAJA";
  responsable: string;
  plazo: string;
}

export interface ObjetivoEntel {
  titulo: string;
  pregunta: string;
  resultado: string;
  alcanzado: "si" | "proyeccion" | "no";
  detalle: string;
}

export interface SolucionPropuesta {
  titulo: string;
  detalle: string;
}

export interface GaleriaItem {
  src: string;
  caption: string;
  span?: "wide" | "tall";
}

export interface TimelineEvento {
  hora: string;
  tag: string;
  tone: "sky" | "blue" | "orange" | "success" | "gray";
  texto: string;
}

export interface CualitativoItem {
  icon: string;
  titulo: string;
  detalle: string;
  tone: "positive" | "projection";
}

export interface RecomendacionPlan {
  numero: string;
  titulo: string;
  detalle: string;
  prioridad: "Alta" | "Media";
}

export interface EntelReport {
  meta: ReportMeta;
  stock: ReportStock;
  horario: ReportHorario;
  kpis: ReportKpis;
  flujoPorHora: FlujoHora[];
  flujoAgrupado: FlujoAgrupado[];
  incidentes: Incidente[];
  guardarropia: {
    timeline: GuardarropiaTramo[];
    evaluacion: GuardarropiaEval[];
    recomendaciones: GuardarropiaRecom[];
  };
  objetivosEntel: ObjetivoEntel[];
  cualitativo: {
    queFunciono: CualitativoItem[];
    proyecciones: CualitativoItem[];
  };
  recomendaciones: RecomendacionPlan[];
  solucionesPropuestas: SolucionPropuesta[];
  timeline: TimelineEvento[];
  galeria: GaleriaItem[];
  conclusionEjecutiva: string;
}
