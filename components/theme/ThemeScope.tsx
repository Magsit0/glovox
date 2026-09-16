"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

/** Evento propio: `storage` solo avisa a las OTRAS pestañas, nunca a la que
 *  escribió. Sin esto, el switch no se re-renderizaría al hacer click. */
const EVENTO = "glovox:theme-change";

function leer(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : "light";
  } catch {
    // Ventana privada o almacenamiento bloqueado: el tema sigue siendo usable
    // en esta página, solo no se recuerda.
    return "light";
  }
}

function suscribir(onChange: () => void): () => void {
  window.addEventListener(EVENTO, onChange);
  // `storage` mantiene sincronizadas dos pestañas abiertas en el dashboard.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Tema activo.
 *
 * Va por `useSyncExternalStore` y no por `useState` + efecto porque
 * `localStorage` ES un store externo: el servidor no puede leerlo, así que
 * cualquier lectura durante el render produciría un HTML distinto al del cliente
 * y rompería la hidratación. Este hook existe exactamente para eso — declara un
 * snapshot de servidor ("light") separado del snapshot de cliente.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(suscribir, leer, () => "light");
}

export function setTheme(next: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Sin persistencia igual queremos que el cambio surta efecto ahora.
  }
  window.dispatchEvent(new Event(EVENTO));
}
