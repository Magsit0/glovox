import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getGridKikiReporte } from "@/lib/reports/grid-kiki-jw";
import JwTimelineChart from "@/components/reports/grid-kiki/JwTimelineChart";
import CategoriasChart from "@/components/reports/grid-kiki/CategoriasChart";
import PerCapitaChart from "@/components/reports/grid-kiki/PerCapitaChart";
import ExportDocButton from "@/components/reports/grid-kiki/ExportDocButton";
import DownloadPdfButton from "@/components/reports/grid-kiki/DownloadPdfButton";

export const dynamic = "force-dynamic";

const fmtCLP = (v: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v: number, decimals = 0) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

const fmtPct = (v: number, decimals = 1) => `${fmtNum(v * 100, decimals)}%`;

export default async function GridKikiJwPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/reportes/grid-kiki-jw")) {
    redirect("/?unauthorized=1");
  }

  const { audiencia, evolucion, perCapita, perCapitaTotales, slotLabels, jwTimeline, stats } =
    await getGridKikiReporte();
  const kiki = perCapitaTotales[0];
  const otros = perCapitaTotales.slice(1);

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-8 py-10">
      <div className="mx-auto max-w-6xl" data-pdf-shell>
        {/* ------------------------------------------------ Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
              Reporte de experimento
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#333333]">
              Promo flash por WhatsApp · Johnnie Walker Red Label
            </h1>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              The Grid System Chile · KI/KI — sábado 9 de mayo de 2026
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3" data-no-print="true">
            <DownloadPdfButton filename="Promo WhatsApp · Johnnie Walker — The Grid KI-KI (9 may 2026)" />
            <ExportDocButton />
          </div>
        </div>

        {/* ------------------------------------------------ 0 · Contexto */}
        <div className="mt-8 grid grid-cols-12 gap-6">
          <section className="col-span-12 rounded-lg border border-[#E5E5E5] bg-white p-6 lg:col-span-7">
            <h2 className="font-display text-xl font-bold text-[#333333]">
              El experimento
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-[#333333]">
              Durante el evento se envió un WhatsApp con una promo flash de
              Johnnie Walker Red Label a todas las personas que ya estaban
              dentro de la fiesta a las 21:00 (ticket escaneado en puerta antes
              de esa hora). La promo anunciaba una ventana de solo 30 minutos —
              21:30 a 22:00 — pero el envío de tantos mensajes de WhatsApp se
              demoró más de lo esperado y el beneficio se mantuvo abierto hasta
              las 23:00.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { hora: "21:00", texto: "Envío programado del WhatsApp" },
                { hora: "21:30", texto: "Inicio de la ventana anunciada" },
                { hora: "22:00", texto: "Cierre anunciado (30 min)" },
                { hora: "23:00", texto: "Cierre real, extendido por el retraso" },
              ].map((h) => (
                <div key={h.hora} className="rounded-lg border border-[#E5E5E5] p-3">
                  <div className="font-display text-lg font-bold text-[#333333]">
                    {h.hora}
                  </div>
                  <div className="mt-1 font-sans text-xs text-[#666666]">{h.texto}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="col-span-12 rounded-lg border border-[#E5E5E5] bg-white p-6 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#333333]">
                El mensaje
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B1D750]" />
                WhatsApp · 9 may 2026
              </span>
            </div>
            <blockquote className="mt-4 rounded-lg bg-[#FAFAFA] p-4 font-sans text-sm leading-relaxed text-[#333333]">
              SOLO POR 30 minutos <strong>Johnny Walker Red Label</strong> +
              bebida 2x1 de 21:30 a 22:00, 2 por 7.000
              <span className="mt-2 block text-[#666666]">The Grid System</span>
            </blockquote>
            <p className="mt-3 font-sans text-xs text-[#999999]">
              Enviado a las {fmtNum(audiencia.audiencia21)} personas que
              ingresaron al evento antes de las 21:00.
            </p>
          </section>
        </div>

        {/* ------------------------------------------------ KPIs */}
        <div className="mt-6 grid grid-cols-12 gap-6" data-pdf-grid="kpis-4">
          <div className="col-span-12 rounded-xl bg-[#9F99F8] p-8 sm:col-span-6 lg:col-span-3">
            <div className="font-sans text-xs text-white/80">
              Personas que recibieron el mensaje
            </div>
            <div className="mt-2 font-display text-5xl font-bold leading-none text-white">
              {fmtNum(audiencia.audiencia21)}
            </div>
          </div>
          {[
            {
              label: "Venta JW en la ventana (21:30–23:00)",
              value: fmtCLP(stats.ventanaVenta),
              caption: `${fmtNum(stats.ventanaQtty)} unidades · ${fmtPct(stats.shareVentana)} del JW de la noche en 90 min`,
            },
            {
              label: `Bloque peak (${stats.peakLabel})`,
              value: `×${fmtNum(stats.multiplicadorPeak, 1)}`,
              caption: `${fmtCLP(stats.peakVenta)} · ${fmtNum(stats.peakQtty)} unidades vs. promedio pre-envío`,
            },
            {
              label: "Venta JW total de la noche",
              value: fmtCLP(stats.totalNocheVenta),
              caption: `${fmtNum(stats.totalNocheQtty)} unidades en toda la noche (categoría JW de barra)`,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="col-span-12 rounded-lg border border-[#E5E5E5] bg-white p-6 sm:col-span-6 lg:col-span-3"
            >
              <div className="font-sans text-xs text-[#666666]">{kpi.label}</div>
              <div className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
                {kpi.value}
              </div>
              <div className="mt-3 font-sans text-xs text-[#666666]">{kpi.caption}</div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------ 1 · Timeline JW */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#333333]">
            1 · La respuesta al mensaje
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            El consumo de Johnnie Walker se mantuvo plano hasta el envío y se
            disparó dentro de la ventana extendida.
          </p>
          <div className="mt-4">
            <JwTimelineChart data={jwTimeline} />
          </div>
        </div>

        {/* ------------------------------------------------ 2 · vs categorías */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#333333]">
            2 · ¿Fue la promo o fue la noche?
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Dentro de la ventana, el salto solo aparece en Johnnie Walker:
            pisco, gin y vodka no muestran nada parecido en el bloque de las
            22:30, así que el peak es efecto directo del mensaje. Después de
            las 23:00 sube el consumo de toda la barra — pisco incluido —
            porque la fiesta entra en su horario fuerte; por eso la medida
            limpia del efecto promo es la ventana, no el resto de la noche.
          </p>
          <div className="mt-4">
            <CategoriasChart
              data={evolucion.map((r) => ({
                slotLabel: r.slotLabel,
                categoria: r.categoria,
                venta: r.venta,
                qtty: r.qtty,
              }))}
              slots={slotLabels}
            />
          </div>
        </div>

        {/* ------------------------------------------------ 3 · Per cápita */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#333333]">
            3 · KI/KI vs. otros The Grid, per cápita
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Comparación justa contra Klangkuenstler y Charlotte de Witte:
            consumo de productos Johnnie Walker normalizado por asistentes.
          </p>
          <div className="mt-4 grid gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" data-pdf-grid="kpis-3">
              {perCapitaTotales.map((e) => (
                <div
                  key={e.eventoId}
                  className="rounded-lg border border-[#E5E5E5] bg-white p-6"
                >
                  <div className="font-sans text-xs text-[#666666]">{e.label}</div>
                  <div className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
                    {fmtNum(e.qttyPor1000, 1)}
                  </div>
                  <div className="mt-3 font-sans text-xs text-[#666666]">
                    unidades JW por 1.000 asistentes · {fmtCLP(e.clpPorAsistente)}{" "}
                    por asistente · {fmtNum(e.asistentes)} asistentes
                  </div>
                </div>
              ))}
            </div>
            <PerCapitaChart series={perCapita} />
          </div>
        </div>

        {/* ------------------------------------------------ 4 · Conclusiones */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#333333]">
            4 · Conclusiones y argumentos
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Lo que este experimento demuestra sobre el canal WhatsApp como
            palanca de consumo de marca dentro del evento.
          </p>

          <div className="mt-4 grid grid-cols-12 gap-6">
            {[
              {
                titulo: "La respuesta fue inmediata y atribuible al mensaje",
                texto: `El bloque peak vendió ${fmtCLP(stats.peakVenta)} en 30 minutos — ×${fmtNum(stats.multiplicadorPeak, 1)} el ritmo pre-envío. Ninguna otra categoría de barra mostró un salto en ese horario: el pico es efecto del mensaje, no de la noche.`,
              },
              {
                titulo: "90 minutos concentraron un tercio del JW de la noche",
                texto: `La ventana 21:30–23:00 generó ${fmtCLP(stats.ventanaVenta)} (${fmtPct(stats.shareVentana)} del total JW) en una noche de ${fmtNum(stats.horasBarra, 1)} horas de barra. El canal permite concentrar consumo exactamente cuando la marca lo necesita.`,
              },
              {
                titulo: "La mejor noche Johnnie Walker per cápita del ciclo The Grid",
                texto: kiki
                  ? `KI/KI cerró con ${fmtNum(kiki.qttyPor1000, 1)} unidades por 1.000 asistentes (${fmtCLP(kiki.clpPorAsistente)} por persona), sobre ${otros
                      .map((o) => `${o.label.replace("The Grid · ", "")} (${fmtNum(o.qttyPor1000, 1)})`)
                      .join(" y ")} — con menos de la mitad del aforo. Una sola intervención de 90 minutos movió el per cápita de toda la noche.`
                  : "",
              },
              {
                titulo: "Audiencia segmentada por presencia física, en tiempo real",
                texto: `El mensaje llegó solo a quienes ya estaban dentro de la fiesta (ticket escaneado antes de las 21:00): ${fmtNum(audiencia.audiencia21)} personas, cero desperdicio de impactos. En la ventana se vendieron ${fmtNum(stats.ventanaQtty)} unidades — una conversión mínima de ${fmtPct(stats.conversionVentana)} de la audiencia en 90 minutos, sin contar que varios ítems eran promos de 2 vasos.`,
              },
              {
                titulo: "El efecto es programable",
                texto: "El envío masivo se demoró más de lo esperado y corrió el peak, y aun así la respuesta fue inmediata a la recepción del mensaje: el consumo siguió al canal, no al reloj. Con envío puntual, la marca puede elegir el momento exacto del impulso — un valle de consumo, el lanzamiento de un SKU, la previa del show principal.",
              },
            ].map((c) => (
              <div
                key={c.titulo}
                className="col-span-12 rounded-lg border border-[#E5E5E5] bg-white p-6"
              >
                <h3 className="font-display text-lg font-bold text-[#333333]">
                  {c.titulo}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-[#666666]">
                  {c.texto}
                </p>
              </div>
            ))}

            <div className="col-span-12 rounded-lg border border-[#333333] bg-white p-6">
              <h3 className="font-display text-lg font-bold text-[#333333]">
                Próximos pasos propuestos
              </h3>
              <ul className="mt-3 grid gap-2 font-sans text-sm text-[#333333]">
                {[
                  "Repetir el experimento con envío puntual y ventana de 30 minutos reales, para medir el efecto sin la variable del retraso.",
                  "Testear un SKU premium (Black Label) y comparar elasticidad entre etiquetas.",
                  "A/B por segmentos de audiencia (hora de llegada, historial de consumo) para optimizar el mensaje.",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 font-sans text-xs leading-relaxed text-[#999999]">
            Metodología: venta y unidades desde el sistema de barra
            (onfire.soldItems), por bloques de 30 minutos. Análisis intra-evento
            con la categoría de barra JW; comparación histórica por nombre de
            producto Johnnie Walker, porque los eventos anteriores no usaban esa
            categoría. Per cápita = consumo / tickets escaneados en puerta.
            Las promos de 2 vasos cuentan como 1 unidad, por lo que los vasos
            servidos reales son mayores a las unidades reportadas.
          </p>
        </div>
      </div>
    </main>
  );
}
