/**
 * Estado global del feedback de navegación (barra superior + spinner en lo que
 * se clickeó). Lo pinta <NavigationFeedback> en el layout raíz; lo alimentan dos
 * entradas:
 *
 *  - Clicks en <a href> internos (los <Link> de Next incluidos), que el propio
 *    <NavigationFeedback> escucha en document.
 *  - router.push / router.replace, vía el useRouter de lib/use-router.ts, que es
 *    el único que los dashboards deben importar.
 *
 * Es un módulo plano (sin React) para que ambas entradas compartan el mismo
 * estado sin providers.
 */

export interface NavigationState {
  /** Sube en cada navegación nueva, para descartar timers de la anterior. */
  id: number;
  pending: boolean;
  /** Elemento que disparó la navegación; recibe el spinner. */
  source: Element | null;
}

type Listener = (state: NavigationState) => void;

let state: NavigationState = { id: 0, pending: false, source: null };
const listeners = new Set<Listener>();

/** Último elemento interactivo tocado: es la fuente de un router.push posterior. */
let lastInteraction: { el: Element; at: number } | null = null;
const INTERACTION_WINDOW_MS = 1500;

function emit(next: NavigationState) {
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function subscribeNavigation(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recordInteraction(el: Element) {
  lastInteraction = { el, at: Date.now() };
}

/**
 * Navegaciones que no cambian la URL de la app no se marcan: Next no hace commit
 * de nada y el feedback quedaría colgado. Tampoco las descargas (/api/…, rutas
 * con extensión de archivo), que no navegan.
 */
function isAppNavigation(url: URL): boolean {
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return false;
  const current = window.location.pathname + window.location.search;
  return url.pathname + url.search !== current;
}

/**
 * Marca el inicio de una navegación. `source` es el elemento que la disparó; si
 * no viene (router.push), se usa el último elemento clickeado si fue reciente.
 */
export function startNavigation(href: string | URL, source?: Element | null) {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  if (!isAppNavigation(url)) return;

  let el = source ?? null;
  if (!el && lastInteraction && Date.now() - lastInteraction.at < INTERACTION_WINDOW_MS) {
    el = lastInteraction.el;
  }
  if (el && !el.isConnected) el = null;

  emit({ id: state.id + 1, pending: true, source: el });
}

export function finishNavigation() {
  if (!state.pending) return;
  emit({ id: state.id, pending: false, source: null });
}
