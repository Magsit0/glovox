"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/use-router";

/**
 * Query string de una barra de filtros que vive en la URL, y cómo cambiarlo.
 *
 * Next confirma la URL nueva (y `useSearchParams`) recién cuando termina la
 * navegación, que en los dashboards espera al servidor. Sin esto, dos cambios
 * seguidos (dos eventos, o Categoría y después Temporada) se pisan: el segundo
 * se arma sobre la URL vieja y deshace el primero. Mientras la navegación no se
 * confirma, `search` es el último query pedido, así los cambios se suman.
 *
 * El pedido pendiente se comparte entre TODAS las instancias de la misma ruta:
 * dos controles separados de una página (ej. Trimestre y Red social, o un
 * filtro y el switch neto/bruto) parten del mismo último pedido aunque cada uno
 * llame a su propio `useQueryFiltros`.
 *
 * Toda barra de filtros por URL arma sus cambios sobre este `search` (nunca
 * sobre `useSearchParams()` directo) y navega con `navegar`.
 */
export function useQueryFiltros(path: string): {
  search: string;
  navegar: (qs: string) => void;
} {
  const router = useRouter();
  const urlSearch = useSearchParams().toString();
  const urlRef = useRef(urlSearch);
  useEffect(() => {
    urlRef.current = urlSearch;
  }, [urlSearch]);

  const pedido = useSyncExternalStore(
    subscribe,
    () => pedidos.get(path) ?? null,
    () => null,
  );
  const pendiente = pedido !== null && sigue(pedido, urlSearch);

  // Pedido terminado (llegó a la URL, o llegó una URL ajena: atrás/adelante,
  // un link): se descarta para todas las instancias.
  useEffect(() => {
    if (pedido && !pendiente && pedidos.get(path) === pedido) {
      pedidos.delete(path);
      emit();
    }
  }, [path, pedido, pendiente]);

  // Al salir de la ruta (se desmonta la última instancia) no queda nada
  // pendiente: volver a la página no debe revivir un pedido viejo.
  useEffect(() => {
    montadas.set(path, (montadas.get(path) ?? 0) + 1);
    return () => {
      const n = (montadas.get(path) ?? 1) - 1;
      if (n > 0) {
        montadas.set(path, n);
        return;
      }
      montadas.delete(path);
      if (pedidos.delete(path)) emit();
    };
  }, [path]);

  function navegar(qs: string) {
    const url = urlRef.current;
    const previo = pedidos.get(path);
    if (qs === url) {
      // Volver a la URL confirmada no deja nada pendiente (Next no la cambia).
      pedidos.delete(path);
    } else if (previo && sigue(previo, url)) {
      pedidos.set(path, { qs, base: previo.base, previos: [...previo.previos, previo.qs] });
    } else {
      pedidos.set(path, { qs, base: url, previos: [] });
    }
    emit();
    router.push(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  return { search: pendiente ? pedido.qs : urlSearch, navegar };
}

/**
 * Último query pedido de una ruta. `base` es la URL confirmada desde la que
 * salió el primer pedido de la cadena; `previos`, los pedidos que el último
 * reemplazó (Next descarta la navegación pendiente cuando sale otra).
 */
type Pedido = { qs: string; base: string; previos: readonly string[] };

const pedidos = new Map<string, Pedido>();
const montadas = new Map<string, number>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * ¿El pedido sigue esperando a la navegación? Sí mientras la URL confirmada sea
 * todavía la base o un pedido anterior al último (se confirmó antes de que
 * saliera el siguiente). Si es el último pedido, o una URL ajena, terminó.
 */
function sigue(p: Pedido, url: string): boolean {
  return p.qs !== url && (url === p.base || p.previos.includes(url));
}
