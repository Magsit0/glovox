/**
 * Snapshot the SQL fragment + params produced by the new country-based scope
 * for each (country, columnPrefix) combo, and compare against the legacy
 * ticketera-based output. Goal: ensure Phase 4 refactor produces semantically
 * identical filters (same column, same value list, same logical position).
 *
 * Param names changed (ticketeraScope → countryTicketeras) but BigQuery only
 * cares about the value bound at execution; we surface that explicitly.
 */
import { countryTicketeraFilter } from "@/lib/scopes";

type Case = { name: string; country: "CL" | "PE" | null; prefix: string };

const cases: Case[] = [
  { name: "PE / no prefix", country: "PE", prefix: "" },
  { name: "PE / t. prefix", country: "PE", prefix: "t." },
  { name: "CL / no prefix", country: "CL", prefix: "" },
  { name: "null / t. prefix", country: null, prefix: "t." },
];

// Reference: what the legacy ticketeraFilter would have emitted.
function legacy(
  ticketera: string[] | undefined,
  prefix = "",
): { sql: string; params: Record<string, unknown> } {
  if (!ticketera?.length) return { sql: "", params: {} };
  return {
    sql: ` AND ${prefix}Ticketera IN UNNEST(@ticketeraScope)`,
    params: { ticketeraScope: ticketera },
  };
}

const COUNTRY_TICKETERAS = { CL: [] as string[], PE: ["TeleTicket"] };

let ok = true;
for (const c of cases) {
  const next = countryTicketeraFilter({ country: c.country }, c.prefix);
  const tix = c.country ? COUNTRY_TICKETERAS[c.country] : undefined;
  const ref = legacy(tix?.length ? tix : undefined, c.prefix);

  // Compare structurally: same column placement, same bound values.
  const nextValues = JSON.stringify(Object.values(next.params));
  const refValues = JSON.stringify(Object.values(ref.params));
  const nextShape = next.sql.replace(/@\w+/g, "@PARAM").trim();
  const refShape = ref.sql.replace(/@\w+/g, "@PARAM").trim();

  const matches = nextShape === refShape && nextValues === refValues;
  if (!matches) ok = false;

  console.log(`▶ ${c.name}`);
  console.log(`  legacy : ${ref.sql || "(empty)"}`);
  console.log(`         params=${refValues}`);
  console.log(`  new    : ${next.sql || "(empty)"}`);
  console.log(`         params=${nextValues}`);
  console.log(`  parity : ${matches ? "✓ identical" : "✗ MISMATCH"}\n`);
}

if (!ok) {
  console.error("Some cases diverged. Phase 4 refactor changes query semantics.");
  process.exit(1);
}
console.log("All cases preserve legacy SQL semantics.");
