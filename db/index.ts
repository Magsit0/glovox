import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

declare global {
  // eslint-disable-next-line no-var
  var __pgClient__: ReturnType<typeof postgres> | undefined;
}

// Neon requires SSL; set it explicitly so postgres-js picks it up even if
// the DATABASE_URL doesn't include sslmode=require.
const isProduction = process.env.NODE_ENV === "production";

// One client per process. In dev, reuse across HMR reloads to avoid
// exhausting Neon connections.
const client =
  global.__pgClient__ ??
  postgres(url, {
    ssl: "require",
    max: 1,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {}, // silence NOTICE messages
  });

if (!isProduction) {
  global.__pgClient__ = client;
}

export const db = drizzle(client, { schema });
export { schema };
