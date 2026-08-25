import { AwsClient } from "aws4fetch";

/**
 * Cliente del bucket S3 donde viven las imágenes que se suben desde el panel.
 *
 * Es un bucket de Railway, y los buckets de Railway son **privados**: no hay
 * forma de publicar un archivo con una URL directa. Las dos salidas son URLs
 * presignadas o proxear desde el backend, y acá se proxea
 * (`app/media/[...key]/route.ts`). Una URL presignada vence, y una URL que
 * vence no sirve dentro de una página que se cachea: el día que expira, la
 * portada queda con las fotos rotas.
 *
 * Las credenciales van prefijadas con `S3_` y no con los nombres crudos que
 * ofrece Railway (`BUCKET`, `ACCESS_KEY_ID`) porque esos son demasiado
 * genéricos para el entorno de una app: en Railway se apuntan por referencia.
 */
const BUCKET = process.env.S3_BUCKET;
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const REGION = process.env.S3_REGION || "auto";
const ENDPOINT = process.env.S3_ENDPOINT;

/** Los buckets viejos de Railway piden el nombre en la ruta y no de subdominio.
 *  Lo dice la pestaña Credentials del bucket. */
const PATH_STYLE = process.env.S3_PATH_STYLE === "1";

/**
 * ¿Está configurado? Sin bucket el proyecto tiene que seguir levantando: en
 * local se trabaja contra la base de docker y no siempre hay credenciales.
 * Lo que se degrada es sólo la subida de imágenes, con un mensaje que lo dice.
 */
export function bucketReady(): boolean {
  return Boolean(BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY && ENDPOINT);
}

let cliente: AwsClient | null = null;

function getCliente(): AwsClient {
  if (!bucketReady()) {
    throw new Error(
      "El bucket de imágenes no está configurado. Faltan las variables S3_*.",
    );
  }
  cliente ??= new AwsClient({
    accessKeyId: ACCESS_KEY_ID!,
    secretAccessKey: SECRET_ACCESS_KEY!,
    region: REGION,
    service: "s3",
  });
  return cliente;
}

function urlDe(key: string): string {
  const base = new URL(ENDPOINT!);
  // Cada tramo por separado: encodeURIComponent convertiría las barras.
  const ruta = key.split("/").map(encodeURIComponent).join("/");

  return PATH_STYLE
    ? `${base.origin}/${BUCKET}/${ruta}`
    : `${base.protocol}//${BUCKET}.${base.host}/${ruta}`;
}

export async function subirAlBucket(
  key: string,
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const res = await getCliente().fetch(urlDe(key), {
    method: "PUT",
    // BlobPart pide un ArrayBuffer: `bytes` puede ser una vista de uno mayor.
    body: new Blob([bytes.slice().buffer], { type: mime }),
    headers: { "content-type": mime },
  });

  if (!res.ok) {
    throw new Error(
      `El bucket rechazó la subida (${res.status}): ${await res.text()}`,
    );
  }
}

/** La respuesta cruda, para que la ruta pueda pasar el cuerpo sin bufferearlo. */
export async function traerDelBucket(key: string): Promise<Response> {
  return getCliente().fetch(urlDe(key), { method: "GET" });
}
