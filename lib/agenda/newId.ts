/**
 * Id único para ítems de la agenda, con fallback: `crypto.randomUUID` solo existe
 * en contexto seguro (HTTPS o localhost). Si el panel se sirve por HTTP plano
 * (p. ej. por IP de LAN) no existe; caemos a un id razonablemente único (basta con
 * serlo dentro de un día). Se usa al crear ítems y, defensivamente, al mover un
 * ítem a otro día si por algún motivo su id ya existiera allí.
 */
export function newId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    /* contexto no seguro: usar fallback */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
