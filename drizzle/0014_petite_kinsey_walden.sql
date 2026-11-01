CREATE TYPE "public"."documento_tipo" AS ENUM('presupuesto', 'recibo');--> statement-breakpoint
CREATE TABLE "documento_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"producto_id" uuid,
	"orden" integer NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL,
	"descuento_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"subtotal_centavos" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo" "documento_tipo" NOT NULL,
	"numero" integer NOT NULL,
	"fecha" date NOT NULL,
	"cliente_id" uuid,
	"receptor_nombre" text,
	"receptor_documento" text,
	"forma_pago" "forma_pago",
	"valido_hasta" date,
	"observaciones" text,
	"total_centavos" bigint NOT NULL,
	"anulado" boolean DEFAULT false NOT NULL,
	"factura_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_items" ADD CONSTRAINT "documento_items_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_items" ADD CONSTRAINT "documento_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_factura_id_comprobantes_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."comprobantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documento_items_documento_idx" ON "documento_items" USING btree ("documento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_tipo_numero_idx" ON "documentos" USING btree ("tipo","numero");--> statement-breakpoint
CREATE INDEX "documentos_fecha_idx" ON "documentos" USING btree ("fecha");