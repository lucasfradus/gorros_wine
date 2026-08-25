CREATE TYPE "public"."moneda" AS ENUM('ARS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."tipo_vino" AS ENUM('Tinto', 'Blanco', 'Espumante', 'Rosado');--> statement-breakpoint
CREATE TABLE "bodegas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"logo_key" text,
	"pais" text,
	"sitio_web" text,
	"contacto_nombre" text,
	"contacto_email" text,
	"contacto_telefono" text,
	"notas" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bodegas_slug_unique" UNIQUE("slug"),
	CONSTRAINT "bodegas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"parent_id" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	"es_vino" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cotizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ars_por_usd_centavos" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto_varietales" (
	"producto_id" uuid NOT NULL,
	"varietal_id" uuid NOT NULL,
	CONSTRAINT "producto_varietales_producto_id_varietal_id_pk" PRIMARY KEY("producto_id","varietal_id")
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"bodega_id" uuid,
	"tipo" "tipo_vino",
	"region" text,
	"anada" integer,
	"precio_centavos" integer NOT NULL,
	"moneda" "moneda" DEFAULT 'ARS' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"destacado" boolean DEFAULT false NOT NULL,
	"descripcion" text,
	"guarda" text,
	"maridajes" text[] DEFAULT '{}' NOT NULL,
	"volumen_ml" integer,
	"imagen_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "varietales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "varietales_slug_unique" UNIQUE("slug"),
	CONSTRAINT "varietales_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_parent_id_categorias_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_varietales" ADD CONSTRAINT "producto_varietales_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_varietales" ADD CONSTRAINT "producto_varietales_varietal_id_varietales_id_fk" FOREIGN KEY ("varietal_id") REFERENCES "public"."varietales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bodegas_activas_idx" ON "bodegas" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "categorias_padre_idx" ON "categorias" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categorias_activas_idx" ON "categorias" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "cotizaciones_fecha_idx" ON "cotizaciones" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "producto_varietales_varietal_idx" ON "producto_varietales" USING btree ("varietal_id");--> statement-breakpoint
CREATE INDEX "productos_categoria_idx" ON "productos" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "productos_bodega_idx" ON "productos" USING btree ("bodega_id");--> statement-breakpoint
CREATE INDEX "productos_activos_idx" ON "productos" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "varietales_activos_idx" ON "varietales" USING btree ("is_active");--> statement-breakpoint

--> AGREGADO A MANO. Categorías semilla.
--> Hacen falta de verdad: `productos.categoria_id` es NOT NULL, así que con la
--> tabla vacía no se puede cargar ni un producto. Son las cuatro que vende la
--> vinoteca hoy, y se editan, reordenan o archivan desde el panel.
INSERT INTO "categorias" ("slug", "nombre", "orden", "es_vino") VALUES
	('vino', 'Vino', 1, true),
	('accesorios', 'Accesorios', 2, false),
	('heladeras', 'Heladeras', 3, false),
	('regaleria', 'Regalería', 4, false)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

--> AGREGADO A MANO. Varietales semilla: la lista que antes vivía fija en
--> `lib/catalogo.ts`. Se siembra para que el ABM no arranque vacío y para que
--> cargar el primer vino no exija cargar antes veinte uvas a mano.
INSERT INTO "varietales" ("slug", "nombre") VALUES
	('bonarda', 'Bonarda'),
	('cabernet-franc', 'Cabernet Franc'),
	('cabernet-sauvignon', 'Cabernet Sauvignon'),
	('chardonnay', 'Chardonnay'),
	('chenin-blanc', 'Chenin Blanc'),
	('criolla', 'Criolla'),
	('malbec', 'Malbec'),
	('merlot', 'Merlot'),
	('moscatel', 'Moscatel'),
	('petit-verdot', 'Petit Verdot'),
	('pinot-grigio', 'Pinot Grigio'),
	('pinot-noir', 'Pinot Noir'),
	('riesling', 'Riesling'),
	('sangiovese', 'Sangiovese'),
	('sauvignon-blanc', 'Sauvignon Blanc'),
	('semillon', 'Semillón'),
	('syrah', 'Syrah'),
	('tannat', 'Tannat'),
	('tempranillo', 'Tempranillo'),
	('torrontes', 'Torrontés'),
	('viognier', 'Viognier')
ON CONFLICT ("nombre") DO NOTHING;
