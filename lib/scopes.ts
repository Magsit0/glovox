/**
 * Data scoping primitives used by every dashboard query.
 *
 * Replaces the old `Scope = { ticketera?: string[] }` shape with a single
 * country attribute. Each query derives the BigQuery filter (ticketera list,
 * EventoID prefix, etc.) from `scope.country` via the helpers below.
 *
 * The mappings live here, in code (not DB), because they are BigQuery model
 * metadata, not something the superadmin should edit through the admin UI.
 * Adding a Peruvian ticketera = updating COUNTRY_TICKETERAS and redeploying.
 */
import type { Country } from "@/db/schema";

export type DataScope = {
  country: Country | null;
};

/**
 * Country → list of `Ticketera` values that belong to that country in
 * `glovox.tickets`. Used by marketing queries.
 *
 * CL has no ticketera filter today: Chilean ticket data spans multiple
 * ticketeras (TicketPlus, Passline, etc.) and we don't curate them yet, so
 * we treat CL as "no extra filter" until the model needs it.
 */
export const COUNTRY_TICKETERAS: Record<Country, string[]> = {
  CL: [],
  PE: ["TeleTicket"],
};

/**
 * Country → EventoID prefix in BigQuery `glovox.tickets`. GLO* = Chile,
 * GLP* = Perú. Used by `comunidad.ts` queries.
 */
export const COUNTRY_EVENTO_PREFIX: Record<Country, string> = {
  CL: "GLO",
  PE: "GLP",
};

export type SqlFragment = {
  sql: string;
  params: Record<string, unknown>;
};

/**
 * Returns ` AND <prefix>Ticketera IN UNNEST(@countryTicketeras)` when the
 * scope has a country with a non-empty ticketera list; otherwise an empty
 * fragment. `prefix` is a column qualifier like "t." for joined queries.
 *
 * Always uses a named parameter — never SQL interpolation.
 */
export function countryTicketeraFilter(
  scope: DataScope | undefined,
  prefix = "",
): SqlFragment {
  if (!scope?.country) return { sql: "", params: {} };
  const ticketeras = COUNTRY_TICKETERAS[scope.country];
  if (ticketeras.length === 0) return { sql: "", params: {} };
  return {
    sql: ` AND ${prefix}Ticketera IN UNNEST(@countryTicketeras)`,
    params: { countryTicketeras: ticketeras },
  };
}

/**
 * Returns ` AND <alias>EventoID LIKE @countryEventoPrefix` when the scope
 * has a country; otherwise an empty fragment. `alias` is a table alias like
 * "t." (defaults to bare column).
 */
export function countryEventoIdFilter(
  scope: DataScope | undefined,
  alias = "",
): SqlFragment {
  if (!scope?.country) return { sql: "", params: {} };
  const prefix = COUNTRY_EVENTO_PREFIX[scope.country];
  return {
    sql: ` AND ${alias}EventoID LIKE @countryEventoPrefix`,
    params: { countryEventoPrefix: `${prefix}%` },
  };
}

export function hasCountryScope(scope: DataScope | undefined): boolean {
  return !!scope?.country;
}
