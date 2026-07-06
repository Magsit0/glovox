/**
 * Tipo + parser del switch neto/bruto de los dashboards de finanzas.
 *
 * Vive en un módulo PLANO (sin "use client") a propósito: las páginas server
 * (/proveedor, /fds, /cierre-*) leen el searchParam `monto` y llaman
 * `montoModeFrom()` durante el render en el servidor. Un helper exportado desde
 * un módulo "use client" (como MontoModeToggle.tsx) es un "client entry point"
 * y NO puede invocarse desde el server (solo renderizarse como componente) —
 * hacerlo lanza "Attempted to call ... from the server but ... is on the client".
 * El componente interactivo `MontoModeToggle` sigue en su propio archivo client.
 */

export type MontoMode = "neto" | "bruto";

/** Parseo seguro del searchParam `monto` (default: neto). */
export function montoModeFrom(v: string | string[] | undefined | null): MontoMode {
  return v === "bruto" ? "bruto" : "neto";
}
