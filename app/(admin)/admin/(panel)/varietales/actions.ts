"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { productoVarietales, varietales } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/catalogo";
import { slugOpcional } from "@/lib/campos";

export interface VarietalFormState {
  error?: string;
  ok?: string;
}

const esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre del varietal es muy corto."),
  slug: slugOpcional,
});

function leer(formData: FormData) {
  return esquema.safeParse({
    nombre: formData.get("nombre") ?? "",
    slug: formData.get("slug") ?? "",
  });
}

async function buscarChoque(
  nombre: string,
  slug: string,
  exceptoId?: string,
): Promise<string | null> {
  const otros = exceptoId ? ne(varietales.id, exceptoId) : undefined;

  const [porNombre] = await db
    .select({ id: varietales.id })
    .from(varietales)
    .where(and(eq(varietales.nombre, nombre), otros))
    .limit(1);

  if (porNombre) return "Ya hay un varietal con ese nombre.";

  const [porSlug] = await db
    .select({ id: varietales.id })
    .from(varietales)
    .where(and(eq(varietales.slug, slug), otros))
    .limit(1);

  if (porSlug) return "Ya hay un varietal con ese slug. Cambiá el slug.";

  return null;
}

// ---------------------------------------------------------------- crear

export async function crearVarietalAction(
  _prev: VarietalFormState,
  formData: FormData,
): Promise<VarietalFormState> {
  await requireUser();

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { nombre, slug } = parsed.data;
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }

  const choque = await buscarChoque(nombre, slugFinal);
  if (choque) return { error: choque };

  await db.insert(varietales).values({ nombre, slug: slugFinal });

  revalidatePath("/admin/varietales");
  return { ok: `"${nombre}" agregado.` };
}

// ---------------------------------------------------------------- editar

/**
 * Renombrar es justamente para lo que existe esta tabla: el nombre se corrige
 * en un solo lugar y los productos que lo usan lo ven cambiado, porque la
 * relación va por id y no por texto.
 */
export async function editarVarietalAction(
  _prev: VarietalFormState,
  formData: FormData,
): Promise<VarietalFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ese varietal no existe." };

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { nombre, slug } = parsed.data;
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }

  const choque = await buscarChoque(nombre, slugFinal, id.data);
  if (choque) return { error: choque };

  const actualizados = await db
    .update(varietales)
    .set({ nombre, slug: slugFinal, updatedAt: new Date() })
    .where(eq(varietales.id, id.data))
    .returning({ id: varietales.id });

  if (actualizados.length === 0) return { error: "Ese varietal ya no existe." };

  revalidatePath("/admin/varietales");
  revalidatePath(`/admin/varietales/${id.data}`);
  return { ok: "Cambios guardados." };
}

// -------------------------------------------------------- archivar/reactivar

export async function archivarVarietalAction(
  _prev: VarietalFormState,
  formData: FormData,
): Promise<VarietalFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ese varietal no existe." };

  const [varietal] = await db
    .select({ isActive: varietales.isActive })
    .from(varietales)
    .where(eq(varietales.id, id.data))
    .limit(1);

  if (!varietal) return { error: "Ese varietal ya no existe." };

  const archivando = varietal.isActive;

  await db
    .update(varietales)
    .set({ isActive: !varietal.isActive, updatedAt: new Date() })
    .where(eq(varietales.id, id.data));

  revalidatePath("/admin/varietales");
  revalidatePath(`/admin/varietales/${id.data}`);

  if (!archivando) return { ok: "Varietal reactivado." };

  // Archivar lo saca del selector de productos nuevos; los vinos que ya lo
  // tienen cargado lo conservan. Decirlo evita la duda de si se perdió algo.
  const [enUso] = await db
    .select({ n: count() })
    .from(productoVarietales)
    .where(eq(productoVarietales.varietalId, id.data));

  return {
    ok:
      enUso.n === 0
        ? "Varietal archivado."
        : `Varietal archivado. Los ${enUso.n} ${
            enUso.n === 1 ? "producto que lo usa lo conserva" : "productos que lo usan lo conservan"
          }; sólo deja de ofrecerse al cargar uno nuevo.`,
  };
}
