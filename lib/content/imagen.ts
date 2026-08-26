import sharp from "sharp";

/**
 * El paso obligatorio entre "alguien eligió un archivo" y "esto va al bucket".
 *
 * Todas las imágenes del sitio entran por acá —el CMS, la agenda de eventos y
 * el catálogo suben por la misma action— y salen convertidas a un único WebP
 * canónico: derecho, sin metadatos y de un tamaño que tenga sentido para una
 * pantalla. No se guardan variantes por breakpoint a propósito: eso ya lo hace
 * `next/image` al servir, y armar un sistema de derivados propio es
 * reimplementarlo.
 *
 * La función es pura —entra un `Uint8Array`, sale otro— y no sabe de sesiones
 * ni de la base. Eso es lo que deja llamarla desde un script y no sólo desde
 * la Server Action.
 */

/** Los formatos que se aceptan de entrada. La salida es siempre WebP. */
export type Formato = "png" | "jpeg" | "webp";

export const FORMATOS: Record<Formato, { mime: string; ext: string }> = {
  png: { mime: "image/png", ext: "png" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  webp: { mime: "image/webp", ext: "webp" },
};

/**
 * Un archivo que no se pudo leer como imagen, con un mensaje mostrable.
 *
 * Existe como clase para que quien llama pueda distinguir "el usuario subió un
 * archivo roto" de "se rompió algo nuestro". Lo primero se cuenta tal cual; lo
 * segundo no, porque un mensaje crudo de libvips no le dice nada a nadie.
 */
export class ImagenIlegible extends Error {}

export interface ImagenPreparada {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  /** Del archivo ya normalizado: es el que se va a servir y a maquetar. */
  width: number;
  height: number;
}

/**
 * Lado mayor de la imagen guardada.
 *
 * El lugar más ancho del sitio mide 1180 px (el `sizes` de `ContentImage`), así
 * que 2400 lo cubre a 2× en una pantalla retina y ahí se corta: más que eso son
 * bytes que ningún visitante llega a ver. Nunca se agranda una imagen chica.
 */
const LADO_MAYOR = 2400;

/**
 * Techo de píxeles que se le deja decodificar a libvips.
 *
 * No es lo mismo que el tope de peso del archivo: un PNG de 2 MB puede
 * descomprimir a 50000×50000 y comerse la memoria del contenedor. 60 MP deja
 * pasar cualquier cámara real —una de 48 MP incluida— y corta el resto.
 */
const MAX_PIXELES = 60_000_000;

/**
 * Hasta acá una imagen con transparencia se considera un logo y no una foto.
 * Un logo con bordes duros a q82 sale sucio, y sin pérdida cuesta unos pocos
 * KB más; una foto sin pérdida, en cambio, sale enorme.
 */
const MAX_PIXELES_SIN_PERDIDA = 1_000_000;

export async function prepararImagen(
  entrada: Uint8Array,
): Promise<ImagenPreparada> {
  const img = sharp(entrada, { limitInputPixels: MAX_PIXELES });

  let alfa = false;
  let pixeles = 0;
  try {
    const meta = await img.metadata();
    alfa = Boolean(meta.hasAlpha);
    pixeles = (meta.width ?? 0) * (meta.height ?? 0);
  } catch (error) {
    // El techo de píxeles salta acá y no en el pipeline: libvips lo controla
    // apenas lee la cabecera, antes de decodificar nada.
    throw comoIlegible(error);
  }

  const sinPerdida = alfa && pixeles <= MAX_PIXELES_SIN_PERDIDA;

  try {
    const { data, info } = await img
      // Sin argumentos, `rotate` aplica el EXIF Orientation y lo saca. Es lo
      // que endereza las fotos verticales de celular, que el sensor graba
      // apaisadas con una marca de "rotar 90°".
      .rotate()
      .resize({
        width: LADO_MAYOR,
        height: LADO_MAYOR,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp(sinPerdida ? { lossless: true } : { quality: 82 })
      // sharp descarta los metadatos salvo que se le pidan: el EXIF con las
      // coordenadas GPS de la foto se queda afuera solo. El perfil de color es
      // la excepción que sí hay que pedir — sin él, una foto sacada en Display
      // P3 se ve con los colores corridos, y acá el color de una etiqueta de
      // vino es el producto.
      .keepIccProfile()
      .toBuffer({ resolveWithObject: true });

    return {
      // Copia a un `Uint8Array` propio: `subirAlBucket` arma el cuerpo con
      // `bytes.slice().buffer`, y en un `Buffer` de Node `slice` devuelve una
      // vista de la memoria compartida del pool, no una copia. Subiríamos el
      // pool entero en vez de la imagen.
      bytes: new Uint8Array(data),
      mime: FORMATOS.webp.mime,
      ext: FORMATOS.webp.ext,
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    throw comoIlegible(error);
  }
}

/**
 * Traduce lo que tira sharp a algo que se le pueda mostrar a una persona.
 *
 * Los dos casos que llegan hasta acá son problemas del archivo que entró —está
 * roto, o es demasiado grande para decodificarlo—, no nuestros, así que se
 * cuentan. Un mensaje crudo de libvips, en cambio, no le sirve a nadie.
 */
function comoIlegible(error: unknown): ImagenIlegible {
  const mensaje = error instanceof Error ? error.message : "";

  return new ImagenIlegible(
    mensaje.includes("pixel limit")
      ? "Esa imagen tiene demasiados píxeles para procesarla. Exportala más chica."
      : "No se pudo leer esa imagen: puede estar dañada o incompleta.",
  );
}

/**
 * Qué es el archivo **según sus bytes**, no según lo que dice el navegador.
 *
 * Es la lista blanca que corre antes de que libvips toque nada: se confirma la
 * firma del archivo y recién ahí se decodifica. Vale como defensa en
 * profundidad —libvips tiene historial de CVEs— y además da el mensaje de
 * error correcto cuando alguien sube un PDF renombrado a `.jpg`.
 */
export function detectarFormato(b: Uint8Array): Formato | null {
  if (esPng(b)) return "png";
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpeg";
  }
  if (
    b.length >= 16 &&
    leerTexto(b, 0, 4) === "RIFF" &&
    leerTexto(b, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function esPng(b: Uint8Array): boolean {
  if (b.length < FIRMA_PNG.length) return false;
  return FIRMA_PNG.every((byte, i) => b[i] === byte);
}

function leerTexto(b: Uint8Array, desde: number, largo: number): string {
  let s = "";
  for (let i = desde; i < desde + largo; i++) s += String.fromCharCode(b[i]);
  return s;
}
