import { asc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { categorias } from "@/lib/db/schema";

export interface CategoriaOpcion {
  id: string;
  /** "Accesorios › Copas". La jerarquía va en el texto: un `<select>` no la
   *  sabe dibujar, y con un puñado de categorías un árbol es de más. */
  etiqueta: string;
  esVino: boolean;
}

/**
 * Las categorías que un formulario puede ofrecer, en orden de árbol.
 *
 * Sólo las activas, más —si se pasa `incluirId`— la del producto que se está
 * editando aunque esté archivada. Sin eso, guardar cualquier otro cambio de un
 * producto de una categoría archivada le cambiaría la categoría en silencio.
 */
export async function opcionesDeCategoria(
  incluirId?: string,
): Promise<CategoriaOpcion[]> {
  const filas = await db
    .select({
      id: categorias.id,
      nombre: categorias.nombre,
      parentId: categorias.parentId,
      esVino: categorias.esVino,
    })
    .from(categorias)
    .where(
      incluirId
        ? or(eq(categorias.isActive, true), eq(categorias.id, incluirId))
        : eq(categorias.isActive, true),
    )
    .orderBy(asc(categorias.orden), asc(categorias.nombre));

  const raices = filas.filter((c) => c.parentId === null);

  const opciones = raices.flatMap((raiz) => [
    { id: raiz.id, etiqueta: raiz.nombre, esVino: raiz.esVino },
    ...filas
      .filter((c) => c.parentId === raiz.id)
      .map((hija) => ({
        id: hija.id,
        etiqueta: `${raiz.nombre} › ${hija.nombre}`,
        esVino: hija.esVino,
      })),
  ]);

  // Una hija cuyo padre está archivado quedaría afuera del recorrido de arriba,
  // y el desplegable perdería una opción válida sin decir por qué.
  const vistas = new Set(opciones.map((o) => o.id));
  const huerfanas = filas
    .filter((c) => c.parentId !== null && !vistas.has(c.id))
    .map((c) => ({ id: c.id, etiqueta: c.nombre, esVino: c.esVino }));

  return [...opciones, ...huerfanas];
}
