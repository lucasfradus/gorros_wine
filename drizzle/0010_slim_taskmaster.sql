CREATE TYPE "public"."forma_pago" AS ENUM('efectivo', 'debito', 'credito', 'transferencia', 'electronico');--> statement-breakpoint
CREATE TABLE "comprobante_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comprobante_id" uuid NOT NULL,
	"producto_id" uuid,
	"orden" integer NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL,
	"descuento_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"subtotal_centavos" bigint NOT NULL,
	"alcanzado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comprobantes" ALTER COLUMN "movimiento_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "percepcion_iva" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD COLUMN "forma_pago" "forma_pago";--> statement-breakpoint
ALTER TABLE "comprobantes" ADD COLUMN "tributos" jsonb;--> statement-breakpoint
ALTER TABLE "comprobante_items" ADD CONSTRAINT "comprobante_items_comprobante_id_comprobantes_id_fk" FOREIGN KEY ("comprobante_id") REFERENCES "public"."comprobantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobante_items" ADD CONSTRAINT "comprobante_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comprobante_items_comprobante_idx" ON "comprobante_items" USING btree ("comprobante_id");--> statement-breakpoint
CREATE INDEX "comprobante_items_producto_idx" ON "comprobante_items" USING btree ("producto_id");