/**
 * Ancho y alto leídos de la cabecera del archivo, sin dependencias.
 *
 * Sirve para que `next/image` pueda reservar el espacio antes de que la foto
 * cargue. Se hace en el servidor y no con `createImageBitmap` en el navegador
 * a propósito: lo que manda el cliente se puede editar, y una medida mentida
 * mueve la maqueta de toda la página.
 *
 * Sólo entiende los tres formatos que acepta la subida (`lib/content/bucket`).
 * Si no reconoce el archivo devuelve `null`, y la imagen se maqueta con `fill`
 * como hace hoy el hero.
 */
export interface Medidas {
  width: number;
  height: number;
}

export function medirImagen(b: Uint8Array): Medidas | null {
  return medirPng(b) ?? medirJpeg(b) ?? medirWebp(b);
}

export type Formato = "png" | "jpeg" | "webp";

export const FORMATOS: Record<Formato, { mime: string; ext: string }> = {
  png: { mime: "image/png", ext: "png" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  webp: { mime: "image/webp", ext: "webp" },
};

/**
 * Qué es el archivo **según sus bytes**, no según lo que dice el navegador.
 *
 * Importa más de lo que parece: el `mime` que se guarda es el que
 * `app/media/[...key]/route.ts` devuelve como `content-type`. Si eso saliera
 * de un campo que manda el cliente, alguien podría subir un archivo declarado
 * como HTML y quedaría un documento servido desde nuestro propio dominio.
 */
export function detectarFormato(b: Uint8Array): Formato | null {
  if (medirPng(b)) return "png";
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

function medirPng(b: Uint8Array): Medidas | null {
  if (b.length < 24) return null;
  for (let i = 0; i < FIRMA_PNG.length; i++) {
    if (b[i] !== FIRMA_PNG[i]) return null;
  }
  // El primer chunk de un PNG es siempre IHDR, y arranca con ancho y alto.
  const v = vista(b);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

function medirJpeg(b: Uint8Array): Medidas | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  const v = vista(b);
  let i = 2;

  // Un JPEG es una cadena de segmentos; las medidas están en el SOF, que puede
  // venir después de metadatos de tamaño arbitrario. Hay que recorrerlos.
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++; // relleno entre segmentos
      continue;
    }

    const marca = b[i + 1];

    // Marcas sin carga útil: se saltean sin leer largo.
    if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marca === 0xd9 || marca === 0xda) return null; // fin, o empezó la imagen

    const largo = v.getUint16(i + 2);
    if (largo < 2) return null;

    // SOF0..SOF15, menos DHT (c4), JPG (c8) y DAC (cc), que caen en el mismo rango.
    const esSof =
      marca >= 0xc0 &&
      marca <= 0xcf &&
      marca !== 0xc4 &&
      marca !== 0xc8 &&
      marca !== 0xcc;

    if (esSof) {
      return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
    }

    i += 2 + largo;
  }

  return null;
}

function medirWebp(b: Uint8Array): Medidas | null {
  if (b.length < 20) return null;
  if (leerTexto(b, 0, 4) !== "RIFF" || leerTexto(b, 8, 4) !== "WEBP") return null;

  switch (leerTexto(b, 12, 4)) {
    // Con pérdida: marco VP8 con su código de sincronismo antes de las medidas.
    case "VP8 ": {
      if (b.length < 30) return null;
      if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
      return {
        width: (b[26] | (b[27] << 8)) & 0x3fff,
        height: (b[28] | (b[29] << 8)) & 0x3fff,
      };
    }

    // Sin pérdida: 14 bits para cada medida, empaquetados y guardados menos uno.
    case "VP8L": {
      if (b.length < 25 || b[20] !== 0x2f) return null;
      const bits =
        (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }

    // Extendido (animación, alfa, metadatos): las medidas son las del lienzo.
    case "VP8X": {
      if (b.length < 30) return null;
      return {
        width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
        height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
      };
    }

    default:
      return null;
  }
}

function vista(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function leerTexto(b: Uint8Array, desde: number, largo: number): string {
  let s = "";
  for (let i = desde; i < desde + largo; i++) s += String.fromCharCode(b[i]);
  return s;
}
