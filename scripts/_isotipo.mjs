/**
 * Genera los assets de marca a partir de `public/logos/isologo.png`.
 *
 *   node scripts/_isotipo.mjs            # dry-run: dice qué cambiaría
 *   APPLY=1 node scripts/_isotipo.mjs    # escribe
 *
 * Por qué existe este script y no un SVG dibujado a mano: el pack de logos no
 * trae vector y su README desaconseja redibujarlo, porque redibujar es
 * reinterpretar. Acá no se reinterpreta nada — se traza el canal alfa del PNG
 * de 1254px, que es el original más limpio que hay. Si algún día llega el AI o
 * el EPS de verdad, se tira este script y se usa aquel.
 *
 * Emite dos pesos ópticos del mismo símbolo. El trazo de la marca es apenas el
 * 1,93% de su ancho: a 32px queda en 0,6px y se deshace en una mancha gris (el
 * `favicon-32x32.png` del pack es exactamente eso). Para los iconos chicos se
 * dilata la máscara en origen, que engorda el trazo sin mover la geometría.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ORIGEN = path.join(RAIZ, "public/logos/isologo.png");
const APPLY = process.env.APPLY === "1";

/** Tolerancia de Douglas-Peucker, en píxeles del original. */
const EPS = 1.5;
/** Dilatación para el peso de iconos. 12px es el máximo que conserva los 16
 *  contornos: a partir de 14 se empiezan a cerrar los lazos de las gotas. */
const DILATACION = 12;

const ROJO = "#e00000";
const NOCHE = "#0d0c0b";

/** Cuánto del lado ocupa la marca según lleve tile atrás o vaya calada. */
const AIRE_TILE = 0.68;
const AIRE_CALADO = 0.94;

// ---------------------------------------------------------------- PNG: leer

/** Decodifica un PNG RGBA de 8 bits sin interlace (que es lo que hay acá). */
function leerPNG(ruta) {
  const d = fs.readFileSync(ruta);
  let o = 8;
  const idat = [];
  let w, h, ct;
  while (o < d.length) {
    const len = d.readUInt32BE(o);
    const tipo = d.subarray(o + 4, o + 8).toString();
    const datos = d.subarray(o + 8, o + 8 + len);
    if (tipo === "IHDR") {
      w = datos.readUInt32BE(0);
      h = datos.readUInt32BE(4);
      ct = datos[9];
      if (datos[8] !== 8 || datos[12] !== 0) throw new Error("PNG no soportado");
    }
    if (tipo === "IDAT") idat.push(datos);
    o += 12 + len;
  }
  const crudo = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const paso = w * bpp;
  const out = Buffer.alloc(h * paso);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filtro = crudo[pos++];
    const linea = crudo.subarray(pos, pos + paso);
    pos += paso;
    for (let x = 0; x < paso; x++) {
      const a = x >= bpp ? out[y * paso + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * paso + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * paso + x - bpp] : 0;
      let v = linea[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * paso + x] = v & 255;
    }
  }
  return { w, h, bpp, datos: out };
}

// ------------------------------------------------------------- PNG: escribir

