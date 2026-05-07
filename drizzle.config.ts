import type { Config } from "drizzle-kit";

// `db:generate` only diffs schema vs existing migrations and does not need
// DATABASE_URL. `db:migrate` / `db:push` / `db:studio` will fail loudly with
// the empty string until the env var is provided in .env.local.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
} satisfies Config;
