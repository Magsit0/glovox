import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { REPORT } from "@/lib/reports/entel-the-grid/data";
import Nav from "@/components/reports/entel-the-grid/Nav";
import Hero from "@/components/reports/entel-the-grid/Hero";
import KpiStrip from "@/components/reports/entel-the-grid/KpiStrip";
import FlujoChart from "@/components/reports/entel-the-grid/FlujoChart";
import StockDonut from "@/components/reports/entel-the-grid/StockDonut";
import StockProgress from "@/components/reports/entel-the-grid/StockProgress";
import GuardarropiaTimeline from "@/components/reports/entel-the-grid/GuardarropiaTimeline";
import Gallery from "@/components/reports/entel-the-grid/Gallery";
import Cronologia from "@/components/reports/entel-the-grid/Cronologia";
import Cualitativo from "@/components/reports/entel-the-grid/Cualitativo";
import KpisEntel from "@/components/reports/entel-the-grid/KpisEntel";
import Recomendaciones from "@/components/reports/entel-the-grid/Recomendaciones";
import FichaTecnica from "@/components/reports/entel-the-grid/FichaTecnica";

export const dynamic = "force-dynamic";

export default async function EntelTheGridPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/reportes/entel-the-grid")) {
    redirect("/?unauthorized=1");
  }

  return (
    <>
      <Nav />
      <Hero report={REPORT} />
      <div className="er-main">
        <KpiStrip report={REPORT} />

        <div className="er-section-title" id="flujo">
          Flujo de activación por hora
        </div>
        <div className="er-grid-65-35">
          <FlujoChart report={REPORT} />
          <StockDonut report={REPORT} />
        </div>

        <div className="er-grid-2 er-mb-28">
          <StockProgress />
          <GuardarropiaTimeline report={REPORT} />
        </div>

        <div className="er-section-title" id="fotos">
          Galería fotográfica del evento
        </div>
        <div className="er-gallery-head">
          <div className="er-gallery-head-l">
            Registro visual — {REPORT.meta.evento} · {REPORT.meta.fechaLarga}
          </div>
          <div className="er-gallery-head-r">
            {REPORT.galeria.length} fotografías · haz clic para ampliar
          </div>
        </div>
        <Gallery items={REPORT.galeria} />

        <div className="er-section-title" id="cronologia">
          Cronología del evento
        </div>
        <Cronologia report={REPORT} />

        <div className="er-section-title">Análisis cualitativo</div>
        <Cualitativo report={REPORT} />

        <div className="er-section-title">Evaluación de objetivos Entel</div>
        <KpisEntel report={REPORT} />

        <div className="er-section-title" id="mejoras">
          Plan de mejoras · Próximo evento
        </div>
        <Recomendaciones report={REPORT} />

        <div className="er-section-title">Datos generales del evento</div>
        <FichaTecnica report={REPORT} />
      </div>

      <div className="er-footer">
        <strong>Entel · Reporte de Activación</strong> &nbsp;·&nbsp; {REPORT.meta.evento} &nbsp;·&nbsp;{" "}
        {REPORT.meta.venue}, Santiago &nbsp;·&nbsp; {REPORT.meta.fechaLarga} &nbsp;·&nbsp; Documento interno de
        gestión de marca
      </div>
    </>
  );
}
