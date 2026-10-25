-- La fecha fiscal del comprobante. Hasta acá todos salían fechados el día en
-- que se creaban (en hora de Buenos Aires), así que eso es lo que se completa.
ALTER TABLE "comprobantes" ADD COLUMN "fecha" date;--> statement-breakpoint
UPDATE "comprobantes" SET "fecha" = ("created_at" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;--> statement-breakpoint
ALTER TABLE "comprobantes" ALTER COLUMN "fecha" SET NOT NULL;
