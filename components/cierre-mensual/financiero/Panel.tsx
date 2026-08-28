"use client";

// Mismo contenedor de panel que usa CierreMensualDashboard (allí es privado);
// las secciones de la pestaña "Análisis financiero" lo comparten desde acá.
export default function Panel({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
            {title}
          </h2>
          {subtitle && (
            <p className="font-sans text-sm text-[#666666]">{subtitle}</p>
          )}
        </div>
        {right}
      </header>
      {children}
    </article>
  );
}
