CREATE TYPE "public"."comprobante_estado" AS ENUM('pendiente', 'en_proceso', 'autorizado', 'rechazado', 'error', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."comprobante_letra" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."comprobante_tipo" AS ENUM('factura', 'nota_credito');--> statement-breakpoint
CREATE TYPE "public"."condicion_iva" AS ENUM('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final');--> statement-breakpoint
CREATE TABLE "comprobantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"tipo" "comprobante_tipo" NOT NULL,
	"letra" "comprobante_letra" NOT NULL,
	"estado" "comprobante_estado" DEFAULT 'pendiente' NOT NULL,
	"external_id" text NOT NULL,
	"facturante_id" text,
	"cae" text,
	"cae_vencimiento" date,
	"numero_completo" text,
	"pdf_url" text,
	"qr_url" text,
	"total_centavos" bigint NOT NULL,
	"receptor_doc_tipo" text NOT NULL,
	"receptor_doc_numero" text NOT NULL,
	"receptor_nombre" text,
	"receptor_condicion_iva" "condicion_iva" NOT NULL,
	"cliente_id" uuid,
	"origen_id" uuid,
	"error_codigo" text,
	"error_mensaje" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"emitido_por" uuid,
	"enviado_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comprobantes_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "cuentas_mp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"mp_user_id" text NOT NULL,
	"access_token_cifrado" text NOT NULL,
	"refresh_token_cifrado" text NOT NULL,
	"public_key" text,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"vinculada_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_mp_mp_user_id_unique" UNIQUE("mp_user_id")
);
--> statement-breakpoint
CREATE TABLE "movimientos_mp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"mp_pago_id" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"neto_centavos" bigint,
	"comision_centavos" bigint,
	"titular" text,
	"email" text,
	"doc_tipo" text,
	"doc_numero" text,
	"metodo_pago" text,
	"descripcion" text,
	"fecha_aprobacion" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_mp_mp_pago_id_unique" UNIQUE("mp_pago_id")
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "condicion_iva" "condicion_iva";--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_movimiento_id_movimientos_mp_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_mp"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_origen_id_comprobantes_id_fk" FOREIGN KEY ("origen_id") REFERENCES "public"."comprobantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_emitido_por_users_id_fk" FOREIGN KEY ("emitido_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_mp" ADD CONSTRAINT "cuentas_mp_vinculada_por_users_id_fk" FOREIGN KEY ("vinculada_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_mp" ADD CONSTRAINT "movimientos_mp_cuenta_id_cuentas_mp_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_mp"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comprobantes_factura_viva_idx" ON "comprobantes" USING btree ("movimiento_id") WHERE "comprobantes"."tipo" = 'factura' and "comprobantes"."estado" not in ('rechazado', 'error', 'anulado');--> statement-breakpoint
CREATE UNIQUE INDEX "comprobantes_nc_viva_idx" ON "comprobantes" USING btree ("origen_id") WHERE "comprobantes"."tipo" = 'nota_credito' and "comprobantes"."estado" not in ('rechazado', 'error');--> statement-breakpoint
CREATE INDEX "comprobantes_estado_idx" ON "comprobantes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "comprobantes_created_idx" ON "comprobantes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "movimientos_mp_fecha_idx" ON "movimientos_mp" USING btree ("fecha_aprobacion");