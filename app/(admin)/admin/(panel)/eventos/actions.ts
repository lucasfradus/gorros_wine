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
import { desdeInputLocal } from "@/lib/format";

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
 * La fecha llega de un `<input type="datetime-local">`: `"2026-09-18T19:30"`,
 * sin zona. `desdeInputLocal` la ancla a Buenos Aires; ver el comentario largo
 * en `lib/format.ts` sobre por qué no alcanza con `new Date(valor)`.
 *
 * El `refine` de después no es redundante con el regex: `"2026-02-31T19:30"`
 * tiene la forma correcta y no es un día que exista.
 */
const cuando = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Poné la fecha y la hora del evento.",
  )
  .transform(desdeInputLocal)
  .refine((d) => !Number.isNaN(d.getTime()), "Esa fecha no existe.");

/**
 * El precio se escribe en pesos enteros y se guarda en centavos.
 *
 * Se valida como texto y no con `coerce.number()` para poder explicar el
 * formato en castellano: "sin puntos ni centavos" es más útil que el mensaje
 * que sale solo cuando `"9.000"` no se convierte en número.
 *
 * El cero se acepta a propósito: un evento puede ser gratis.
 */
const precio = z
  .string()
  .trim()
  .regex(/^\d{1,8}$/, "El precio va en pesos, sin puntos ni centavos.")
  .transform((s) => Number(s) * 100);

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
  precio,
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
    precio: formData.get("precio"),
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

  const { titulo, comienza, lugar, detalle, precio, imagen, publicado } =
    parsed.data;

  await db.insert(eventos).values({
    titulo,
    comienza,
    lugar,
    detalle: detalle === "" ? null : detalle,
    precioCentavos: precio,
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

  const { id, titulo, comienza, lugar, detalle, precio, imagen, publicado } =
    parsed.data;

  const actualizadas = await db
    .update(eventos)
    .set({
      titulo,
      comienza,
      lugar,
      detalle: detalle === "" ? null : detalle,
      precioCentavos: precio,
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
