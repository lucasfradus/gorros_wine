"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bodegas, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/catalogo";
import {
  emailOpcional,
  sitioOpcional,
  slugOpcional,
  textoOpcional,
} from "@/lib/campos";

export interface BodegaFormState {
  error?: string;
  ok?: string;
}

const esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre de la bodega es muy corto."),
  slug: slugOpcional,
  pais: textoOpcional,
  sitioWeb: sitioOpcional,
  contactoNombre: textoOpcional,
  contactoEmail: emailOpcional,
  contactoTelefono: textoOpcional,
  notas: textoOpcional,
});

function leer(formData: FormData) {
  return esquema.safeParse({
    nombre: formData.get("nombre") ?? "",
    slug: formData.get("slug") ?? "",
    pais: formData.get("pais") ?? "",
    sitioWeb: formData.get("sitioWeb") ?? "",
    contactoNombre: formData.get("contactoNombre") ?? "",
    contactoEmail: formData.get("contactoEmail") ?? "",
    contactoTelefono: formData.get("contactoTelefono") ?? "",
    notas: formData.get("notas") ?? "",
  });
}

/**
 * ¿El nombre o el slug ya están tomados por **otra** bodega?
 *
 * Se chequea antes de escribir para poder devolver un mensaje que se entienda.
 * El UNIQUE de la base sigue estando y es el que manda: esto es cortesía con
 * quien carga, no la garantía.
 */
async function buscarChoque(
  nombre: string,
  slug: string,
  exceptoId?: string,
): Promise<string | null> {
  const otras = exceptoId ? ne(bodegas.id, exceptoId) : undefined;

  const [porNombre] = await db
    .select({ id: bodegas.id })
    .from(bodegas)
    .where(and(eq(bodegas.nombre, nombre), otras))
    .limit(1);

  if (porNombre) return "Ya hay una bodega con ese nombre.";

  const [porSlug] = await db
    .select({ id: bodegas.id })
    .from(bodegas)
    .where(and(eq(bodegas.slug, slug), otras))
    .limit(1);

  if (porSlug) return "Ya hay una bodega con ese slug. Cambiá el slug.";

  return null;
}

// ---------------------------------------------------------------- crear

export async function crearBodegaAction(
  _prev: BodegaFormState,
  formData: FormData,
): Promise<BodegaFormState> {
  await requireUser();

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { nombre, slug, ...resto } = parsed.data;
  // Si no lo escribieron a mano, sale del nombre.
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }

  const choque = await buscarChoque(nombre, slugFinal);
  if (choque) return { error: choque };

  await db.insert(bodegas).values({ nombre, slug: slugFinal, ...resto });

  revalidatePath("/admin/bodegas");
  redirect("/admin/bodegas");
}

// ---------------------------------------------------------------- editar

export async function editarBodegaAction(
  _prev: BodegaFormState,
  formData: FormData,
): Promise<BodegaFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Esa bodega no existe." };

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { nombre, slug, ...resto } = parsed.data;
  const slugFinal = slug || slugify(nombre);

  if (!slugFinal) {
    return { error: "De ese nombre no sale un slug. Escribí uno a mano." };
  }

  const choque = await buscarChoque(nombre, slugFinal, id.data);
  if (choque) return { error: choque };

  const actualizadas = await db
    .update(bodegas)
    .set({ nombre, slug: slugFinal, ...resto, updatedAt: new Date() })
    .where(eq(bodegas.id, id.data))
    .returning({ id: bodegas.id });

  if (actualizadas.length === 0) return { error: "Esa bodega ya no existe." };

  revalidatePath("/admin/bodegas");
  revalidatePath(`/admin/bodegas/${id.data}`);
  return { ok: "Cambios guardados." };
}

// -------------------------------------------------------- archivar/reactivar

/**
 * Archiva o reactiva. **No hay borrado**, y la FK de `productos` es
 * `restrict`: una bodega con vinos cargados no se puede borrar ni por error.
 *
 * Archivar con productos activos está permitido a propósito —se deja de
 * comprarle a un proveedor mucho antes de terminar de vender lo que queda en
 * la góndola—, pero la respuesta lo dice, para que nadie descubra dentro de un
 * mes que sus vinos siguen publicados.
 */
export async function archivarBodegaAction(
  _prev: BodegaFormState,
  formData: FormData,
): Promise<BodegaFormState> {
  await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Esa bodega no existe." };

  const [bodega] = await db
    .select({ isActive: bodegas.isActive })
    .from(bodegas)
    .where(eq(bodegas.id, id.data))
    .limit(1);

  if (!bodega) return { error: "Esa bodega ya no existe." };

  const archivando = bodega.isActive;

  await db
    .update(bodegas)
    .set({ isActive: !bodega.isActive, updatedAt: new Date() })
    .where(eq(bodegas.id, id.data));

  revalidatePath("/admin/bodegas");
  revalidatePath(`/admin/bodegas/${id.data}`);

  if (!archivando) return { ok: "Bodega reactivada." };

  const [activos] = await db
    .select({ n: count() })
    .from(productos)
    .where(and(eq(productos.bodegaId, id.data), eq(productos.isActive, true)));

  return {
    ok:
      activos.n === 0
        ? "Bodega archivada."
        : `Bodega archivada. Ojo: sus ${activos.n} ${
            activos.n === 1 ? "producto sigue activo" : "productos siguen activos"
          } en el catálogo.`,
  };
}
