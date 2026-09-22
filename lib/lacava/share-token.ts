/**
 * Link secreto del dashboard La Cava: `/lacava?k=<LACAVA_SHARE_TOKEN>` se ve
 * sin login (pensado para el cliente externo). Es una contraseña compartida:
 * quien tenga el link entra; se revoca rotando la env var.
 *
 * Lo consultan el proxy (deja pasar la request sin sesión) y la página (modo
 * público). Comparación en tiempo constante para no filtrar el token por
 * timing. Sin token configurado, la función siempre es false y el dashboard
 * queda 100% detrás del login, como siempre.
 */
export function isValidShareToken(k: string | null | undefined): boolean {
  const expected = process.env.LACAVA_SHARE_TOKEN ?? "";
  if (!expected || expected.length < 20 || !k) return false;
  if (k.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= k.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
