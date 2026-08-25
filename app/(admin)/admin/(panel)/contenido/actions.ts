"use server";

import { createHash } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { content, media } from "@/lib/db/schema";
import { canEditContent, requireUser } from "@/lib/auth";
import { CONTENT_TAG } from "@/lib/content/get";
import { iguales } from "@/lib/content/iguales";
import { REGISTRO, claveDe, esGrupo, type GrupoKey } from "@/lib/content/registry";
import type {
  Campo,
  CampoLista,
  Grupo,
  ImagenValor,
} from "@/lib/content/types";
import { bucketReady, subirAlBucket } from "@/lib/content/bucket";
import {
  FORMATOS,
  detectarFormato,
  medirImagen,
} from "@/lib/content/image-size";

export interface ContentFormState {
  error?: string;
  ok?: string;
}

export interface SubidaState {
  error?: string;
  imagen?: ImagenValor;
}

/** 4 MB. El límite del cuerpo de una Server Action está en 6 en next.config. */
const MAX_BYTES = 4 * 1024 * 1024;

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

// ---------- subir una imagen ----------

export async function uploadMediaAction(
  formData: FormData,
): Promise<SubidaState> {
  const actor = await requireUser();
  if (!canEditContent(actor)) {
    return { error: "No tenés permiso para editar el contenido." };
  }

  if (!bucketReady()) {
    return {
      error:
        "El almacenamiento de imágenes no está configurado en este entorno. Avisale a quien administra el sitio.",
    };
  }

  const archivo = formData.get("file");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "No llegó ningún archivo." };
  }

  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return {
      error: `La imagen pesa ${mb} MB y el máximo son 4 MB. Achicala e intentá de nuevo.`,
    };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());

  // El formato sale de los bytes, no del `type` que manda el navegador.
  const formato = detectarFormato(bytes);
  if (!formato) {
    return { error: "Ese archivo no es una imagen JPG, PNG ni WebP." };
  }

  const { mime, ext } = FORMATOS[formato];
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const key = `img/${hash}.${ext}`;
  const medidas = medirImagen(bytes);

  // La clave es el contenido: si ya está, es exactamente la misma imagen.
  const [ya] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.key, key))
    .limit(1);

  if (!ya) {
    try {
      await subirAlBucket(key, bytes, mime);
    } catch (error) {
      console.error("[contenido] falló la subida al bucket:", error);
      return {
        error: "No se pudo guardar la imagen. Probá de nuevo en un momento.",
      };
    }

    await db
      .insert(media)
      .values({
        key,
        mime,
        bytes: bytes.length,
        width: medidas?.width ?? null,
        height: medidas?.height ?? null,
        originalName: archivo.name.slice(0, 200),
        createdBy: actor.id,
      })
      .onConflictDoNothing();
  }

  return {
    imagen: {
      src: `/media/${key}`,
      alt: "",
      width: medidas?.width ?? null,
      height: medidas?.height ?? null,
    },
  };
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