let TABLA_CRC = null;
function crc32(buf) {
  if (!TABLA_CRC) {
    TABLA_CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLA_CRC[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function trozo(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

function escribirPNG(w, h, rgba) {
  const crudo = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    crudo[y * (w * 4 + 1)] = 0; // filtro None: son imágenes chicas y planas
    rgba.copy(crudo, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ máscara

function mascaraDe({ w, h, bpp, datos }) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = datos[i * bpp + 3] > 127 ? 1 : 0;
  return m;
}

/** Dilatación morfológica con elemento circular de radio R. */
function dilatar(m, w, h, R) {
  if (R <= 0) return m;
  const out = new Uint8Array(w * h);
  const filas = [];
  for (let dy = -R; dy <= R; dy++) filas.push([dy, Math.floor(Math.sqrt(R * R - dy * dy))]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (const [dy, dx] of filas) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const a = Math.max(0, x - dx);
        const b = Math.min(w - 1, x + dx);
        out.fill(1, ny * w + a, ny * w + b + 1);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ contornos

/**
 * Saca los contornos cerrados de la máscara siguiendo las "grietas" entre
 * píxeles: cada píxel lleno aporta los lados que dan a vacío, todos con el
 * mismo sentido de giro, y encadenados por sus extremos cierran bucles exactos.
 */
function contornos(m, w, h) {
  const en = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
  const aristas = new Map();
  const agregar = (sx, sy, ex, ey) => {
    const k = sx + "," + sy;
    let l = aristas.get(k);
    if (!l) aristas.set(k, (l = []));
    l.push([ex, ey]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!en(x, y)) continue;
      if (!en(x, y - 1)) agregar(x, y, x + 1, y);
      if (!en(x + 1, y)) agregar(x + 1, y, x + 1, y + 1);
      if (!en(x, y + 1)) agregar(x + 1, y + 1, x, y + 1);
      if (!en(x - 1, y)) agregar(x, y + 1, x, y);
    }
  }

  const bucles = [];
  while (aristas.size) {
    let [cx, cy] = aristas.keys().next().value.split(",").map(Number);
    const pts = [[cx, cy]];
    let previo = null;
    for (;;) {
      const k = cx + "," + cy;
      const l = aristas.get(k);
      if (!l || !l.length) break;
      let i = 0;
      // En un toque diagonal salen dos aristas del mismo vértice. Se elige el
      // giro más cerrado para no fusionar dos brazos que sólo comparten esquina.
      if (l.length > 1 && previo) {
        const ex = previo[0] - cx, ey = previo[1] - cy;
        let mejor = -Infinity;
        l.forEach(([nx, ny], j) => {
          const dx = nx - cx, dy = ny - cy;
          const ang = Math.atan2(ex * dy - ey * dx, ex * dx + ey * dy);
          if (ang > mejor) { mejor = ang; i = j; }
        });
      }
      const [nx, ny] = l.splice(i, 1)[0];
      if (!l.length) aristas.delete(k);
      previo = [cx, cy];
      cx = nx; cy = ny;
      if (cx === pts[0][0] && cy === pts[0][1]) break;
      pts.push([cx, cy]);
    }
    if (pts.length > 8) bucles.push(pts);
  }
  return bucles;
}

function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts;
  const dejar = new Uint8Array(pts.length);
  dejar[0] = dejar[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const largo = Math.hypot(dx, dy) || 1;
    let maxd = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / largo;
      if (d > maxd) { maxd = d; mi = i; }
    }
    if (maxd > eps) { dejar[mi] = 1; pila.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => dejar[i]);
}

/** El bucle es cerrado: se parte por el punto más lejano para que el arranque
 *  no quede anclado de casualidad. */
function simplificarCerrado(pts, eps) {
  let lejos = 0, dmax = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > dmax) { dmax = d; lejos = i; }
  }
  const a = douglasPeucker(pts.slice(0, lejos + 1), eps);
  const b = douglasPeucker(pts.slice(lejos).concat([pts[0]]), eps);
  return a.concat(b.slice(1, -1));
}

// ------------------------------------------------------------------- trazar

/** Traza la máscara y devuelve los polígonos normalizados a una caja 0..1000. */
function trazar(m, w, h, eps) {
  const polis = contornos(m, w, h).map((c) => simplificarCerrado(c, eps));
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of polis) {
    for (const [x, y] of p) {
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
    }
  }
  const lado = Math.max(maxx - minx, maxy - miny);
  const ox = (lado - (maxx - minx)) / 2;
  const oy = (lado - (maxy - miny)) / 2;
  const k = 1000 / lado;
  return polis.map((p) => p.map(([x, y]) => [(x - minx + ox) * k, (y - miny + oy) * k]));
}

const num = (v) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
};

const aPath = (polis) =>
  polis.map((p) => "M" + p.map(([x, y], i) => (i ? "L" : "") + num(x) + " " + num(y)).join("") + "Z").join("");

// --------------------------------------------------------------- rasterizar

/** Rellena los polígonos con regla par-impar, con supersampling para antialias. */
function rasterizar(polis, tam, escala, desplaz, ss = 4) {
  const W = tam * ss;
  const cob = new Uint8Array(W * W);
  const k = (W / 1000) * escala;
  const off = desplaz * (W / 1000);
  for (let y = 0; y < W; y++) {
    const yc = (y + 0.5 - off) / k;
    const cortes = [];
    for (const p of polis) {
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
          cortes.push(x1 + (x2 - x1) * ((yc - y1) / (y2 - y1)));
        }
      }
    }
    cortes.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cortes.length; i += 2) {
      const a = Math.max(0, Math.ceil(cortes[i] * k + off - 0.5));
      const b = Math.min(W - 1, Math.floor(cortes[i + 1] * k + off - 0.5));
      if (b >= a) cob.fill(1, y * W + a, y * W + b + 1);
    }
  }
  const alfa = new Float32Array(tam * tam);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let s = 0;
      for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) s += cob[(y * ss + dy) * W + x * ss + dx];
      alfa[y * tam + x] = s / (ss * ss);
    }
  }
  return alfa;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

/**
 * Icono cuadrado.
 *
 * El fondo se decide por archivo, no de una vez:
 *
 * - **Calado** (`fondo: null`) para el favicon. La pestaña ya tiene su propio
 *   fondo, y un cuadrado opaco ahí se lee como un bloque oscuro en vez de como
 *   la marca. El rojo aguanta solo contra pestaña clara y contra oscura.
 * - **Opaco** para iOS y la PWA. No es una elección estética: iOS compone el
 *   apple-touch-icon sobre negro, y un icono de launcher calado queda roto.
 *
 * Y con el fondo cambia el aire: calado conviene grande, porque no hay tile que
 * le dé presencia; sobre tile conviene chico, porque el tile ya ocupa.
 */
