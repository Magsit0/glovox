/**
 * Alcance de datos por país (`users.country`), usado por las queries de los
 * dashboards con `appliesCountryScope`.
 *
 * Criterio: un usuario con país ve SOLO los eventos de ese país, y de esos
 * eventos ve todo. El país de un evento es `Pais` en BigQuery
 * `glovox.categoriaEvento`. No sale de la ticketera (FeverUp vende en Chile y
 * en Perú) ni del prefijo del EventoID (los IDs de Fever son numéricos:
 * 777904 = Piknic 2 PE 26-27). Hasta 2026-11-04 PE se filtraba por
 * `Ticketera = 'TeleTicket'` y los usuarios PE no veían los eventos de Lima
 * que venden por Fever.
 *
 * Un usuario sin país (null) ve todo: el fragmento queda vacío y la SQL es
 * idéntica a la de antes.
 */
import type { Country } from "@/db/schema";

export type DataScope = {
  country: Country | null;
};

export type SqlFragment = {
  sql: string;
  params: Record<string, unknown>;
};

/**
 * Devuelve ` AND <column> IN (SELECT EventoID FROM categoriaEvento WHERE Pais = @scopePais)`
 * cuando el scope tiene país; si no, un fragmento vacío.
 *
 * `column` es la columna de EventoID de la fila que se filtra, calificada si la
 * query tiene joins (`"t.EventoID"`) o con su propio nombre en los marts GA4
 * (`"evento_id"`). Es siempre una constante del código, nunca input del
 * usuario; el país va como parámetro nombrado.
 *
 * El filtro es por evento: un evento entra entero o no entra. Los tickets de un
 * EventoID que no está en categoriaEvento no entran (al 2026-11-04: 3 eventos
 * sueltos con 28 tickets en total).
 */
export function countryEventoFilter(
  scope: DataScope | undefined,
  column = "EventoID",
): SqlFragment {
  if (!scope?.country) return { sql: "", params: {} };
  const categoria = `\`${process.env.BIGQUERY_PROJECT_ID}.glovox.categoriaEvento\``;
  return {
    sql: ` AND ${column} IN (SELECT EventoID FROM ${categoria} WHERE Pais = @scopePais)`,
    params: { scopePais: scope.country },
  };
}
