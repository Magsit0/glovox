/**
 * Tema claro/oscuro de dashboard.
 *
 * NO es global: solo esta activo mientras estas en una ruta que monta
 * <ThemeScope> (hoy /paid-media y /inversion-medios). El resto de los
 * dashboards nunca reciben `data-theme` y por lo tanto resuelven los tokens de
 * `:root`, que son los valores claros de siempre.
 *
 * La preferencia vive en localStorage y NO en la URL a proposito: es una
 * preferencia personal, y meterla en la query string la filtraria en cada link
 * que alguien comparta por Slack, imponiendole su tema al que lo abre.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "glovox:dashboard-theme";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark";
}

/** Rutas que ofrecen tema. Fuente unica: la usan el script de arranque y
 *  cualquier chequeo futuro. El resto de la app nunca recibe `data-theme`. */
export const THEMED_ROUTES = ["/paid-media", "/inversion-medios"] as const;

/**
 * NOTA sobre el flash inicial.
 *
 * La forma habitual de evitar que una carga directa parpadee en claro es un
 * script inline que lee localStorage antes del primer paint. Aca se descarto:
 * `next/script` con `beforeInteractive` se eleva a hijo directo de <html>, que
 * es HTML invalido, y React lo reporta como error en TODAS las rutas de la app;
 * un <script> inline en el arbol tampoco sirve, porque React avisa que no se
 * ejecuta en navegacion de cliente. Cambiar un parpadeo de un frame en dos rutas
 * por ruido de consola permanente en ~25 no compensa.
 *
 * El tema lo aplica <ThemeScope> al montar, y la transicion de 150ms sobre
 * body/main de globals.css hace que ese frame se lea como entrada y no como
 * error. En navegacion interna no hay parpadeo: el layout ya esta montado.
 */
