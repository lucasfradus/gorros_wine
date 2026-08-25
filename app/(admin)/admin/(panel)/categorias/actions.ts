"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categorias, productos, type Categoria } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/catalogo";
import { slugOpcional } from "@/lib/campos";

export interface CategoriaFormState {
  error?: string;
  ok?: string;
}

const esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre de la categoría es muy corto."),
  slug: slugOpcional,
  /** Vacío = categoría raíz. */
  parentId: z
    .string()
    .trim()
    .refine((v) => v === "" || z.uuid().safeParse(v).success, {
      message: "Esa categoría padre no existe.",
    })
    .transform((v) => (v === "" ? null : v)),
  orden: z
    .string()
    .trim()
    .refine((v) => /^-?\d+$/.test(v), { message: "El orden tiene que ser un número." })
    .transform((v) => Number(v)),
});

function leer(formData: FormData) {
  return esquema.safeParse({
    nombre: formData.get("nombre") ?? "",
    slug: formData.get("slug") ?? "",
    parentId: formData.get("parentId") ?? "",
    orden: formData.get("orden") ?? "0",
  });
}

async function slugTomado(slug: string, exceptoId?: string): Promise<boolean> {
  const [existe] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(
      and(
        eq(categorias.slug, slug),
        exceptoId ? ne(categorias.id, exceptoId) : undefined,
      ),
    )
    .limit(1);

  return Boolean(existe);
}

async function traerCategoria(id: string): Promise<Categoria | null> {
  const [c] = await db
    .select()
    .from(categorias)
    .where(eq(categorias.id, id))
    .limit(1);
  return c ?? null;
}

async function cantidadDeHijas(id: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(categorias)
    .where(eq(categorias.parentId, id));
  return n;
}

/**
 * Reglas del árbol, en un solo lugar.
 *
 * Se permiten **dos niveles y no más**: "Accesorios > Copas", pero no
 * "Accesorios > Copas > Cristal". Con esa regla, garantizar que no haya ciclos
 * es trivial —una categoría con hijas no puede volverse hija— y no hace falta
 * recorrer el árbol hacia arriba en cada guardado.
 */
async function validarPadre(
  parentId: string | null,
  propioId?: string,
): Promise<{ error: string } | { padre: Categoria | null }> {
  if (!parentId) return { padre: null };

  if (propioId && parentId === propioId) {
    return { error: "Una categoría no puede ser su propia subcategoría." };
  }

  const padre = await traerCategoria(parentId);
  if (!padre) return { error: "Esa categoría padre ya no existe." };

  if (padre.parentId) {
    return {
      error: `"${padre.nombre}" ya es una subcategoría, y no se admite un tercer nivel.`,
    };
  }

  if (propioId && (await cantidadDeHijas(propioId)) > 0) {
    return {
      error:
        "Esta categoría tiene subcategorías, así que no puede volverse subcategoría de otra.",
    };
  }

  return { padre };
}

// ---------------------------------------------------------------- crear

export async function crearCategoriaAction(
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  await requireUser();

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { nombre, slug, parentId, orden } = parsed.data;
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }
  if (await slugTomado(slugFinal)) {
    return { error: "Ya hay una categoría con ese slug. Cambiá el slug." };
  }

  const arbol = await validarPadre(parentId);
  if ("error" in arbol) return arbol;

  await db.insert(categorias).values({
    nombre,
    slug: slugFinal,
    parentId,
    orden,
    // Una subcategoría hereda: si el padre lleva ficha de vino, ella también.
    esVino: arbol.padre ? arbol.padre.esVino : formData.get("esVino") !== null,
  });

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

// ---------------------------------------------------------------- editar

export async function editarCategoriaAction(
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Esa categoría no existe." };

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const actual = await traerCategoria(id.data);
  if (!actual) return { error: "Esa categoría ya no existe." };

  const { nombre, slug, parentId, orden } = parsed.data;
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }
  if (await slugTomado(slugFinal, id.data)) {
    return { error: "Ya hay otra categoría con ese slug. Cambiá el slug." };
  }

  const arbol = await validarPadre(parentId, id.data);
  if ("error" in arbol) return arbol;

  const esVino = arbol.padre
    ? arbol.padre.esVino
    : formData.get("esVino") !== null;

  await db
    .update(categorias)
    .set({ nombre, slug: slugFinal, parentId, orden, esVino, updatedAt: new Date() })
    .where(eq(categorias.id, id.data));

  // Las hijas heredan. Se propaga al guardar en vez de calcularlo al leer:
  // así una consulta del catálogo nunca tiene que subir por el árbol.
  const propagadas = await db
    .update(categorias)
    .set({ esVino, updatedAt: new Date() })
    .where(and(eq(categorias.parentId, id.data), ne(categorias.esVino, esVino)))
    .returning({ id: categorias.id });

  revalidatePath("/admin/categorias");
  revalidatePath(`/admin/categorias/${id.data}`);

  return {
    ok:
      propagadas.length === 0
        ? "Cambios guardados."
        : `Cambios guardados. ${propagadas.length} ${
            propagadas.length === 1 ? "subcategoría heredó" : "subcategorías heredaron"
          } la ficha de vino.`,
  };
}

// -------------------------------------------------------- archivar/reactivar

export async function archivarCategoriaAction(
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Esa categoría no existe." };

  const actual = await traerCategoria(id.data);
  if (!actual) return { error: "Esa categoría ya no existe." };

  const archivando = actual.isActive;

  await db
    .update(categorias)
    .set({ isActive: !actual.isActive, updatedAt: new Date() })
    .where(eq(categorias.id, id.data));

  revalidatePath("/admin/categorias");
  revalidatePath(`/admin/categorias/${id.data}`);

  if (!archivando) return { ok: "Categoría reactivada." };

  const [activos] = await db
    .select({ n: count() })
    .from(productos)
    .where(and(eq(productos.categoriaId, id.data), eq(productos.isActive, true)));

  return {
    ok:
      activos.n === 0
        ? "Categoría archivada. Deja de ofrecerse al cargar productos."
        : `Categoría archivada. Ojo: sus ${activos.n} ${
            activos.n === 1 ? "producto sigue activo" : "productos siguen activos"
          } en el catálogo.`,
  };
}
