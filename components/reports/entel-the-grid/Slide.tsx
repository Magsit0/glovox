/**
 * Agrupa bloques del reporte en una lámina del PDF (formato presentación 16:9).
 * En pantalla no genera caja (display: contents), así que el layout del
 * microsite no cambia; las reglas de lámina viven en el @media print de report.css.
 */
export default function Slide({
  footer,
  children,
}: {
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <div className="er-slide" data-footer={footer}>
      {children}
    </div>
  );
}
