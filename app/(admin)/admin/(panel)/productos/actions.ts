"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bodegas,
  categorias,
  cotizaciones,
  monedaPrecio,
  productoVarietales,
  productos,
  tipoVino,
  varietales,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { MARIDAJES, slugify } from "@/lib/catalogo";
import { slugOpcional, textoOpcional } from "@/lib/campos";
import { aCentavos, formatearPrecio } from "@/lib/precio";

export interface ProductoFormState {
  error?: string;
  ok?: string;
}

/** Plata escrita en un formulario ⇒ centavos enteros. */
function campoPrecio(mensaje: string) {
  return z
    .string()
    .trim()
    .refine((v) => aCentavos(v) !== null, { message: mensaje })
    .transform((v) => aCentavos(v) as number)
    .refine((v) => v > 0, { message: "Tiene que ser mayor a cero." });
}

const anadaOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}$/.test(v), {
    message: "La añada tiene que ser un año de cuatro dígitos.",
  })
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (v >= 1900 && v <= 2100), {
    message: "Esa añada no parece real.",
  });

const enteroNoNegativo = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v), { message: mensaje })
    .transform((v) => Number(v));

/**
 * Lo común a todo producto. Los campos de vino se validan aparte, porque
 * dependen de la categoría: pedirlos siempre haría imposible cargar una copa.
 */
const esquemaBase = z.object({
  nombre: z.string().trim().min(2, "El nombre del producto es muy corto."),
  slug: slugOpcional,
  categoriaId: z.uuid("Elegí una categoría."),
  precio: campoPrecio("El precio no es un número válido."),
  moneda: z.enum(monedaPrecio.enumValues, { error: "Elegí una moneda." }),
  stock: enteroNoNegativo("El stock tiene que ser un número entero."),
  descripcion: textoOpcional,
});

/** Sólo se piden si la categoría lleva ficha de vino. */
const esquemaVino = z.object({
  bodegaId: z.uuid("Elegí una bodega."),
  tipo: z.enum(tipoVino.enumValues, { error: "Elegí un tipo de vino." }),
  region: textoOpcional,
  anada: anadaOpcional,
  guarda: textoOpcional,
  maridajes: z
    .array(z.string())
    .refine((vs) => vs.every((v) => MARIDAJES.includes(v)), {
      message: "Hay un maridaje que no está en la lista.",
    }),
  volumenMl: enteroNoNegativo("El volumen tiene que ser un número entero.")
    .refine((v) => v > 0, { message: "El volumen tiene que ser mayor a cero." }),
});

/** `getAll` devuelve `(string | File)[]`; acá sólo pueden venir strings. */
function textos(formData: FormData, campo: string): string[] {
  return formData
    .getAll(campo)
    .filter((v): v is string => typeof v === "string" && v !== "");
}

/** Un checkbox que no se tildó directamente no viaja en el FormData. */
function tildado(formData: FormData, campo: string): boolean {
  return formData.get(campo) !== null;
}

async function slugTomado(slug: string, exceptoId?: string): Promise<boolean> {
  const [existe] = await db
    .select({ id: productos.id })
    .from(productos)
    .where(
      and(
        eq(productos.slug, slug),
        exceptoId ? ne(productos.id, exceptoId) : undefined,
      ),
    )
    .limit(1);

  return Boolean(existe);
}

/**
 * Arma la fila a guardar a partir del formulario.
 *
 * Acá vive la regla central del catálogo: **la categoría decide la ficha**. Si
 * no lleva ficha de vino, los campos de vino no se guardan a medias — se
 * fuerzan a `null`. Sin eso, cambiar un vino a "Accesorios" dejaría una copa
 * con bodega y añada, invisible en el formulario pero presente en la base.
 *
 * La base no puede garantizar esto (una sola tabla con columnas nullable), así
 * que lo garantiza esta función. Es el precio de haber elegido una tabla.
 */
async function armarFila(
  formData: FormData,
): Promise<
  | { error: string }
  | { fila: typeof productos.$inferInsert; varietalIds: string[] }
