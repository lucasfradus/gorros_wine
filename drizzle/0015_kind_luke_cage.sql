ALTER TABLE "documentos" DROP CONSTRAINT "documentos_factura_id_comprobantes_id_fk";
--> statement-breakpoint
ALTER TABLE "comprobantes" ADD COLUMN "documento_id" uuid;--> statement-breakpoint
-- A mano: el vínculo que hasta ahora vivía en documentos.factura_id pasa a la
-- factura, antes de borrar la columna.
UPDATE "comprobantes" SET "documento_id" = "documentos"."id" FROM "documentos" WHERE "documentos"."factura_id" = "comprobantes"."id";--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comprobantes_documento_vivo_idx" ON "comprobantes" USING btree ("documento_id") WHERE "comprobantes"."tipo" = 'factura' and "comprobantes"."estado" not in ('rechazado', 'error', 'anulado');--> statement-breakpoint
ALTER TABLE "documentos" DROP COLUMN "factura_id";