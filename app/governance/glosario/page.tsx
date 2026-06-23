import { Eye, Table2 } from "lucide-react";
import {
  ALL_AREAS,
  ALL_STATUSES,
  AREA_COLOR,
  AREA_LABEL,
  JOB_META,
  STATUS_META,
  type JobStatus,
} from "@/lib/governance/format";
import {
  CHECK_META,
  DIMENSIONS,
  LEVEL_META,
  WEIGHT,
  type CheckStatus,
  type DimensionKey,
  type ScoreLevel,
} from "@/lib/governance/quality";

type Row = { dot?: string; badge?: React.ReactNode; term: string; desc: string };

function Section({ title, subtitle, rows }: { title: string; subtitle?: string; rows: Row[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[#333333]">{title}</h2>
        {subtitle && <p className="mt-0.5 font-sans text-sm text-[#666666]">{subtitle}</p>}
      </div>
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.term}
            className="flex items-start gap-3 border-b border-[#F0F0F0] py-2.5 last:border-0"
          >
            <div className="flex w-32 shrink-0 items-center gap-2">
              {r.dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.dot }} />}
              {r.badge}
              <dt className="font-sans text-sm font-medium text-[#333333]">{r.term}</dt>
            </div>
            <dd className="font-sans text-sm text-[#666666]">{r.desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const CHECK_DESC: Record<CheckStatus, string> = {
  ok: "El check pasó sin observaciones.",
  warn: "Pasó pero con algo que conviene revisar (cuenta como medio punto).",
  fail: "El check falló (cuenta como cero).",
  na: "No aplica o no se pudo evaluar; se excluye del cálculo del score.",
};

const LEVEL_DESC: Record<ScoreLevel, string> = {
  ok: "Score ≥ 85. La tabla pasa sus checks aplicables.",
  warn: "Score 50–84. Tiene alertas que revisar.",
  bad: "Score < 50. Falla checks importantes (ej. no existe).",
  na: "Sin score: ningún check aplica (vistas) o BigQuery no respondió.",
};

const JOB_DESC: Record<JobStatus, string> = {
  running: "La tabla cargó dentro de su SLA (≤48h). El pipeline está corriendo.",
  stopped: "La tabla existe pero sus datos están viejos: el job no está corriendo.",
  never: "La tabla no existe en BigQuery: el pipeline nunca cargó.",
  na: "Vista (en vivo) o frescura desconocida.",
};

export default function GovernanceGlosarioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Glosario</h1>
        <p className="font-sans text-sm text-[#666666]">
          Qué significa cada métrica, estado y color que aparece en las vistas de
          gobierno de datos.
        </p>
      </div>

      <Section
        title="Estado de gobernanza"
        subtitle="Aparece en Catálogo y Flujo (color del borde de la tabla)."
        rows={ALL_STATUSES.map((s) => ({
          dot: STATUS_META[s].dot,
          term: STATUS_META[s].label,
          desc: STATUS_META[s].help,
        }))}
      />

      <Section
        title="Dimensiones de calidad"
        subtitle="Los 4 checks en vivo (solo metadata, sin escanear datos). El peso es su aporte al score."
        rows={DIMENSIONS.map((d) => ({
          badge: (
            <span className="rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-1.5 py-0.5 font-sans text-xs text-[#666666] tabular-nums">
              {Math.round(WEIGHT[d.key as DimensionKey] * 100)}%
            </span>
          ),
          term: d.label,
          desc: d.help,
        }))}
      />

      <Section
        title="Resultado de un check"
        subtitle="El color de cada punto en la matriz de Calidad."
        rows={(["ok", "warn", "fail", "na"] as CheckStatus[]).map((s) => ({
          dot: CHECK_META[s].color,
          term: CHECK_META[s].label,
          desc: CHECK_DESC[s],
        }))}
      />

      <Section
        title="Score y nivel"
        subtitle="Score = promedio ponderado de los checks aplicables (los n/a no penalizan ni suman)."
        rows={(["ok", "warn", "bad", "na"] as ScoreLevel[]).map((l) => ({
          dot: LEVEL_META[l].color,
          term: LEVEL_META[l].label,
          desc: LEVEL_DESC[l],
        }))}
      />

      <Section
        title="Job diario"
        subtitle="En ETLs. Se DERIVA de la frescura real, no se declara a mano."
        rows={(["running", "stopped", "never", "na"] as JobStatus[]).map((j) => ({
          dot: JOB_META[j].tone === "ok" ? "#7FB52B" : JOB_META[j].tone === "bad" ? "#ED75A0" : "#999999",
          term: JOB_META[j].label === "—" ? "n/a" : JOB_META[j].label,
          desc: JOB_DESC[j],
        }))}
      />

      <Section
        title="Tipo de activo"
        rows={[
          {
            badge: <Table2 className="h-4 w-4 shrink-0 text-[#999999]" aria-hidden />,
            term: "Tabla",
            desc: "Tabla física en BigQuery, con filas y almacenamiento propios.",
          },
          {
            badge: <Eye className="h-4 w-4 shrink-0 text-[#999999]" aria-hidden />,
            term: "Vista",
            desc: "Consulta guardada (mart) que se calcula en vivo; no tiene frescura ni volumen propios.",
          },
        ]}
      />

      <Section
        title="Áreas"
        subtitle="El dominio de negocio de cada fuente y tabla; filtra todas las vistas."
        rows={ALL_AREAS.map((a) => ({
          dot: AREA_COLOR[a],
          term: AREA_LABEL[a],
          desc: `Activos del área de ${AREA_LABEL[a].toLowerCase()}.`,
        }))}
      />

      <Section
        title="Términos generales"
        subtitle="Conceptos que aparecen en múltiples vistas."
        rows={[
          {
            term: "SLA",
            desc: "Service Level Agreement — la promesa de frecuencia de carga declarada en el manifiesto (ej. daily, hourly). Si una tabla dice «daily», el SLA exige que haya cargado en las últimas 48 h. Si no tiene frecuencia declarada, el check de frescura queda como n/a.",
          },
          {
            term: "FQN",
            desc: "Fully Qualified Name — el nombre completo de una tabla: «conjunto_de_datos.nombre_tabla» (ej. google_analytics.funnel_steps). Es la clave única de cada activo en el catálogo.",
          },
          {
            term: "Manifiesto",
            desc: "Archivo declarativo (manifest.yaml en data-governance/catalog/) que describe qué tablas deberían existir, quién las produce y quién las consume. Es la fuente de verdad del catálogo; las vistas de gobernanza lo cruzan con BigQuery en vivo.",
          },
          {
            term: "Schema versionado",
            desc: "Contrato de columnas y tipos que se guarda junto al manifiesto (schemas/bigquery/<tabla>.json). El check de schema compara este contrato con las columnas reales en BigQuery para detectar drift.",
          },
          {
            term: "Drift",
            desc: "Desviación entre el schema versionado y el real en BigQuery: columnas que desaparecieron, cambiaron de tipo o aparecieron sin declarar. El check de schema lo detecta automáticamente.",
          },
          {
            term: "Legacy",
            desc: "Tabla que existe y se consume en producción pero no tiene productor conocido ni contrato de schema. Aparece como «legacy sin gobernar» (rojo) en el catálogo.",
          },
        ]}
      />
    </div>
  );
}
