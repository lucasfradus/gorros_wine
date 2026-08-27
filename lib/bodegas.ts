import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodegas } from "@/lib/db/schema";
import type { ImagenValor } from "@/lib/content/types";

/** El tag con el que el panel invalida la franja de la portada. */
export const BODEGAS_TAG = "bodegas";

/** Una bodega tal como la muestra la franja: el logo y adónde lleva. */
export interface BodegaEnHome {
  id: string;
  nombre: string;
  /** Nulo cuando no se cargó: el logo se muestra igual, sin enlace. */
  sitioWeb: string | null;
  logo: ImagenValor;
}

/**
 * Las bodegas que van en la portada.
 *
 * Son tres condiciones y ninguna sobra. `mostrarEnHome` es la decisión
 * editorial de quien carga; el logo es lo único que la franja sabe dibujar; y
 * `isActive` porque una bodega archivada es un proveedor al que se dejó de
 * comprarle, y sacarla de la portada no debería ser un segundo trámite.
 *
 * El `unstable_cache` cumple el mismo papel que en `lib/eventos.ts`: sin él,
 * leer esta lista volvería dinámica la home, que hoy se prerenderiza. A
 * diferencia de la agenda no lleva `revalidate` por tiempo, y es la diferencia
 * que importa entre las dos: un evento pasa de próximo a pasado **solo**, con
 * el reloj, pero esta lista no cambia si nadie la edita. Para eso está el tag.
 */
const leerEnHome = unstable_cache(
  async (): Promise<BodegaEnHome[]> => {
    try {
      const filas = await db
        .select({
          id: bodegas.id,
          nombre: bodegas.nombre,
          sitioWeb: bodegas.sitioWeb,
          logo: bodegas.logo,
        })
        .from(bodegas)
        .where(
          and(
            eq(bodegas.mostrarEnHome, true),
            eq(bodegas.isActive, true),
            isNotNull(bodegas.logo),
          ),
        )
        .orderBy(asc(bodegas.nombre));

      // El `isNotNull` de arriba es del lado de SQL y no estrecha el tipo. Y no
      // es del todo redundante repetirlo acá: en una columna `jsonb` el `null`
      // de JSON es un valor guardado y no un `NULL` de Postgres, así que una
      // fila escrita por afuera del panel podría pasar el filtro con el logo
      // vacío. Filtrar en TypeScript cubre ese caso y estrecha el tipo.
      return filas.filter((f): f is BodegaEnHome => f.logo !== null);
    } catch (error) {
      // Misma decisión que en la agenda: si la base no contesta, la portada se
      // sirve sin la franja en vez de romperse entera.
      console.error("[bodegas] no se pudo leer la franja de la home:", error);
      return [];
    }
  },
  ["bodegas-home"],
  { tags: [BODEGAS_TAG] },
);

/** `cache()` de React, por si más de un componente pide la misma lista. */
export const getBodegasEnHome = cache(leerEnHome);
