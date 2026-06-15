/**
 * Reintento ante cold-start de Neon serverless.
 *
 * Tras ~5 min de idle Neon suspende el compute; el cliente postgres-js
 * (db/index.ts, max:1) cachea una conexión TCP que el server ya cerró, y la
 * siguiente query tira `CONNECTION_CLOSED`. El wake del compute tarda varios
 * segundos, así que un reintento instantáneo no alcanza: reintentamos con
 * backoff creciente (0.3s → 1s → 2.5s). Solo reintenta errores de conexión;
 * cualquier otro propaga al toque.
 *
 * Es un parche para DEV (clicks esporádicos = Neon casi siempre frío). En prod
 * (Vercel) Neon queda caliente con tráfico real. Si reaparece bajo uso normal,
 * el fix de raíz es migrar db/index.ts al driver @neondatabase/serverless
 * (WebSocket Pool, soporta transacciones).
 */
const NEON_RETRYABLE =
  /CONNECTION_CLOSED|connection.terminated|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up|Connection ended/i;
const NEON_BACKOFF_MS = [300, 1000, 2500];

export async function withNeonRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= NEON_BACKOFF_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      const isLast = attempt === NEON_BACKOFF_MS.length;
      if (isLast || !NEON_RETRYABLE.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, NEON_BACKOFF_MS[attempt]));
    }
  }
  throw lastErr;
}
