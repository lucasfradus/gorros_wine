import { Fragment, type ReactNode } from "react";

/**
 * El formato mínimo del contenido editable.
 *
 * Deliberadamente chico: `*acento*`, `**destacado**`, salto de línea y línea
 * en blanco. Nada más. No hay Markdown ni HTML de por medio, y el resultado
 * son **nodos de React** — nunca `dangerouslySetInnerHTML`. Así no entra una
 * dependencia nueva ni se abre una superficie de XSS por un campo de texto.
 *
 * Los estilos no se deciden acá: cada sección pasa sus propias clases, porque
 * el mismo `*acento*` es bastardilla dorada en un título y texto dorado
 * derecho en un párrafo.
 */
export interface Clases {
  /** `*así*` */
  acento?: string;
  /** `**así**` */
  destacado?: string;
}

const MARCAS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/g;
const ENLACE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

/**
 * Sólo enlaces a algún lado razonable. `javascript:` y `data:` quedan afuera:
 * quien edita el contenido está autenticado, pero eso no lo vuelve una fuente
 * en la que apoyar la seguridad del sitio público.
 */
function urlSegura(url: string): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:[^\s]+@[^\s]+$/i.test(url)) return url;
  if (/^tel:\+?[\d\s-]+$/i.test(url)) return url;
  return null;
}

/** Aplica las marcas dentro de una línea. */
export function inline(texto: string, clases: Clases = {}): ReactNode[] {
  return texto.split(MARCAS).map((trozo, i) => {
    if (trozo.startsWith("**") && trozo.endsWith("**")) {
      return (
        <b key={i} className={clases.destacado}>
          {trozo.slice(2, -2)}
        </b>
      );
    }

    if (trozo.startsWith("*") && trozo.endsWith("*") && trozo.length > 2) {
      return (
        <em key={i} className={clases.acento}>
          {trozo.slice(1, -1)}
        </em>
      );
    }

    const enlace = ENLACE.exec(trozo);
    if (enlace) {
      const [, etiqueta, destino] = enlace;
      const url = urlSegura(destino);

      // Si el destino no pasa, queda el texto sin enlazar: mejor un enlace de
      // menos que uno que lleve a cualquier parte.
      if (!url) return <Fragment key={i}>{etiqueta}</Fragment>;

      const afuera = /^https?:\/\//i.test(url);
      return (
        <a
          key={i}
          href={url}
          target={afuera ? "_blank" : undefined}
          rel={afuera ? "noopener noreferrer" : undefined}
        >
          {etiqueta}
        </a>
      );
    }

    return <Fragment key={i}>{trozo}</Fragment>;
  });
}

/**
 * Reemplaza `{direccion}`, `{email}` y compañía por los datos del local.
 *
 * Existe para las legales, donde la dirección y el mail aparecen en medio de
 * un párrafo. Sin esto habría que escribirlos a mano ahí, y el día que cambien
 * en "Datos del local" los términos y condiciones seguirían diciendo lo viejo.
 */
export function conDatos(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (crudo, clave: string) =>
    Object.hasOwn(valores, clave) ? valores[clave] : crudo,
  );
}

/**
 * Un texto de varios renglones: cada salto de línea es un `<br>`.
 * Es lo que usan los títulos, donde el corte de línea es parte del diseño.
 */
export function Lineas({
  texto,
  clases,
}: {
  texto: string;
  clases?: Clases;
}) {
  const lineas = texto.split("\n");

  return (
    <>
      {lineas.map((linea, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {inline(linea, clases)}
        </Fragment>
      ))}
    </>
  );
}

/**
 * El texto largo de las legales: `## ` es un subtítulo, `- ` una viñeta, y una
 * línea en blanco separa párrafos.
 *
 * Es todo el formato que hay, y alcanza para lo que estas páginas necesitan.
 * No entra un parser de Markdown ni de HTML: los estilos los pone
 * `legal-page.module.css` sobre las etiquetas, como hasta ahora.
 */
export function Rico({ texto, clases }: { texto: string; clases?: Clases }) {
  const bloques = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {bloques.map((bloque, i) => {
        const lineas = bloque.split("\n");

        if (lineas[0].startsWith("## ")) {
          return <h2 key={i}>{inline(lineas[0].slice(3).trim(), clases)}</h2>;
        }

        if (lineas.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i}>
              {lineas.map((l, j) => (
                <li key={j}>{inline(l.slice(2).trim(), clases)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i}>
            <Lineas texto={bloque} clases={clases} />
          </p>
        );
      })}
    </>
  );
}

/** Un texto largo: una línea en blanco separa párrafos. */
export function Parrafos({
  texto,
  className,
  clases,
}: {
  texto: string;
  /** La clase de cada `<p>`. */
  className?: string;
  clases?: Clases;
}) {
  const bloques = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {bloques.map((bloque, i) => (
        <p key={i} className={className}>
          <Lineas texto={bloque} clases={clases} />
        </p>
      ))}
    </>
  );
}
