import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { REGISTRO, type GrupoKey, type ValoresDe } from "./registry";
import type { Campo, CampoLista, ImagenValor, ItemValor } from "./types";

/** El tag con el que se invalida todo el contenido de una. */
export const CONTENT_TAG = "contenido";

/**
 * Lo editado, en **una** consulta a toda la tabla.
 *
 * Son decenas de filas, no miles: traerlas todas sale más barato que filtrar
 * por grupo y pegarle a la base una vez por sección de la página.
 *
 * El `unstable_cache` no es una optimización opcional: sin él, leer contenido
 * volvería dinámica cada página que hoy se prerenderiza —la home incluida— y
 * eso sería una regresión de performance a cambio de nada. Con el tag, guardar
 * en el panel invalida el prerender y la próxima visita ve el texto nuevo.
 */
const leerEditado = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    try {
      const filas = await db
        .select({ key: content.key, value: content.value })
        .from(content);
      return Object.fromEntries(filas.map((f) => [f.key, f.value]));
    } catch (error) {
      // Si la base no contesta, el sitio se sirve con los textos originales del
      // registro en vez de romperse. Es la diferencia entre una portada con el
      // copy de fábrica y una pantalla de error.
      console.error("[contenido] no se pudo leer la tabla content:", error);
      return {};
    }
  },
  ["contenido"],
  { tags: [CONTENT_TAG] },
);

/** `cache()` de React: el layout y tres componentes piden lo mismo por request. */
const editado = cache(leerEditado);

/**
 * El contenido de un grupo, ya mezclado: lo que alguien editó, y el original
 * del registro para todo lo demás.
 */
export async function getContent<K extends GrupoKey>(
  grupo: K,
): Promise<ValoresDe<K>> {
  const guardado = await editado();
  const campos: Record<string, Campo> = REGISTRO[grupo].campos;
  const salida: Record<string, unknown> = {};

  for (const [nombre, campo] of Object.entries(campos)) {
    const bruto = guardado[`${grupo}.${nombre}`];
    const valor = bruto === undefined ? undefined : normalizar(campo, bruto);
    salida[nombre] = valor === undefined ? campo.original : valor;
  }

  return salida as ValoresDe<K>;
}

/**
 * Qué campos tiene editados cada grupo. Lo usa el índice del panel para poder
 * decir "3 campos editados" sin volver a leer la base por grupo.
 */
export async function getEditados(): Promise<Record<GrupoKey, string[]>> {
  const guardado = await editado();
  const salida = {} as Record<GrupoKey, string[]>;

  for (const grupo of Object.keys(REGISTRO) as GrupoKey[]) {
    salida[grupo] = Object.keys(REGISTRO[grupo].campos).filter(
      (campo) => guardado[`${grupo}.${campo}`] !== undefined,
    );
  }

  return salida;
}

/**
 * Devuelve el valor con la forma que el registro declara, o `undefined` si lo
 * guardado no sirve.
 *
 * `undefined` y no `null` a propósito: para un campo de imagen, `null` es un
 * valor legítimo —"sacaron la foto"— y confundirlo con "está roto" haría
 * reaparecer la imagen original cada vez que alguien la quita.
 *
 * Que un valor guardado no valide no es teoría: pasa cada vez que se renombra
 * un campo del registro o se le cambia la forma a un ítem de lista, y quedan
 * filas viejas en la base. Ahí el sitio muestra el original y sigue andando.
 */
function normalizar(campo: Campo, bruto: unknown): unknown {
  switch (campo.tipo) {
    case "texto":
    case "parrafo":
    case "rico":
      return typeof bruto === "string" ? bruto : undefined;
    case "imagen":
      return normalizarImagen(bruto);
    case "lista":
      return normalizarLista(campo, bruto);
  }
}

function normalizarImagen(bruto: unknown): ImagenValor | null | undefined {
  if (bruto === null) return null;
  if (typeof bruto !== "object") return undefined;

  const o = bruto as Record<string, unknown>;
  if (typeof o.src !== "string" || o.src === "") return undefined;

  return {
    src: o.src,
    alt: typeof o.alt === "string" ? o.alt : "",
    width: typeof o.width === "number" ? o.width : null,
    height: typeof o.height === "number" ? o.height : null,
  };
}

function normalizarLista(
  campo: CampoLista,
  bruto: unknown,
): ItemValor[] | undefined {
  if (!Array.isArray(bruto)) return undefined;

  return bruto.map((cruda) => {
    const fuente =
      typeof cruda === "object" && cruda !== null
        ? (cruda as Record<string, unknown>)
        : {};

    const item: ItemValor = {};
    for (const [nombre, sub] of Object.entries(campo.item)) {
      const valor = normalizar(sub, fuente[nombre]);
      item[nombre] = (valor === undefined ? sub.original : valor) as
        | string
        | ImagenValor
        | null;
    }
    return item;
  });
}
