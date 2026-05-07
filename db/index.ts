import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Accept DATABASE_URL or POSTGRES_URL (Neon Vercel integration uses either).
// Don't throw at module evaluation — Next.js evaluates modules during build
// even for routes that won't run. The error surfaces at the first query.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient__: ReturnType<typeof postgres> | undefined;
}

const isProduction = process.env.NODE_ENV === "production";

const client =
  global.__pgClient__ ??
  postgres(url || "postgres://localhost/placeholder", {
    ssl: url ? "require" : false,
    max: 1,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  });

if (!isProduction) {
  global.__pgClient__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
