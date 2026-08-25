CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"comienza" timestamp with time zone NOT NULL,
	"lugar" text NOT NULL,
	"detalle" text,
	"precio_centavos" integer NOT NULL,
	"imagen" jsonb,
	"publicado" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "eventos_agenda_idx" ON "eventos" USING btree ("publicado","comienza");