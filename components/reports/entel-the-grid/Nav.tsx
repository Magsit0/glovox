import DownloadPdfButton from "./DownloadPdfButton";

export default function Nav({ pdfFilename }: { pdfFilename: string }) {
  return (
    <nav className="er-nav">
      <div className="er-nav-brand">
        ENTEL · <span>Reporte Activación</span>
      </div>
      <div className="er-nav-links">
        <a href="#kpis">KPIs</a>
        <a href="#flujo">Distribución</a>
        <a href="#fotos">Fotos</a>
        <a href="#cronologia">Cronología</a>
        <a href="#mejoras">Mejoras</a>
      </div>
      <div className="er-nav-actions">
        <DownloadPdfButton filename={pdfFilename} />
        <div className="er-nav-badge">CONFIDENCIAL</div>
      </div>
    </nav>
  );
}
