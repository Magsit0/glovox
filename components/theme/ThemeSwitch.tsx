"use client";

import { useEffect } from "react";
import { setTheme, useTheme } from "@/components/theme/ThemeScope";
import type { Theme } from "@/lib/theme";

/**
 * Switch día/noche. Aplica el tema Y lo renderiza: poner este componente en una
 * ruta deja todo cableado.
 *
 * El efecto que escribe `data-theme` vivía en un <ThemeScope> aparte que este
 * componente renderizaba como hijo. Se fusionó por simplicidad: eran dos
 * componentes con hooks donde bastaba uno, y este siempre montaba al otro.
 */
export default function ThemeSwitch() {
  const theme = useTheme();

  // Aplica el tema a <html> mientras está montado y lo RETIRA al desmontarse.
  // Esa limpieza es lo que hace el tema por RUTA y no global: al navegar a otro
  // dashboard el layout se desmonta, el atributo desaparece y la app vuelve a
  // los tokens claros de `:root`. Va en <html> y no en un div envolvente porque
  // el fondo de página lo pinta <body>.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  const opciones: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Día", icon: <SunIcon /> },
    { id: "dark", label: "Noche", icon: <MoonIcon /> },
  ];

  return (
    <section className="flex items-center gap-2">
      <span className="font-sans text-xs text-[var(--ink-muted)]">Tema</span>
      <div
        role="group"
        aria-label="Tema del dashboard"
        className="inline-flex gap-1 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-1"
      >
        {opciones.map((o) => {
          const activo = theme === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setTheme(o.id)}
              aria-pressed={activo}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-sans text-xs font-medium transition-colors ${
                activo
                  ? "bg-[var(--purple-tint)] text-[#9F99F8]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v1.2M8 13.3v1.2M14.5 8h-1.2M2.7 8H1.5M12.6 3.4l-.85.85M4.25 11.75l-.85.85M12.6 12.6l-.85-.85M4.25 4.25l-.85-.85"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none">
      <path
        d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