> {
  const base = esquemaBase.safeParse({
    nombre: formData.get("nombre") ?? "",
    slug: formData.get("slug") ?? "",
    categoriaId: formData.get("categoriaId") ?? "",
    precio: formData.get("precio") ?? "",
    moneda: formData.get("moneda") ?? "",
    stock: formData.get("stock") ?? "",
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!base.success) return { error: base.error.issues[0].message };

  const [categoria] = await db
    .select({ id: categorias.id, esVino: categorias.esVino })
    .from(categorias)
    .where(eq(categorias.id, base.data.categoriaId))
    .limit(1);

  if (!categoria) return { error: "Esa categoría ya no existe." };

  const { slug, precio, ...comunes } = base.data;
  const slugFinal = slug || slugify(comunes.nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }

  const fila: typeof productos.$inferInsert = {
    ...comunes,
    slug: slugFinal,
    precioCentavos: precio,
    destacado: tildado(formData, "destacado"),
    // Se listan explícitamente para que quede claro que una categoría sin
    // ficha de vino los borra, y no que simplemente no los toca.
    bodegaId: null,
    tipo: null,
    region: null,
    anada: null,
    guarda: null,
    maridajes: [],
    volumenMl: null,
  };

  if (!categoria.esVino) return { fila, varietalIds: [] };

  const vino = esquemaVino.safeParse({
    bodegaId: formData.get("bodegaId") ?? "",
    tipo: formData.get("tipo") ?? "",
    region: formData.get("region") ?? "",
    anada: formData.get("anada") ?? "",
    guarda: formData.get("guarda") ?? "",
    maridajes: textos(formData, "maridajes"),
    volumenMl: formData.get("volumenMl") ?? "",
  });

  if (!vino.success) return { error: vino.error.issues[0].message };

  const [bodega] = await db
    .select({ id: bodegas.id })
    .from(bodegas)
    .where(eq(bodegas.id, vino.data.bodegaId))
    .limit(1);

  if (!bodega) return { error: "Esa bodega ya no existe." };

  const varietalIds = textos(formData, "varietales");
  if (varietalIds.length === 0) {
    return { error: "Elegí al menos un varietal." };
  }
  if (!varietalIds.every((v) => z.uuid().safeParse(v).success)) {
    return { error: "Hay un varietal que no está en la lista." };
  }

  // Que existan de verdad: el `<select>` los limita, pero una Server Action es
  // un endpoint HTTP y se puede invocar sin pasar por la pantalla.
  const encontrados = await db
    .select({ id: varietales.id })
    .from(varietales)
    .where(inArray(varietales.id, varietalIds));

  if (encontrados.length !== varietalIds.length) {
    return { error: "Hay un varietal que no está en la lista." };
  }

  return { fila: { ...fila, ...vino.data }, varietalIds };
}

/** Reescribe las uvas de un producto: se borran las que había y se ponen éstas. */
async function guardarVarietales(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productoId: string,
  varietalIds: string[],
): Promise<void> {
  await tx
    .delete(productoVarietales)
    .where(eq(productoVarietales.productoId, productoId));

  if (varietalIds.length === 0) return;

  await tx
    .insert(productoVarietales)
    .values(varietalIds.map((varietalId) => ({ productoId, varietalId })));
}

// ---------------------------------------------------------------- crear

export async function crearProductoAction(
  _prev: ProductoFormState,
  formData: FormData,
): Promise<ProductoFormState> {
  await requireUser();

  const armado = await armarFila(formData);
  if ("error" in armado) return armado;

  if (await slugTomado(armado.fila.slug)) {
    return { error: "Ya hay un producto con ese slug. Cambiá el slug." };
  }

  // En transacción: un producto sin sus uvas es una ficha incompleta, y sería
  // peor dejarlo a medias que no crearlo.
  await db.transaction(async (tx) => {
    const [creado] = await tx
      .insert(productos)
      .values(armado.fila)
      .returning({ id: productos.id });

    await guardarVarietales(tx, creado.id, armado.varietalIds);
  });

  revalidatePath("/admin/productos");
  redirect("/admin/productos");
}

// ---------------------------------------------------------------- editar

export async function editarProductoAction(
  _prev: ProductoFormState,
  formData: FormData,
): Promise<ProductoFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ese producto no existe." };

  const armado = await armarFila(formData);
  if ("error" in armado) return armado;

  if (await slugTomado(armado.fila.slug, id.data)) {
    return { error: "Ya hay otro producto con ese slug. Cambiá el slug." };
  }

  const actualizados = await db.transaction(async (tx) => {
    const filas = await tx
      .update(productos)
      .set({ ...armado.fila, updatedAt: new Date() })
      .where(eq(productos.id, id.data))
      .returning({ id: productos.id });

    if (filas.length > 0) {
      await guardarVarietales(tx, id.data, armado.varietalIds);
    }

    return filas;
  });

  if (actualizados.length === 0) return { error: "Ese producto ya no existe." };

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id.data}`);
  return { ok: "Cambios guardados." };
}

// -------------------------------------------------------- archivar/reactivar

export async function archivarProductoAction(
  _prev: ProductoFormState,
  formData: FormData,
): Promise<ProductoFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ese producto no existe." };

  const [producto] = await db
    .select({ isActive: productos.isActive })
    .from(productos)
    .where(eq(productos.id, id.data))
    .limit(1);

  if (!producto) return { error: "Ese producto ya no existe." };

  await db
    .update(productos)
    .set({ isActive: !producto.isActive, updatedAt: new Date() })
    .where(eq(productos.id, id.data));

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${id.data}`);

  return {
    ok: producto.isActive
      ? "Producto archivado. Deja de ofrecerse."
      : "Producto reactivado.",
  };
}

// ---------------------------------------------------------------- cotización

/**
 * Guarda una cotización nueva. **Inserta**, no actualiza: la tabla es un
 * historial y la vigente es la última fila. Así queda asentado quién movió el
 * dólar y cuándo, que es lo que se pregunta cuando un precio no cierra.
 */
export async function guardarCotizacionAction(
  _prev: ProductoFormState,
  formData: FormData,
): Promise<ProductoFormState> {
  const actor = await requireUser();

  const parsed = campoPrecio("La cotización no es un número válido.").safeParse(
    formData.get("cotizacion") ?? "",
  );

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.insert(cotizaciones).values({
    arsPorUsdCentavos: parsed.data,
    createdBy: actor.id,
  });

  revalidatePath("/admin/productos");

  return {
    ok: `Cotización actualizada: US$ 1 = ${formatearPrecio(parsed.data, "ARS")}.`,
  };
}
