"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEditContent, requireUser } from "@/lib/auth";
import { bucketReady, subirAlBucket } from "@/lib/content/bucket";
import type { ImagenValor } from "@/lib/content/types";
import {
  FORMATOS,
  detectarFormato,
  medirImagen,
} from "@/lib/content/image-size";

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

/** 4 MB. El límite del cuerpo de una Server Action está en 6 en next.config. */
const MAX_BYTES = 4 * 1024 * 1024;

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
      console.error("[media] falló la subida al bucket:", error);
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
