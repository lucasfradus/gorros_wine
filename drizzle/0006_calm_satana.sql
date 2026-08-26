ALTER TABLE "bodegas" ADD COLUMN "logo" jsonb;--> statement-breakpoint
ALTER TABLE "bodegas" ADD COLUMN "mostrar_en_home" boolean DEFAULT false NOT NULL;