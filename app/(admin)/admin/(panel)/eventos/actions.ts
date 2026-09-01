"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { esquemaImagen } from "@/lib/content/esquema-imagen";
import { EVENTOS_TAG } from "@/lib/eventos";

export interface EventoFormState {
  error?: string;
  ok?: string;
}

/**
 * Lo que toca invalidar cuando cambia la agenda.
 *
 * El tag es el que hace el trabajo: de él cuelga el `unstable_cache` de
 * `lib/eventos.ts`, y sin invalidarlo la tienda sigue sirviendo la lista vieja
 * por más que se marquen las rutas. Las rutas van igual —la página de eventos,
 * la home que muestra los dos próximos, y el listado del panel— porque es la
 * convención del repo y deja explícito qué pantalla cambia.
 */
function invalidar() {
  revalidateTag(EVENTOS_TAG);
  revalidatePath("/eventos");
  revalidatePath("/");
  revalidatePath("/admin/eventos");
}

// ---------------------------------------------------------------- validación

/**
 * La fecha llega de un `<input type="date">` como `"2026-09-18"`, que es
 * exactamente lo que guarda la columna: acá no hay nada que convertir, sólo
 * que validar.
 *
 * El `refine` no es redundante con el regex: `"2026-02-31"` tiene la forma
 * correcta y no es un día que exista. Se chequea contra un `Date` en UTC —el
 * único de todo el módulo, y a propósito: se construye y se lee en la misma
 * zona, así que no hay corrimiento posible—. El guarda de `NaN` va primero
 * porque `toISOString()` de una fecha inválida tira.
 */
const cuando = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha del evento.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Esa fecha no existe.");

const esquema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, "El título es muy corto.")
    .max(200, "El título es muy largo."),
  comienza: cuando,
  lugar: z
    .string()
    .trim()
    .min(2, "Poné dónde es.")
    .max(200, "El lugar es muy largo."),
  detalle: z.string().trim().max(300, "El detalle es muy largo."),
  imagen: esquemaImagen,
  publicado: z.boolean(),
});

const conId = esquema.extend({ id: z.uuid() });

/**
 * Del formulario a algo que zod pueda mirar.
 *
 * La imagen viaja como JSON en un input oculto, porque un `<input>` sólo sabe
 * de strings y ésta es una estructura. Si el JSON viene roto se devuelve
 * `undefined`, que no valida contra ningún esquema y cae como error del campo.
 */
function leerFormulario(formData: FormData) {
  const crudo = formData.get("imagen");
  let imagen: unknown = null;

  if (typeof crudo === "string" && crudo.trim() !== "") {
    try {
      imagen = JSON.parse(crudo);
    } catch {
      imagen = undefined;
    }
  }

  return {
    titulo: formData.get("titulo"),
    comienza: formData.get("comienza"),
    lugar: formData.get("lugar"),
    detalle: formData.get("detalle") ?? "",
    imagen,
    // Un checkbox que nadie tildó no viaja en el formulario.
    publicado: formData.get("publicado") === "on",
  };
}

// ---------------------------------------------------------------- crear

export async function createEventoAction(
  _prev: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  // Autorizar es lo primero, y va también acá y no sólo en la página: una
  // Server Action es un endpoint HTTP y se invoca sin pasar por la pantalla
  // que la muestra. La agenda la editan los dos roles: con exigir sesión basta.
  await requireUser();

  const parsed = esquema.safeParse(leerFormulario(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { titulo, comienza, lugar, detalle, imagen, publicado } = parsed.data;

  await db.insert(eventos).values({
    titulo,
    comienza,
    lugar,
    detalle: detalle === "" ? null : detalle,
    imagen,
    publicado,
  });

  invalidar();
  redirect("/admin/eventos");
}

// ---------------------------------------------------------------- editar

export async function updateEventoAction(
  _prev: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  // Autorizar es lo primero, y va también acá y no sólo en la página: una
  // Server Action es un endpoint HTTP y se invoca sin pasar por la pantalla
  // que la muestra. La agenda la editan los dos roles: con exigir sesión basta.
  await requireUser();

  const parsed = conId.safeParse({
    ...leerFormulario(formData),
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, titulo, comienza, lugar, detalle, imagen, publicado } =
    parsed.data;

  const actualizadas = await db
    .update(eventos)
    .set({
      titulo,
      comienza,
      lugar,
      detalle: detalle === "" ? null : detalle,
      imagen,
      publicado,
      updatedAt: new Date(),
    })
    .where(eq(eventos.id, id))
    .returning({ id: eventos.id });

  if (actualizadas.length === 0) return { error: "Ese evento ya no existe." };

  invalidar();
  revalidatePath(`/admin/eventos/${id}`);
  return { ok: "Cambios guardados." };
}

// ---------------------------------------------------------------- borrar

export async function deleteEventoAction(
  _prev: EventoFormState,
  formData: FormData,
): Promise<EventoFormState> {
  // Autorizar es lo primero, y va también acá y no sólo en la página: una
  // Server Action es un endpoint HTTP y se invoca sin pasar por la pantalla
  // que la muestra. La agenda la editan los dos roles: con exigir sesión basta.
  await requireUser();

  const parsed = z.uuid().safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Ese evento ya no existe." };

  await db.delete(eventos).where(eq(eventos.id, parsed.data));

  invalidar();
  redirect("/admin/eventos");
}
