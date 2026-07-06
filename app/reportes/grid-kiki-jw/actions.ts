"use server";

import { auth } from "@/lib/auth";
import { getDriveClient } from "@/lib/google-drive";
import { getGridKikiReporte } from "@/lib/reports/grid-kiki-jw";

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

const fmtPct = (v: number) => `${fmtNum(v * 100, 1)}%`;

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function buildHtml(r: Awaited<ReturnType<typeof getGridKikiReporte>>): string {
  const { audiencia, stats, perCapitaTotales } = r;
  const kiki = perCapitaTotales[0];
  const otros = perCapitaTotales.slice(1);

  const conclusiones: Array<[string, string]> = [
    [
      "La respuesta fue inmediata y atribuible al mensaje",
      `El bloque peak vendió ${fmtCLP(stats.peakVenta)} en 30 minutos — ×${fmtNum(stats.multiplicadorPeak, 1)} el ritmo pre-envío. Ninguna otra categoría de barra mostró un salto en ese horario: el pico es efecto del mensaje, no de la noche.`,
    ],
    [
      "90 minutos concentraron un tercio del JW de la noche",
      `La ventana 21:30–23:00 generó ${fmtCLP(stats.ventanaVenta)} (${fmtPct(stats.shareVentana)} del total JW) en una noche de ${fmtNum(stats.horasBarra, 1)} horas de barra. El canal permite concentrar consumo exactamente cuando la marca lo necesita.`,
    ],
    [
      "La mejor noche Johnnie Walker per cápita del ciclo The Grid",
      kiki
        ? `KI/KI cerró con ${fmtNum(kiki.qttyPor1000, 1)} unidades por 1.000 asistentes (${fmtCLP(kiki.clpPorAsistente)} por persona), sobre ${otros
            .map((o) => `${o.label.replace("The Grid · ", "")} (${fmtNum(o.qttyPor1000, 1)})`)
            .join(" y ")} — con menos de la mitad del aforo. Una sola intervención de 90 minutos movió el per cápita de toda la noche.`
        : "",
    ],
    [
      "Audiencia segmentada por presencia física, en tiempo real",
      `El mensaje llegó solo a quienes ya estaban dentro de la fiesta (ticket escaneado antes de las 21:00): ${fmtNum(audiencia.audiencia21)} personas, cero desperdicio de impactos. En la ventana se vendieron ${fmtNum(stats.ventanaQtty)} unidades — una conversión mínima de ${fmtPct(stats.conversionVentana)} de la audiencia en 90 minutos, sin contar que varios ítems eran promos de 2 vasos.`,
    ],
    [
      "El efecto es programable",
      "El envío masivo se demoró más de lo esperado y corrió el peak, y aun así la respuesta fue inmediata a la recepción del mensaje: el consumo siguió al canal, no al reloj. Con envío puntual, la marca puede elegir el momento exacto del impulso — un valle de consumo, el lanzamiento de un SKU, la previa del show principal.",
    ],
  ];

  const filasPerCapita = perCapitaTotales
    .map(
      (e) => `<tr>
        <td>${esc(e.label)}</td>
        <td>${fmtNum(e.asistentes)}</td>
        <td>${fmtNum(e.qttyPor1000, 1)}</td>
        <td>${fmtCLP(e.clpPorAsistente)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <h1>Promo flash por WhatsApp · Johnnie Walker Red Label</h1>
  <p><em>The Grid System Chile · KI/KI — sábado 9 de mayo de 2026 · Reporte de experimento</em></p>

  <h2>El experimento</h2>
  <p>Durante el evento se envió un WhatsApp con una promo flash de Johnnie Walker Red Label a todas las personas que ya estaban dentro de la fiesta a las 21:00 (ticket escaneado en puerta antes de esa hora). La promo anunciaba una ventana de solo 30 minutos — 21:30 a 22:00 — pero el envío de tantos mensajes de WhatsApp se demoró más de lo esperado y el beneficio se mantuvo abierto hasta las 23:00.</p>
  <ul>
    <li><strong>21:00</strong> — Envío programado del WhatsApp</li>
    <li><strong>21:30</strong> — Inicio de la ventana anunciada</li>
    <li><strong>22:00</strong> — Cierre anunciado (30 min)</li>
    <li><strong>23:00</strong> — Cierre real, extendido por el retraso</li>
  </ul>

  <h2>El mensaje</h2>
  <blockquote>SOLO POR 30 minutos <strong>Johnny Walker Red Label</strong> + bebida 2x1 de 21:30 a 22:00, 2 por 7.000<br/>The Grid System</blockquote>
  <p>Enviado a las ${fmtNum(audiencia.audiencia21)} personas que ingresaron al evento antes de las 21:00.</p>

  <h2>Resultados clave</h2>
  <ul>
    <li><strong>${fmtNum(audiencia.audiencia21)}</strong> personas recibieron el mensaje.</li>
    <li><strong>${fmtCLP(stats.ventanaVenta)}</strong> de venta JW en la ventana 21:30–23:00 (${fmtNum(stats.ventanaQtty)} unidades · ${fmtPct(stats.shareVentana)} del JW de la noche en 90 minutos).</li>
    <li>Bloque peak (${esc(stats.peakLabel)}): <strong>×${fmtNum(stats.multiplicadorPeak, 1)}</strong> vs. el promedio pre-envío (${fmtCLP(stats.peakVenta)} · ${fmtNum(stats.peakQtty)} unidades en 30 minutos).</li>
    <li>Venta JW total de la noche: <strong>${fmtCLP(stats.totalNocheVenta)}</strong> (${fmtNum(stats.totalNocheQtty)} unidades).</li>
  </ul>

  <h2>Comparación per cápita entre eventos The Grid</h2>
  <p>Consumo de productos Johnnie Walker normalizado por asistentes de cada evento.</p>
  <table border="1" cellspacing="0" cellpadding="6">
    <tr><th>Evento</th><th>Asistentes</th><th>Unidades JW por 1.000</th><th>CLP por asistente</th></tr>
    ${filasPerCapita}
  </table>

  <h2>Conclusiones y argumentos</h2>
  ${conclusiones.map(([t, x]) => `<h3>${esc(t)}</h3><p>${esc(x)}</p>`).join("")}

  <h2>Próximos pasos propuestos</h2>
  <ul>
    <li>Repetir el experimento con envío puntual y ventana de 30 minutos reales, para medir el efecto sin la variable del retraso.</li>
    <li>Testear un SKU premium (Black Label) y comparar elasticidad entre etiquetas.</li>
    <li>A/B por segmentos de audiencia (hora de llegada, historial de consumo) para optimizar el mensaje.</li>
  </ul>

  <h2>Metodología</h2>
  <p>Venta y unidades desde el sistema de barra (onfire.soldItems), por bloques de 30 minutos. Análisis intra-evento con la categoría de barra JW; comparación histórica por nombre de producto Johnnie Walker, porque los eventos anteriores no usaban esa categoría. Per cápita = consumo / tickets escaneados en puerta. Las promos de 2 vasos cuentan como 1 unidad, por lo que los vasos servidos reales son mayores a las unidades reportadas. Los gráficos interactivos viven en el dashboard interno: /reportes/grid-kiki-jw.</p>
  </body></html>`;
}

export type ExportarDocResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Genera el reporte como Google Doc (HTML convertido por Drive) y lo comparte
 * con quien lo pidió + con el dominio. Devuelve la URL para abrirlo.
 */
export async function exportarGoogleDoc(): Promise<ExportarDocResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: "Debes iniciar sesión de nuevo." };

  try {
    const reporte = await getGridKikiReporte();
    const drive = getDriveClient();
    // Los service accounts no tienen almacenamiento propio en Drive, así que
    // el doc debe crearse dentro de una carpeta de Unidad Compartida a la que
    // el SA tenga acceso como Gestor de contenido.
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const { data: file } = await drive.files.create({
      requestBody: {
        name: "Promo WhatsApp · Johnnie Walker — The Grid KI/KI (9 may 2026)",
        mimeType: "application/vnd.google-apps.document",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: { mimeType: "text/html", body: buildHtml(reporte) },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    if (!file.id || !file.webViewLink) {
      return { ok: false, error: "Drive no devolvió la URL del documento." };
    }

    // Compartir con quien exporta (siempre) y con el dominio (best-effort).
    await drive.permissions.create({
      fileId: file.id,
      sendNotificationEmail: false,
      supportsAllDrives: true,
      requestBody: { type: "user", role: "writer", emailAddress: email },
    });
    const domain = process.env.ALLOWED_DOMAIN;
    if (domain) {
      try {
        await drive.permissions.create({
          fileId: file.id,
          supportsAllDrives: true,
          requestBody: { type: "domain", role: "writer", domain },
        });
      } catch {
        // El doc igual queda compartido con quien lo exportó.
      }
    }

    return { ok: true, url: file.webViewLink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[grid-kiki-jw] exportarGoogleDoc:", msg);
    if (msg.includes("has not been used") || msg.includes("is disabled")) {
      return {
        ok: false,
        error:
          "La API de Google Drive no está habilitada para el service account. Habilítala en el proyecto GCP e intenta de nuevo.",
      };
    }
    if (msg.includes("quota") || msg.includes("Quota")) {
      return {
        ok: false,
        error: `Falta configurar la carpeta destino: crea una carpeta en una Unidad Compartida de Drive, compártela como "Gestor de contenido" con ${saEmail() ?? "el service account"} y define GOOGLE_DRIVE_FOLDER_ID con el ID de esa carpeta.`,
      };
    }
    return { ok: false, error: "No se pudo crear el documento. Intenta de nuevo." };
  }
}

/** Email del service account, para instrucciones de configuración (no es secreto). */
function saEmail(): string | null {
  try {
    const raw =
      process.env.SHEETS_SERVICE_ACCOUNT ?? process.env.BIGQUERY_SERVICE_ACCOUNT;
    if (!raw) return null;
    const creds = JSON.parse(raw) as { client_email?: string };
    return creds.client_email ?? null;
  } catch {
    return null;
  }
}
