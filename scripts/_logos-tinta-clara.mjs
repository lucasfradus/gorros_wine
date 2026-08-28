/**
 * Invierte la tinta de los logos que están calados en blanco.
 *
 *   node scripts/_logos-tinta-clara.mjs          # dry-run: dice qué haría
 *                                                # y deja una lámina para mirar
 *   APPLY=1 node scripts/_logos-tinta-clara.mjs  # escribe
 *
 * Existe por la franja de bodegas de la portada. Los logos que mandan las
 * bodegas vienen de todo tipo: unos con fondo blanco opaco, otros calados con
 * tinta oscura y otros calados con tinta **blanca**, pensados para ir sobre un
 * fondo negro. La franja los muestra sobre un chip claro —es lo único que
 * funciona para la mayoría—, y ahí los de tinta blanca no se ven.
 *
 * La alternativa era pelearlo con CSS, pintando cada logo según lo que tenga
 * adentro. No se puede: el navegador no sabe de qué color es la tinta de un
 * PNG. Se arregla en el dato, una vez, y la franja queda con una sola regla.
 *
 * **No toca los logos oscuros ni los de tono medio**: sobre el chip claro se
 * ven bien, e invertirlos los rompería. La lista de candidatos se mide, no se
 * escribe a mano: entra el que esté calado y tenga la tinta clara.
 *
 * La key de una imagen es el hash de su contenido, así que el logo invertido
 * es un archivo nuevo con su propia URL. El viejo queda en el bucket, y eso es
 * bueno: es el camino de vuelta si algo sale mal.
 *
 * One-off, con prefijo `_` y dry-run por defecto, como manda la convención de
 * `scripts/`. JavaScript plano y SQL a mano, igual que `_bodegas-seed.mjs` y
 * por el mismo motivo: tiene que poder correr dentro del contenedor desplegado.
 */
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const FALTAN = ["DATABASE_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT"]
  .filter((v) => !process.env[v]);

if (FALTAN.length > 0) {
  console.error(`\nFaltan variables: ${FALTAN.join(", ")}.`);
  process.exit(1);
}

const APPLY = process.env.APPLY === "1";

/**
 * Cuándo se considera que un logo está **calado**: menos del 85% de píxeles
 * opacos. En uno opaco lo que manda es el color del fondo y no hay nada que
 * invertir; en uno calado, lo que se ve es la tinta.
 */
const MAX_COBERTURA = 0.85;

/** Y cuándo esa tinta es "clara". 170 sobre 255 deja del lado de afuera los
 *  tonos medios, que sobre el chip claro se leen bien. */
const MIN_LUMA = 170;

/**
 * Cuánto color se le permite a la tinta para darla vuelta.
 *
 * Invertir sirve cuando el logo es monocromo: el blanco se vuelve negro y no
 * hay nada más que decidir. Con un logo **de color** no sirve, porque `negate`
 * no aclara ni oscurece, da vuelta el matiz: el dorado de Ernesto Catena
 * Vineyards sale azul. Ese no es el logo de la bodega, es otro dibujo.
 *
 * Se mide como croma —la distancia entre el canal más alto y el más bajo—
 * promediada sobre la tinta. Un blanco puro da 0; el dorado de ese logo, 90.
 * Los que queden afuera se resuelven subiendo la versión oscura desde el
 * panel, que es lo que la bodega tiene y nosotros no.
 */
const MAX_CROMA = 40;

/** El mismo umbral que `lib/content/imagen.ts`: hasta acá un logo con
 *  transparencia se guarda sin pérdida, que es lo que mantiene limpios los
 *  bordes duros. */
const MAX_PIXELES_SIN_PERDIDA = 1_000_000;

const aws = new AwsClient({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || "auto",
  service: "s3",
});

const base = new URL(process.env.S3_ENDPOINT);

function urlDe(key) {
  const ruta = key.split("/").map(encodeURIComponent).join("/");
  return process.env.S3_PATH_STYLE === "1"
    ? `${base.origin}/${process.env.S3_BUCKET}/${ruta}`
    : `${base.protocol}//${process.env.S3_BUCKET}.${base.host}/${ruta}`;
}

async function traer(key) {
  const res = await aws.fetch(urlDe(key));
  if (!res.ok) throw new Error(`El bucket devolvió ${res.status} por ${key}`);
  return Buffer.from(await res.arrayBuffer());
}

