-- Pasa de tres roles (owner, admin, editor) a dos (admin, editor).
--
-- Postgres no deja quitar un valor de un enum, así que el tipo se recrea: la
-- columna baja a text, se cambia el tipo, y vuelve a subir.
--
-- El UPDATE del medio lo agregamos a mano: drizzle-kit genera el baile de
-- tipos pero no migra los datos, y sin él el cast final falla con
-- "invalid input value for enum user_role: owner" en cuanto exista una sola
-- fila con el rol viejo. Va con la columna ya en text, que es el único
-- momento en que 'owner' y 'admin' conviven sin que el tipo se queje.
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::text;--> statement-breakpoint
UPDATE "users" SET "role" = 'admin' WHERE "role" = 'owner';--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";
