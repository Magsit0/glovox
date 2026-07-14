-- BACKFILL agenda v1 → v2: envuelve el texto libre viejo (`contenido`) como un
-- ítem {id, texto} dentro de `items`. NO dropea `contenido` (expand/contract): la
-- columna se mantiene una release más para no romper instancias v1 en vuelo que
-- aún la consultan. El DROP va en una migración POSTERIOR (ver AGENDA_*_NOTES.md).
-- Solo toca filas con items vacío y contenido no vacío, así no pisa ítems del
-- código nuevo ni datos ya migrados. En un entorno sin datos es un no-op.
UPDATE "admin_agenda_notas"
SET "items" = jsonb_build_array(
  jsonb_build_object('id', gen_random_uuid()::text, 'texto', "contenido"))
WHERE "contenido" <> '' AND "items" = '[]'::jsonb;
