/**
 * Los tipos del CMS.
 *
 * El registro (`registry.ts`) declara **qué** campos tiene el sitio, cómo se
 * llaman en castellano y cuál es su texto original. De acá salen los tipos que
 * hacen que `getContent("home")` devuelva un objeto tipado y no un `any`: si
 * mañana alguien renombra un campo del registro, el componente que lo usaba
 * deja de compilar en vez de renderizar `undefined`.
 */

/** Una imagen tal como queda guardada dentro del contenido. */
export interface ImagenValor {
  /**
   * Ruta servible, en dos formas a propósito: `/media/img/<hash>.webp` cuando
   * alguien la subió desde el panel, o un archivo de `public/` cuando es la
   * que vino con el diseño. Así el componente pinta las dos igual y no tiene
   * que saber de dónde salió.
   */
  src: string;
  /** Texto alternativo. Lo escribe quien sube la imagen: es accesibilidad. */
  alt: string;
  /** Nulos cuando el formato no se pudo medir o el diseño usa `fill`. */
  width: number | null;
  height: number | null;
}

interface CampoBase {
  label: string;
  /** Dónde se ve el campo, o qué formato espera. Se muestra bajo la etiqueta. */
  help?: string;
}

export interface CampoTexto extends CampoBase {
  tipo: "texto";
  original: string;
}

export interface CampoParrafo extends CampoBase {
  tipo: "parrafo";
  original: string;
}

export interface CampoRico extends CampoBase {
  tipo: "rico";
  original: string;
}

export interface CampoImagen extends CampoBase {
  tipo: "imagen";
  original: ImagenValor | null;
}

/** Lo que puede ir adentro de un ítem de lista: escalares, no otra lista. */
export type CampoDeItem = CampoTexto | CampoParrafo | CampoImagen;

export interface CampoLista extends CampoBase {
  tipo: "lista";
  item: Record<string, CampoDeItem>;
  /**
   * Manda el diseño: la fila de beneficios está pensada para tres y con siete
   * se rompe. `min`/`max` no son burocracia, son el rango en el que la grilla
   * sigue viéndose bien.
   */
  min: number;
  max: number;
  /**
   * Qué campo del ítem se usa para titularlo en el panel. Si se omite —una
   * lista de puras fotos no tiene texto con qué titularse— el panel numera.
   */
  titulo?: string;
  original: ItemValor[];
}

export type Campo =
  | CampoTexto
  | CampoParrafo
  | CampoRico
  | CampoImagen
  | CampoLista;

export type ItemValor = Record<string, string | ImagenValor | null>;

/** El valor que le corresponde a un campo según su tipo. */
export type ValorDeCampo<C extends Campo> = C extends {
  tipo: "lista";
  item: infer I extends Record<string, CampoDeItem>;
}
  ? Array<{ [K in keyof I]: ValorDeCampo<I[K]> }>
  : C extends { tipo: "imagen" }
    ? ImagenValor | null
    : string;

export interface Grupo {
  label: string;
  /** Una línea para el índice del panel: qué parte del sitio es esto. */
  help: string;
  /** Rutas públicas a invalidar cuando el grupo cambia. */
  revalidate: string[];
  /**
   * `true` cuando el grupo se usa en el marco del sitio —nav, footer, age
   * gate— y entonces no alcanza con invalidar una ruta: hay que invalidar el
   * layout entero.
   */
  afectaTodo?: boolean;
  campos: Record<string, Campo>;
}

/** El objeto que devuelve `getContent()` para un grupo. */
export type ValoresDeGrupo<G extends Grupo> = {
  [K in keyof G["campos"]]: G["campos"][K] extends Campo
    ? ValorDeCampo<G["campos"][K]>
    : never;
};
