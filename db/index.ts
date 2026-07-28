import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// Driver serverless de Neon (WebSocket Pool). A diferencia de postgres-js, no
// mantiene un socket TCP long-lived que Neon recicla al suspender el compute
// (la causa de los `write CONNECTION_CLOSED` en dev). En runtime Node —el que
// usa el proxy y los route handlers— hay que proveerle el WebSocket.
neonConfig.webSocketConstructor = ws;

// Accept DATABASE_URL or POSTGRES_URL (Neon Vercel integration uses either).
// No tirar en evaluación de módulo: Next.js evalúa módulos en build incluso
// para rutas que no corren. El error sale en la primera query.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

declare global {
  var __pgPool__: Pool | undefined;
}

const isProduction = process.env.NODE_ENV === "production";

const pool =
  global.__pgPool__ ??
  new Pool({ connectionString: url || "postgres://localhost/placeholder" });

if (!isProduction) {
  global.__pgPool__ = pool;
}

export const db = drizzle({ client: pool, schema });
export { schema };
