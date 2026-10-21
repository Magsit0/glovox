-- `editores_unicos` (un titular por capacidad, PK = capacidad) pasa a ser una
-- lista acotada: `editores_capacidad`, una fila por (capacidad, persona). El tope
-- (2 para `metas-evento`) lo hace cumplir la app al asignar. Escrita a mano para
-- RENOMBRAR (drizzle-kit lo trataría como borrar + crear y perdería la fila
-- vigente). Los nombres de constraints quedan como los espera el snapshot 0036.
ALTER TABLE "data"."editores_unicos" RENAME TO "editores_capacidad";
--> statement-breakpoint
ALTER TABLE "data"."editores_capacidad" DROP CONSTRAINT "editores_unicos_pkey";
--> statement-breakpoint
ALTER TABLE "data"."editores_capacidad" ADD CONSTRAINT "editores_capacidad_capacidad_user_id_pk" PRIMARY KEY("capacidad","user_id");
--> statement-breakpoint
ALTER TABLE "data"."editores_capacidad" RENAME CONSTRAINT "editores_unicos_user_id_users_id_fk" TO "editores_capacidad_user_id_users_id_fk";
