# Agenda (`admin_agenda_notas`) — migraciones 0019–0021 · notas de deploy

Refactor de la nota de agenda: de texto libre (`contenido text`, agenda v1) a lista
ordenada de ítems (`items jsonb`, shape `AgendaItem = {id, texto, done?}`, agenda v2).

## Contexto de estado (⚠️ CONFIRMAR antes de deployar)

- **agenda v1 (con `contenido`) está commiteada en `origin/main`** (commit `77321b5`,
  ya pusheado) → probablemente **viva en prod** vía Vercel. O sea prod puede tener la
  tabla con `contenido` **y notas reales cargadas**.
- El refactor v2 (código + migraciones 0020/0021) está **SIN commitear** (working tree).
- **A confirmar por el owner:**
  1. ¿Agenda v1 está realmente desplegada y en uso en prod (hay filas con `contenido`)?
  2. El `DATABASE_URL` de `.env.local` (`ep-withered-haze-…neon.tech` / db `glovox-data`)
     ¿es **prod** o un **branch de dev**? Las migraciones de las sesiones previas se
     aplicaron contra ESA DB (allí `items` ya está poblado y —en su estado previo— se
     había dropeado `contenido`). Si es prod, hay que revisarla con cuidado.

## Estrategia: EXPAND / CONTRACT (drop diferido)

Como v1 (que usa `contenido`) puede estar viva en prod, **NO se dropea `contenido` en el
mismo release que el refactor** — eso rompería instancias v1 en vuelo durante el rollout.

### Este release (expand)
- **0019** `…watery_captain_cross` — `CREATE TABLE` (con `contenido`). *(ya en `main`)*
- **0020** `…true_post` — `ADD COLUMN items jsonb DEFAULT '[]' NOT NULL` (no destructiva).
- **0021** `…backfill_agenda_items` — **BACKFILL** de `contenido` → `items`
  (`UPDATE … WHERE contenido <> '' AND items = '[]'`). **NO dropea `contenido`.**
- `db/schema.ts` mantiene `contenido` marcada como DEPRECATED. El código v2 solo
  lee/escribe `items`; ya no toca `contenido`.

### Release POSTERIOR (contract) — cuando v2 esté 100% desplegado
- Nueva migración `0022_drop_contenido` = `ALTER TABLE admin_agenda_notas DROP COLUMN contenido;`
  Generarla quitando `contenido` de `db/schema.ts` y corriendo `db:generate`.
  Recién ahí se elimina la columna, ya sin consumidores.

> Fix del bug original: la `0021` anterior dropeaba `contenido` **sin backfill** → pérdida
> de datos. Ahora (a) hay backfill y (b) el drop se difiere, así que el set es seguro con
> o sin datos y sin acoplar el drop al deploy del código.

## Orden de deploy seguro (este release)

1. **Aplicar 0020 + 0021 (add items + backfill) ANTES de que el código v2 sirva tráfico.**
   El código v2 hace `SELECT items`; si sirve antes de 0020 → 500s. En Vercel, correr
   `db:migrate` en el paso de release previo a promover el deployment.
2. Deploy del código v2. `contenido` sigue existiendo → instancias v1 drenando siguen
   funcionando. **Cero downtime, cero pérdida de datos.**
3. En un release posterior, cuando ya no queden instancias v1, aplicar `0022_drop_contenido`.

## Estado local (dev)

- La DB apuntada por `.env.local` ya tuvo aplicadas las 0020/0021 **previas** (la 0021 vieja
  dropeaba `contenido`), así que allí `items` está poblado (2 días: 8 y 4 ítems) y
  `contenido` **fue dropeada** físicamente.
- La `0021` nueva (backfill, sin drop) tiene `when = 1783953852605` (el mismo de la 0021
  vieja ya registrada en `__drizzle_migrations`). Por el watermark de drizzle
  (`created_at < folderMillis`, ver `node_modules/drizzle-orm/pg-core/dialect.cjs`), local
  la considera **ya aplicada → `db:migrate` es un no-op limpio** (no intenta correr el
  backfill contra la columna ausente). En un entorno **fresco** igual se aplica después de
  0020 (`852 > 783`).
- La app local funciona igual: el código v2 solo lee/escribe `items`; el INSERT no menciona
  `contenido`, así que la columna ausente en dev no rompe nada. Si querés que el schema físico
  de dev coincida con el committeado (cosmético), corré una sola vez:
  `ALTER TABLE admin_agenda_notas ADD COLUMN contenido text NOT NULL DEFAULT '';`
  **No lo apliqué** para no mutar la DB sin confirmación (podría ser prod).

## ⚠️ No commitear ni aplicar migraciones a prod sin confirmación explícita del owner.
