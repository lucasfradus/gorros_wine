"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEditContent, requireUser } from "@/lib/auth";
import { bucketReady, subirAlBucket } from "@/lib/content/bucket";
import {
  MAX_BYTES_SUBIDA,
  mensajeDemasiadoPesada,
} from "@/lib/content/limites";
import type { ImagenValor } from "@/lib/content/types";
import {
  ImagenIlegible,
  type ImagenPreparada,
  detectarFormato,
  prepararImagen,
} from "@/lib/content/imagen";

/**
 * Subir una foto al bucket, desde cualquier sección del panel.
 *
 * Vive en la raíz del panel y no adentro de `contenido/` porque ya son dos las
 * pantallas que suben fotos —el CMS y la agenda de eventos— y no tienen nada
 * que ver entre sí. Que una importara de la carpeta de la otra las ataba sin
 * motivo.
 */

export interface SubidaState {
  error?: string;
  imagen?: ImagenValor;
}

export async function uploadMediaAction(
  formData: FormData,
): Promise<SubidaState> {
  const actor = await requireUser();

  // El permiso fino es de la pantalla que después guarda la referencia, no de
  // la subida en sí: una imagen huérfana en el bucket no se ve en ningún lado.
  // Por eso alcanza con el permiso más laxo de los que llegan hasta acá.
  if (!canEditContent(actor)) {
    return { error: "No tenés permiso para subir imágenes." };
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

  // El campo del panel ya frena esto antes de mandarlo, pero el control que
  // vale es el de acá: el cliente se puede editar.
  if (archivo.size > MAX_BYTES_SUBIDA) {
    return { error: mensajeDemasiadoPesada(archivo.size) };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());

  // El formato sale de los bytes, no del `type` que manda el navegador.
  if (!detectarFormato(bytes)) {
    return { error: "Ese archivo no es una imagen JPG, PNG ni WebP." };
  }

  let preparada: ImagenPreparada;
  try {
    preparada = await prepararImagen(bytes);
  } catch (error) {
    // Lo que el archivo tiene de malo se cuenta; cualquier otra cosa es
    // nuestra y no le sirve a quien está subiendo una foto.
    if (error instanceof ImagenIlegible) return { error: error.message };
    console.error("[media] falló la normalización:", error);
    return { error: "No se pudo procesar la imagen. Probá de nuevo." };
  }

  // El hash es el de la imagen **ya preparada**, no el del archivo que llegó.
  // La key es lo que `app/media/[...key]/route.ts` sirve con caché inmutable de
  // un año: si hasheáramos el original, el día que cambie la calidad la misma
  // URL devolvería bytes distintos, y esa caché no se purga.
  const hash = createHash("sha256")
    .update(preparada.bytes)
    .digest("hex")
    .slice(0, 16);
  const key = `img/${hash}.${preparada.ext}`;

  // La clave es el contenido: si ya está, es exactamente la misma imagen.
  const [ya] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.key, key))
    .limit(1);

  if (!ya) {
    try {
      await subirAlBucket(key, preparada.bytes, preparada.mime);
    } catch (error) {
      console.error("[media] falló la subida al bucket:", error);
      return {
        error: "No se pudo guardar la imagen. Probá de nuevo en un momento.",
      };
    }

    await db
      .insert(media)
      .values({
        key,
        mime: preparada.mime,
        bytes: preparada.bytes.length,
        width: preparada.width,
        height: preparada.height,
        originalName: archivo.name.slice(0, 200),
        createdBy: actor.id,
      })
      .onConflictDoNothing();
  }

  return {
    imagen: {
      src: `/media/${key}`,
      alt: "",
      width: preparada.width,
      height: preparada.height,
    },
  };
}
