CREATE TYPE "public"."movimiento_tipo" AS ENUM('saldo_inicial', 'cargo', 'pago', 'conversion', 'ajuste');--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"apodo" text,
	"telefono" text,
	"email" text,
	"documento" text,
	"razon_social" text,
	"direccion" text,
	"notas" text,
	"cuenta_corriente" boolean DEFAULT false NOT NULL,
	"limite_ars_centavos" bigint,
	"limite_usd_centavos" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "movimientos_cc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "movimiento_tipo" NOT NULL,
	"detalle" text NOT NULL,
	"delta_ars_centavos" bigint DEFAULT 0 NOT NULL,
	"delta_usd_centavos" bigint DEFAULT 0 NOT NULL,
	"cotizacion" numeric(14, 4),
	"grupo_id" uuid NOT NULL,
	"anula_grupo_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_cc" ADD CONSTRAINT "movimientos_cc_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_cc" ADD CONSTRAINT "movimientos_cc_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_activos_idx" ON "clientes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "clientes_nombre_idx" ON "clientes" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "movimientos_cliente_fecha_idx" ON "movimientos_cc" USING btree ("cliente_id","fecha");--> statement-breakpoint
CREATE INDEX "movimientos_grupo_idx" ON "movimientos_cc" USING btree ("grupo_id");