async function subir(key, bytes, mime) {
  const res = await aws.fetch(urlDe(key), {
    method: "PUT",
    // Los bytes crudos y el `content-length` a mano, por lo mismo que en
    // `lib/content/bucket.ts`: sin largo declarado el bucket contesta 411.
    body: bytes,
    headers: { "content-type": mime, "content-length": String(bytes.byteLength) },
  });
  if (!res.ok) {
    throw new Error(`El bucket rechazó ${key} (${res.status}): ${await res.text()}`);
  }
}

/** Qué tiene adentro este logo: si está calado y de qué color es su tinta. */
async function medir(bytes) {
  const img = sharp(bytes);
  const meta = await img.metadata();
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let opacos = 0;
  let suma = 0;
  let croma = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 128) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      opacos++;
      suma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      croma += Math.max(r, g, b) - Math.min(r, g, b);
    }
  }

  // El fondo se lee en la esquina, que es donde ningún logo dibuja. Sirve para
  // distinguir el archivo con fondo blanco —que se funde con el chip y no se
  // nota— del que trae su propio recuadro de color.
  const esquina = 0.2126 * data[0] + 0.7152 * data[1] + 0.0722 * data[2];

  return {
    alfa: Boolean(meta.hasAlpha),
    cobertura: opacos / (info.width * info.height),
    luma: opacos ? suma / opacos : 0,
    croma: opacos ? croma / opacos : 0,
    fondo: esquina,
    pixeles: info.width * info.height,
  };
}

/**
 * La misma imagen con la tinta invertida.
 *
 * `negate` con `alpha: false` da vuelta el color y **no toca la
 * transparencia**: el calado sigue siendo calado y los bordes suavizados
 * siguen suavizados. Un logo monocromo blanco sale negro, que es exactamente
 * la versión que la bodega usa sobre papel.
 */
