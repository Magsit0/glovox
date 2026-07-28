import type { Config } from "drizzle-kit";

// `db:generate` only diffs schema vs existing migrations and does not need
// DATABASE_URL. `db:migrate` / `db:studio` need it in .env.local. `db:push` is
// intentionally neutralized (exit 1): the Neon DB is shared with
// glovox-operaciones and push would drop the other project's columns.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
  // Tabla de control PROPIA de glovox-data. La BD Neon es compartida con
  // glovox-operaciones; si ambos usaran el default drizzle.__drizzle_migrations,
  // el gate de "pendientes" (folderMillis > MAX(created_at)) de un proyecto
  // podría saltarse migraciones del otro. Separarlas desacopla los timelines.
  migrations: {
    table: "__drizzle_migrations_data",
    schema: "drizzle",
  },
} satisfies Config;
