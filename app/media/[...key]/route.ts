import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { bucketReady, traerDelBucket } from "@/lib/content/bucket";

/**
 * Sirve una imagen del bucket.
 *
 * El bucket de Railway es privado, así que esta ruta es la única puerta: trae
 * el archivo firmado y lo devuelve. Dos decisiones que valen la pena:
 *
 * - **Se consulta `media` antes de tocar el bucket.** No es por el `mime` —eso
 *   lo trae la respuesta— sino para que la ruta no sea un proxy abierto a
 *   cualquier clave del bucket. Sólo sale lo que el panel registró.
 * - **Un año de caché inmutable.** Se puede porque la clave *es* el hash del
 *   contenido: si la foto cambia, cambia la URL. Sin eso, cada visita a la
 *   portada volvería a pedirle la imagen al bucket.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: tramos } = await params;
  const key = tramos.join("/");

  if (!bucketReady()) return new Response("Not found", { status: 404 });

  const [fila] = await db
    .select({ mime: media.mime })
    .from(media)
    .where(eq(media.key, key))
    .limit(1);

  if (!fila) return new Response("Not found", { status: 404 });

  const res = await traerDelBucket(key);

  // La fila existe pero el objeto no: alguien lo borró del bucket por afuera.
  // Es un 404 y no un 500 — no hay nada que reintentar.
  if (!res.ok || !res.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "content-type": fila.mime,
    "cache-control": "public, max-age=31536000, immutable",
  });

  const largo = res.headers.get("content-length");
  if (largo) headers.set("content-length", largo);

  return new Response(res.body, { headers });
}