async function invertir(bytes, pixeles) {
  const sinPerdida = pixeles <= MAX_PIXELES_SIN_PERDIDA;
  const { data, info } = await sharp(bytes)
    .negate({ alpha: false })
    .webp(sinPerdida ? { lossless: true } : { quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return {
    // Con su propio `ArrayBuffer`, que es lo que necesita el `content-length`.
    bytes: new Uint8Array(data),
    width: info.width,
    height: info.height,
  };
}

/**
 * La lámina para mirar antes de aplicar.
 *
 * Dos columnas por logo: a la izquierda como está hoy, sobre el negro del
 * sitio; a la derecha como va a quedar, sobre el chip claro de la franja. Con
 * eso se ve de un vistazo si la inversión salió bien o le corrió el color a un
 * logo que no era blanco puro.
 */
async function armarLamina(items) {
  const ANCHO = 220;
  const ALTO = 120;
  const MARGEN = 14;

  const capas = [];
  for (const [fila, item] of items.entries()) {
    const top = fila * ALTO;

    // La celda oscura de la izquierda. La derecha la pinta el fondo blanco.
    capas.push({
      input: {
        create: {
          width: ANCHO,
          height: ALTO,
          channels: 4,
          background: { r: 13, g: 12, b: 11, alpha: 1 },
        },
      },
      left: 0,
      top,
    });

    for (const [columna, fuente] of [item.antes, item.despues].entries()) {
      const { data, info } = await sharp(fuente)
        .resize({
          width: ANCHO - MARGEN * 2,
          height: ALTO - MARGEN * 2,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer({ resolveWithObject: true });

      capas.push({
        input: data,
        left: columna * ANCHO + Math.round((ANCHO - info.width) / 2),
        top: top + Math.round((ALTO - info.height) / 2),
      });
    }
  }

  const lamina = await sharp({
    create: {
      width: ANCHO * 2,
      height: ALTO * items.length,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(capas)
    .png()
    .toBuffer();

  const destino = join(tmpdir(), "gorros-logos-tinta-clara.png");
  writeFileSync(destino, lamina);
  return destino;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const destino = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(no se pudo leer el host)";
  }
})();

try {
  console.log(`\n${APPLY ? "Escribiendo en" : "Dry-run contra"} ${destino}\n`);

  const { rows } = await pool.query(
    `select id, nombre, slug, logo from bodegas
     where logo is not null order by nombre`,
  );

  const candidatos = [];
  const paraLamina = [];
  const salteados = [];
  const recuadros = [];

  for (const fila of rows) {
    const src = fila.logo?.src;
    if (typeof src !== "string" || !src.startsWith("/media/")) continue;

    const key = src.slice("/media/".length);
    const bytes = await traer(key);
    const { alfa, cobertura, luma, croma, pixeles, fondo } = await medir(bytes);

    // De paso, el aviso que sólo se puede dar mirando los bytes: un logo opaco
    // cuyo fondo no es blanco se va a ver como un recuadro pegado adentro del
    // chip. No hay nada que invertir ahí —el problema es el archivo, que suele
    // traer varias versiones del logo apiladas— y se arregla subiendo uno
    // mejor desde el panel.
    // Dos señales, porque una sola no alcanza: la esquina delata al que es
    // oscuro de punta a punta, y la luminancia media al que es blanco arriba y
    // tiene una mancha oscura abajo (suele ser el archivo que trae dos
    // versiones del logo apiladas). Un logo sano con fondo blanco promedia
    // arriba de 200, así que el umbral no roza a ninguno.
    if (!alfa && (fondo < 240 || luma < MIN_LUMA)) {
      console.log(
        `  ! ${fila.nombre} — opaco, fondo ${Math.round(fondo)}/255 y media ` +
          `${Math.round(luma)}/255: en la franja se va a ver el recuadro. ` +
          `Conviene otro archivo.`,
      );
      recuadros.push(fila.nombre);
      continue;
    }

    if (!alfa || cobertura >= MAX_COBERTURA || luma < MIN_LUMA) continue;

    if (croma > MAX_CROMA) {
      console.log(
        `  ! ${fila.nombre} — tinta clara pero de color (croma ${Math.round(
          croma,
        )}): se saltea, darla vuelta le cambia el color de marca.`,
      );
      salteados.push(fila.nombre);
      continue;
    }

    const invertido = await invertir(bytes, pixeles);
    const hash = createHash("sha256")
      .update(invertido.bytes)
      .digest("hex")
      .slice(0, 16);

    candidatos.push({ ...fila, key, invertido, keyNueva: `img/${hash}.webp` });
    paraLamina.push({ antes: bytes, despues: Buffer.from(invertido.bytes) });

    console.log(
      `  ~ ${fila.nombre} — tinta ${Math.round(luma)}/255 en el ${Math.round(
        cobertura * 100,
      )}% del lienzo → ${invertido.width}×${invertido.height}, ${Math.round(
        invertido.bytes.length / 1024,
      )} KB`,
    );
  }

  /** Los que hay que resolver a mano, para que no queden en el olvido. */
  const pendientes =
    (salteados.length > 0
      ? `\nQuedan a mano, subiendo la versión oscura desde el panel: ` +
        `${salteados.join(", ")}.\n`
      : "") +
    (recuadros.length > 0
      ? `\nY estos necesitan otro archivo, no otra inversión: ` +
        `${recuadros.join(", ")}.\n`
      : "");

  if (candidatos.length === 0) {
    console.log(`  (ninguno: no hay logos monocromos con la tinta clara)\n${pendientes}`);
    process.exit(0);
  }

  if (!APPLY) {
    const lamina = await armarLamina(paraLamina);
    console.log(
      `\n${candidatos.length} para invertir. Nada se escribió.\n\n` +
        `Mirá la lámina antes de aplicar — izquierda como está hoy sobre el\n` +
        `negro del sitio, derecha como va a quedar sobre el chip claro:\n\n` +
        `  ${lamina}\n\n` +
        `Si está bien, repetí con APPLY=1.\n${pendientes}`,
    );
    process.exit(0);
  }

  for (const c of candidatos) {
    // Cada bodega en su propia transacción, como en `_bodegas-seed.mjs`: si
    // una falla, las anteriores quedan hechas y el script se vuelve a correr.
    await subir(c.keyNueva, c.invertido.bytes, "image/webp");

    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      await cliente.query(
        `insert into media (key, mime, bytes, width, height, original_name)
         values ($1, 'image/webp', $2, $3, $4, $5)
         on conflict (key) do nothing`,
        [
          c.keyNueva,
          c.invertido.bytes.length,
          c.invertido.width,
          c.invertido.height,
          `${c.slug}-tinta-oscura.webp`,
        ],
      );
      await cliente.query(
        `update bodegas set logo = $1, updated_at = now() where id = $2`,
        [
          JSON.stringify({
            ...c.logo,
            src: `/media/${c.keyNueva}`,
            width: c.invertido.width,
            height: c.invertido.height,
          }),
          c.id,
        ],
      );
      await cliente.query("commit");
      console.log(`  + ${c.nombre} → /media/${c.keyNueva}`);
    } catch (err) {
      await cliente.query("rollback");
      throw new Error(`Falló ${c.nombre}: ${err.message}`, { cause: err });
    } finally {
      cliente.release();
    }
  }

  console.log(
    `\n${candidatos.length} logos invertidos. Los originales siguen en el ` +
      `bucket por si hay que volver atrás.\n${pendientes}`,
  );
} catch (err) {
  console.error(`\nFalló contra ${destino}:\n`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
