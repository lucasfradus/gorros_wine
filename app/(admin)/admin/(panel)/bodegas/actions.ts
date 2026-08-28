"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bodegas, productos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { BODEGAS_TAG } from "@/lib/bodegas";
import { slugify } from "@/lib/catalogo";
import {
  emailOpcional,
  sitioOpcional,
  slugOpcional,
  textoOpcional,
} from "@/lib/campos";
import { esquemaImagen } from "@/lib/content/esquema-imagen";

export interface BodegaFormState {
  error?: string;
  ok?: string;
}

const esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre de la bodega es muy corto."),
  slug: slugOpcional,
  logo: esquemaImagen,
  pais: textoOpcional,
  sitioWeb: sitioOpcional,
  contactoNombre: textoOpcional,
  contactoEmail: emailOpcional,
  contactoTelefono: textoOpcional,
  notas: textoOpcional,
  mostrarEnHome: z.boolean(),
});

function leer(formData: FormData) {
  // El logo viaja como JSON en un input oculto, porque un `<input>` sólo sabe
  // de strings y ésta es una estructura. Mismo camino que la foto de un
  // evento. Si el JSON viene roto queda `undefined`, que no valida contra
  // ningún esquema y cae como error del campo.
  const crudo = formData.get("logo");
  let logo: unknown = null;

  if (typeof crudo === "string" && crudo.trim() !== "") {
    try {
      logo = JSON.parse(crudo);
    } catch {
      logo = undefined;
    }
  }

  return esquema.safeParse({
    nombre: formData.get("nombre") ?? "",
    slug: formData.get("slug") ?? "",
    logo,
    pais: formData.get("pais") ?? "",
    sitioWeb: formData.get("sitioWeb") ?? "",
    contactoNombre: formData.get("contactoNombre") ?? "",
    contactoEmail: formData.get("contactoEmail") ?? "",
    contactoTelefono: formData.get("contactoTelefono") ?? "",
    notas: formData.get("notas") ?? "",
    // Un checkbox que nadie tildó no viaja en el formulario.
    mostrarEnHome: formData.get("mostrarEnHome") === "on",
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

/**
 * Lo que hay que invalidar cuando cambia una bodega.
 *
 * El tag es el que hace el trabajo: de él cuelga el `unstable_cache` de
 * `lib/bodegas.ts`, y sin invalidarlo la portada sigue sirviendo la franja
 * vieja por más que se marquen las rutas. La home va igual, porque es la
 * convención del repo y deja explícito qué pantalla cambia.
 *
 * Aplica a las tres acciones y no sólo a la de editar: dar de alta una bodega
 * ya tildada la mete en la portada, y archivar una que estaba tildada la saca.
 */
function invalidar(id?: string) {
  revalidateTag(BODEGAS_TAG);
  revalidatePath("/");
  revalidatePath("/admin/bodegas");
  if (id) revalidatePath(`/admin/bodegas/${id}`);
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

  invalidar();
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

  invalidar(id.data);
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

  invalidar(id.data);

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
