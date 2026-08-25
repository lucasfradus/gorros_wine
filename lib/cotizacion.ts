import { cache } from "react";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotizaciones } from "@/lib/db/schema";

/**
 * La cotización vigente es **la última fila** de `cotizaciones`, que es un
 * historial y no una fila que se pisa.
 *
 * Devuelve `null` si nunca se cargó ninguna: quien llama tiene que decir que
 * falta cargarla, no inventar un número. `cache()` de React lo memoriza por
 * request, así la página y el formulario no consultan dos veces.
 */
export const cotizacionVigente = cache(async () => {
  const [ultima] = await db
    .select()
    .from(cotizaciones)
    .orderBy(desc(cotizaciones.createdAt))
    .limit(1);

  return ultima ?? null;
});
