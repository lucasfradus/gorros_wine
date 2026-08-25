import Link from "next/link";
import { requireContentEditor } from "@/lib/auth";
import { getEditados } from "@/lib/content/get";
import { GRUPOS, REGISTRO } from "@/lib/content/registry";
import styles from "../../admin.module.css";
import cms from "./contenido.module.css";

export const metadata = { title: "Contenido" };

export default async function ContenidoPage() {
  await requireContentEditor();
  const editados = await getEditados();

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Contenido</h1>
          <p className={styles.pageSub}>
            Los textos y las fotos del sitio. Lo que no se toca acá queda como
            vino con el diseño.
          </p>
        </div>
      </div>

      <div className={cms.grid}>
        {GRUPOS.map((clave) => {
          const grupo = REGISTRO[clave];
          const n = editados[clave].length;

          return (
            <Link
              key={clave}
              href={`/admin/contenido/${clave}`}
              className={cms.tarjeta}
            >
              <span className={cms.tarjetaNombre}>{grupo.label}</span>
              <p className={cms.tarjetaAyuda}>{grupo.help}</p>
              <span
                className={`${cms.tarjetaEstado} ${n > 0 ? cms.tarjetaEstadoEditado : ""}`}
              >
                {n === 0
                  ? "Sin cambios"
                  : n === 1
                    ? "1 campo editado"
                    : `${n} campos editados`}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
