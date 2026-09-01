import { cache } from "react";
import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventos, type Evento } from "@/lib/db/schema";
import { hoyEnArgentina } from "@/lib/format";

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

/**
 * Un evento tal como lo muestra la tienda.
 *
 * `comienza` es el string `"2026-09-18"`, y eso es lo que hace que este tipo
 * pueda cruzar el `unstable_cache` sin traducción. El caché serializa a JSON:
 * una `Date` entra como objeto y **vuelve como string**, lo que no se nota en
 * la lectura fría y revienta en la segunda. Como acá no hay ninguna, el
 * problema no existe.
 */
export type EventoPublico = Pick<
  Evento,
  "id" | "titulo" | "comienza" | "lugar" | "detalle" | "imagen"
>;

/**
 * Los eventos publicados, en una sola consulta.
 *
 * El `unstable_cache` cumple acá el mismo papel que en `lib/content/get.ts`:
 * sin él, leer la agenda volvería dinámica cada página que hoy se
 * prerenderiza, la home incluida.
 *
 * El `revalidate` en cambio es propio de esta tabla. El contenido sólo cambia
 * cuando alguien lo edita, pero la agenda cambia **sola**: a la medianoche el
 * evento de ayer pasa a la lista de pasados sin que nadie toque nada. El tag
 * cubre las ediciones; este techo de quince minutos cubre el cambio de día.
 */
const leerPublicados = unstable_cache(
  async (): Promise<EventoPublico[]> => {
    try {
      return await db
        .select({
          id: eventos.id,
          titulo: eventos.titulo,
          comienza: eventos.comienza,
          lugar: eventos.lugar,
          detalle: eventos.detalle,
          imagen: eventos.imagen,
        })
        .from(eventos)
        .where(eq(eventos.publicado, true))
        .orderBy(asc(eventos.comienza));
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
 * El corte es el día, no el instante: una cata de hoy sigue siendo próxima
 * hasta que el día termine. Es lo que corresponde ahora que un evento no
 * guarda hora — no se puede saber si ya pasó— y además es lo que alguien
 * espera al abrir la página la mañana de la cata.
 *
 * Las dos fechas son strings `"AAAA-MM-DD"`, así que se comparan como strings:
 * ese formato ordena igual alfabéticamente que cronológicamente. Se calcula al
 * renderizar y no en SQL para que la consulta cacheada sirva a las dos mitades.
 */
export async function getAgenda(): Promise<Agenda> {
  const todos = await publicados();
  const hoy = hoyEnArgentina();

  return {
    proximos: todos.filter((e) => e.comienza >= hoy),
    pasados: todos
      .filter((e) => e.comienza < hoy)
      .reverse()
      .slice(0, PASADOS_VISIBLES),
  };
}

/** Los próximos que entran en un bloque chico, como el de la home. */
export async function getProximos(limite: number): Promise<EventoPublico[]> {
  const { proximos } = await getAgenda();
  return proximos.slice(0, limite);
}
