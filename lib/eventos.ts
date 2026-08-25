import { cache } from "react";
import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventos, type Evento } from "@/lib/db/schema";

/** El tag con el que el panel invalida la agenda entera. */
export const EVENTOS_TAG = "eventos";

/**
 * Cuántos encuentros pasados se muestran en la tienda.
 *
 * Se siguen viendo porque sirven de prueba social, pero con tope: sin él la
 * página crece para siempre y en un año es una lista de cien catas viejas. En
 * el panel no hay tope, que es donde el histórico completo se viene a buscar.
 */
const PASADOS_VISIBLES = 6;

/** Un evento tal como lo muestra la tienda. */
export type EventoPublico = Pick<
  Evento,
  | "id"
  | "titulo"
  | "comienza"
  | "lugar"
  | "detalle"
  | "precioCentavos"
  | "imagen"
>;

/**
 * Lo mismo, pero como sobrevive al caché.
 *
 * `unstable_cache` guarda su resultado serializado a JSON, así que una `Date`
 * entra como objeto y **vuelve como string**. Eso no se nota en la primera
 * lectura —la del caché frío, que devuelve el objeto tal cual salió de
 * Drizzle— y revienta en la segunda. Por eso la frontera está declarada acá
 * en vez de quedar como un accidente: lo que se cachea son strings, y
 * `getAgenda` es el único lugar que las vuelve a convertir.
 */
type EventoGuardado = Omit<EventoPublico, "comienza"> & { comienza: string };

/**
 * Los eventos publicados, en una sola consulta.
 *
 * El `unstable_cache` cumple acá el mismo papel que en `lib/content/get.ts`:
 * sin él, leer la agenda volvería dinámica cada página que hoy se
 * prerenderiza, la home incluida.
 *
 * El `revalidate` en cambio es propio de esta tabla. El contenido sólo cambia
 * cuando alguien lo edita, pero la agenda cambia **sola**: un evento pasa de
 * próximo a pasado sin que nadie toque nada. El tag cubre las ediciones; este
 * techo de quince minutos cubre el paso del tiempo, y acota cuánto puede
 * quedar una cata que ya empezó mostrándose como próxima.
 */
const leerPublicados = unstable_cache(
  async (): Promise<EventoGuardado[]> => {
    try {
      const filas = await db
        .select({
          id: eventos.id,
          titulo: eventos.titulo,
          comienza: eventos.comienza,
          lugar: eventos.lugar,
          detalle: eventos.detalle,
          precioCentavos: eventos.precioCentavos,
          imagen: eventos.imagen,
        })
        .from(eventos)
        .where(eq(eventos.publicado, true))
        .orderBy(asc(eventos.comienza));

      return filas.map((f) => ({ ...f, comienza: f.comienza.toISOString() }));
    } catch (error) {
      // Si la base no contesta, la página se sirve sin agenda en vez de
      // romperse: se ve el aviso de que no hay fechas, y el resto del sitio
      // sigue en pie.
      console.error("[eventos] no se pudo leer la agenda:", error);
      return [];
    }
  },
  ["eventos"],
  { tags: [EVENTOS_TAG], revalidate: 900 },
);

/** `cache()` de React: la home y la página de eventos piden lo mismo. */
const publicados = cache(leerPublicados);

export interface Agenda {
  /** Del más cercano al más lejano. */
  proximos: EventoPublico[];
  /** Del más reciente al más viejo, con tope. */
  pasados: EventoPublico[];
}

/**
 * La agenda partida en dos.
 *
 * El corte es `comienza` contra ahora, sin gracia de horas: una cata que
 * arrancó hace media hora ya cuenta como pasada. Se calcula al renderizar y no
 * en SQL para que la consulta cacheada sirva a las dos mitades.
 */
export async function getAgenda(): Promise<Agenda> {
  const todos: EventoPublico[] = (await publicados()).map((f) => ({
    ...f,
    comienza: new Date(f.comienza),
  }));
  const ahora = Date.now();

  return {
    proximos: todos.filter((e) => e.comienza.getTime() >= ahora),
    pasados: todos
      .filter((e) => e.comienza.getTime() < ahora)
      .reverse()
      .slice(0, PASADOS_VISIBLES),
  };
}

/** Los próximos que entran en un bloque chico, como el de la home. */
export async function getProximos(limite: number): Promise<EventoPublico[]> {
  const { proximos } = await getAgenda();
  return proximos.slice(0, limite);
}
