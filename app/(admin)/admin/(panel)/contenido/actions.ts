"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { canEditContent, requireUser } from "@/lib/auth";
import { CONTENT_TAG } from "@/lib/content/get";
import { iguales } from "@/lib/content/iguales";
import { REGISTRO, claveDe, esGrupo, type GrupoKey } from "@/lib/content/registry";
import type { Campo, CampoLista, Grupo } from "@/lib/content/types";

export interface ContentFormState {
  error?: string;
  ok?: string;
}

// La subida de imágenes vive en `../media-actions.ts`: la comparten el CMS y
// la agenda de eventos.

// ---------- guardar un grupo ----------

export async function saveGroupAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const actor = await requireUser();
  if (!canEditContent(actor)) {
    return { error: "No tenés permiso para editar el contenido." };
  }

  const grupo = formData.get("grupo");
  if (typeof grupo !== "string" || !esGrupo(grupo)) {
    return { error: "No existe esa sección de contenido." };
  }

  const campos: Record<string, Campo> = REGISTRO[grupo].campos;

  // Lo que llega del formulario, ya con la forma que declara el registro.
  const crudo: Record<string, unknown> = {};
  for (const [nombre, campo] of Object.entries(campos)) {
    crudo[nombre] = leerDelForm(campo, formData.get(nombre));
  }

  const parsed = esquemaDe(grupo).safeParse(crudo);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const donde = campos[String(issue.path[0])]?.label ?? issue.path[0];
    return { error: `${donde}: ${issue.message}` };
  }

  const valores = parsed.data as Record<string, unknown>;
  const ahora = new Date();

  await db.transaction(async (tx) => {
    for (const [nombre, campo] of Object.entries(campos)) {
      const clave = claveDe(grupo, nombre);
      const valor = valores[nombre];

      // Volvió a ser el original: se borra la fila en vez de guardarla igual.
      // Así "editado" siempre significa "distinto de lo que vino de fábrica".
      if (iguales(valor, campo.original)) {
        await tx.delete(content).where(eq(content.key, clave));
        continue;
      }

      await tx
        .insert(content)
        .values({
          key: clave,
          value: valor,
          updatedBy: actor.id,
          updatedAt: ahora,
        })
        .onConflictDoUpdate({
          target: content.key,
          set: { value: valor, updatedBy: actor.id, updatedAt: ahora },
        });
    }
  });

  invalidar(grupo);
  return { ok: "Cambios guardados. Ya se ven en el sitio." };
}

/**
 * Invalida lo que este grupo toca.
 *
 * El tag alcanzaría —`unstable_cache` cuelga de él y Next sabe qué rutas lo
 * usan—, pero las rutas van igual: es la convención del repo y hace explícito
 * qué pantalla cambia cada sección.
 */
function invalidar(grupo: GrupoKey) {
  // Anotado como `Grupo` a propósito: `REGISTRO[grupo]` con la clave sin
  // estrechar es la unión de todos los grupos, y los campos opcionales no
  // existen en todos los miembros de esa unión.
  const definicion: Grupo = REGISTRO[grupo];

  revalidateTag(CONTENT_TAG);

  for (const ruta of definicion.revalidate) revalidatePath(ruta);

  // El nav, el footer y el age gate están en el layout de la tienda: cambiarlos
  // no afecta una ruta sino todas.
  if (definicion.afectaTodo) revalidatePath("/", "layout");

  revalidatePath(`/admin/contenido/${grupo}`);
}

// ---------- del formulario al valor ----------

/**
 * Las imágenes y las listas viajan como JSON en un input oculto, porque un
 * `<input>` sólo sabe de strings y estas dos son estructuras. El resto llega
 * como texto.
 */
function leerDelForm(campo: Campo, bruto: FormDataEntryValue | null): unknown {
  if (campo.tipo === "imagen" || campo.tipo === "lista") {
    if (typeof bruto !== "string" || bruto.trim() === "") {
      return campo.tipo === "imagen" ? null : [];
    }
    try {
      return normalizarSaltos(JSON.parse(bruto));
    } catch {
      // `undefined` no valida contra ningún esquema: cae como error del campo.
      return undefined;
    }
  }

  return typeof bruto === "string" ? normalizarSaltos(bruto) : "";
}

/**
 * Deja los saltos de línea en `\n`.
 *
 * No es cosmético. Al enviar un formulario, el navegador convierte los saltos
 * de un `<textarea>` a CRLF —lo pide el estándar—, mientras que los originales
 * del registro están escritos con `\n`. Sin esto, **todo campo multilínea se
 * guardaba siempre**, aunque nadie lo hubiera tocado: nunca era igual a su
 * original. Y "restaurar el original" no borraba nada, porque lo restaurado
 * volvía a salir con CRLF.
 */
function normalizarSaltos<T>(valor: T): T {
  if (typeof valor === "string") {
    return valor.replace(/\r\n/g, "\n") as T;
  }
  if (Array.isArray(valor)) {
    return valor.map(normalizarSaltos) as T;
  }
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, normalizarSaltos(v)]),
    ) as T;
  }
  return valor;
}

// ---------- validación armada desde el registro ----------

const LARGOS = { texto: 300, parrafo: 3000, rico: 20000 } as const;

/**
 * La ruta de una imagen tiene que ser del propio sitio. Sin esto, alguien con
 * acceso al panel podría dejar apuntando las fotos a un dominio ajeno.
 */
const rutaDeImagen = z
  .string()
  .min(1, "Falta la imagen.")
  .refine(
    (s) => s.startsWith("/") && !s.startsWith("//"),
    "La imagen tiene que ser una ruta de este sitio.",
  );

const esquemaImagen = z
  .object({
    src: rutaDeImagen,
    alt: z.string().max(300, "El texto alternativo es muy largo."),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  })
  .nullable();

function zodDeCampo(campo: Campo): z.ZodType {
  switch (campo.tipo) {
    case "texto":
    case "parrafo":
    case "rico":
      return z.string().max(LARGOS[campo.tipo], "El texto es muy largo.");
    case "imagen":
      return esquemaImagen;
    case "lista":
      return zodDeLista(campo);
  }
}

function zodDeLista(campo: CampoLista): z.ZodType {
  const forma: Record<string, z.ZodType> = {};
  for (const [nombre, sub] of Object.entries(campo.item)) {
    forma[nombre] = zodDeCampo(sub);
  }

  return z
    .array(z.object(forma))
    .min(campo.min, `Tiene que haber al menos ${campo.min}.`)
    .max(campo.max, `No pueden ser más de ${campo.max}.`);
}

function esquemaDe(grupo: GrupoKey) {
  const forma: Record<string, z.ZodType> = {};
  for (const [nombre, campo] of Object.entries(REGISTRO[grupo].campos)) {
    forma[nombre] = zodDeCampo(campo);
  }
  return z.object(forma);
}

