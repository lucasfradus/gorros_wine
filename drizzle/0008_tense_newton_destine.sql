-- Un evento pasa a ser un día y no un instante: se va la hora, y con ella el
-- precio, que nunca se publicó en el sitio.
--
-- El `USING` lo agregamos a mano, y no es cosmético. Sin él la migración falla:
-- Postgres no tiene cast de asignación de `timestamptz` a `date` y contesta
-- "column cannot be cast automatically to type date".
--
-- La zona tampoco es opcional. Una cata de las 21:00 de Buenos Aires está
-- guardada como 00:00 UTC **del día siguiente**; casteada tal cual en un
-- servidor que corre en UTC —como producción— se correría un día entero. El
-- `AT TIME ZONE` la trae a la hora del local antes de recortar la fecha.
ALTER TABLE "eventos" ALTER COLUMN "comienza" SET DATA TYPE date
	USING ("comienza" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;--> statement-breakpoint
ALTER TABLE "eventos" DROP COLUMN "precio_centavos";