function icono(polis, tam, { fondo = NOCHE, ocupacion = AIRE_TILE } = {}) {
  const desplaz = (1000 * (1 - ocupacion)) / 2;
  const alfa = rasterizar(polis, tam, ocupacion, desplaz);
  const [mr, mg, mb] = hex(ROJO);
  const rgba = Buffer.alloc(tam * tam * 4);
  if (fondo) {
    const [fr, fg, fb] = hex(fondo);
    for (let i = 0; i < tam * tam; i++) {
      const a = alfa[i];
      rgba[i * 4] = Math.round(fr + (mr - fr) * a);
      rgba[i * 4 + 1] = Math.round(fg + (mg - fg) * a);
      rgba[i * 4 + 2] = Math.round(fb + (mb - fb) * a);
      rgba[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < tam * tam; i++) {
      rgba[i * 4] = mr;
      rgba[i * 4 + 1] = mg;
      rgba[i * 4 + 2] = mb;
      rgba[i * 4 + 3] = Math.round(alfa[i] * 255);
    }
  }
  return escribirPNG(tam, tam, rgba);
}

/** ICO con PNGs adentro (soportado por todo lo que importa desde Vista). */
function ico(pngs) {
  const dir = Buffer.alloc(6 + pngs.length * 16);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(pngs.length, 4);
  let off = dir.length;
  pngs.forEach(({ tam, buf }, i) => {
    const e = 6 + i * 16;
    dir[e] = tam >= 256 ? 0 : tam;
    dir[e + 1] = tam >= 256 ? 0 : tam;
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(buf.length, e + 8);
    dir.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([dir, ...pngs.map((p) => p.buf)]);
}

// ------------------------------------------------------------------ ejecutar

const original = leerPNG(ORIGEN);
const base = mascaraDe(original);

const fino = trazar(base, original.w, original.h, EPS);
const grueso = trazar(dilatar(base, original.w, original.h, DILATACION), original.w, original.h, EPS);

if (fino.length !== 16 || grueso.length !== 16) {
  throw new Error(
    `Se esperaban 16 contornos en cada peso (8 brazos con su lazo) y salieron ` +
      `${fino.length} / ${grueso.length}. Cambió el original o la dilatación tapa un lazo.`
  );
}

const pathFino = aPath(fino);
const pathGrueso = aPath(grueso);

const salidas = [
  {
    ruta: "components/isotipo-path.ts",
    contenido:
      `// Generado por scripts/_isotipo.mjs a partir de public/logos/isologo.png.\n` +
      `// No editar a mano: se regenera con \`APPLY=1 node scripts/_isotipo.mjs\`.\n` +
      `//\n` +
      `// Dos pesos del mismo símbolo. El fino es el trazo fiel del original; el\n` +
      `// grueso lleva la máscara dilatada ${DILATACION}px para que aguante a 32px, donde el\n` +
      `// trazo real (1,93% del ancho) se deshace.\n\n` +
      `export const ISOTIPO_PATH =\n  "${pathFino}";\n\n` +
      `export const ISOTIPO_PATH_ICONO =\n  "${pathGrueso}";\n`,
  },
  {
    // Calado: lo pinta la pestaña, no nosotros.
    ruta: "app/icon.svg",
    contenido:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">\n` +
      `  <path fill="${ROJO}" fill-rule="evenodd"` +
      ` transform="translate(${num((1000 * (1 - AIRE_CALADO)) / 2)} ${num((1000 * (1 - AIRE_CALADO)) / 2)})` +
      ` scale(${AIRE_CALADO})" d="${pathGrueso}"/>\n` +
      `</svg>\n`,
  },
  {
    ruta: "app/favicon.ico",
    contenido: ico(
      [32, 48].map((tam) => ({
        tam,
        buf: icono(grueso, tam, { fondo: null, ocupacion: AIRE_CALADO }),
      }))
    ),
  },
  // Opacos: los compone iOS / el launcher contra su propio fondo.
  { ruta: "app/apple-icon.png", contenido: icono(grueso, 180) },
  { ruta: "public/icon-192.png", contenido: icono(grueso, 192) },
  { ruta: "public/icon-512.png", contenido: icono(grueso, 512) },
];

console.log(`\nisologo: ${original.w}x${original.h}`);
console.log(`contornos: ${fino.length} fino / ${grueso.length} grueso`);
console.log(`path: ${pathFino.length} chars fino, ${pathGrueso.length} grueso\n`);

let cambios = 0;
for (const { ruta, contenido } of salidas) {
  const abs = path.join(RAIZ, ruta);
  const buf = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, "utf8");
  const previo = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
  const igual = previo && previo.equals(buf);
  if (!igual) cambios++;
  const estado = igual ? "igual  " : previo ? "cambia " : "nuevo  ";
  console.log(`  ${estado} ${ruta.padEnd(30)} ${String(buf.length).padStart(7)} bytes`);
  if (APPLY && !igual) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }
}

console.log(
  APPLY
    ? `\nEscrito. ${cambios} archivo(s) actualizado(s).\n`
    : `\nDry-run: ${cambios} archivo(s) cambiarían. Para escribir: APPLY=1 node scripts/_isotipo.mjs\n`
);
