import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContentEditor } from "@/lib/auth";
import { getContent } from "@/lib/content/get";
import { REGISTRO, esGrupo } from "@/lib/content/registry";
import { bucketReady } from "@/lib/content/bucket";
import type { Grupo } from "@/lib/content/types";
import { ContentForm } from "../content-form";
import styles from "../../../admin.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ grupo: string }>;
}) {
  const { grupo } = await params;
  return { title: esGrupo(grupo) ? REGISTRO[grupo].label : "Contenido" };
}

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ grupo: string }>;
}) {
  // La página autoriza aunque el layout ya lo haya hecho: en el App Router un
  // layout puede no re-ejecutarse en una navegación del lado del cliente.
  await requireContentEditor();

  const { grupo } = await params;
  if (!esGrupo(grupo)) notFound();

  // Anotado como `Grupo`: sin estrechar la clave, `REGISTRO[grupo]` es la
  // unión de todos los grupos y recorrer sus campos se vuelve `unknown`.
  const definicion: Grupo = REGISTRO[grupo];
  const valores = await getContent(grupo);

  const tieneImagenes = Object.values(definicion.campos).some(
    (c) =>
      c.tipo === "imagen" ||
      (c.tipo === "lista" &&
        Object.values(c.item).some((s) => s.tipo === "imagen")),
  );

  return (
    <>
      <Link href="/admin/contenido" className={styles.backLink}>
        ← Contenido
      </Link>

      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{definicion.label}</h1>
          <p className={styles.pageSub}>{definicion.help}</p>
        </div>
      </div>

      {tieneImagenes && !bucketReady() ? (
        <p className={`${styles.alert} ${styles.alertError}`}>
          El almacenamiento de imágenes no está configurado en este entorno: se
          pueden editar los textos, pero no subir fotos.
        </p>
      ) : null}

      <section className={styles.card}>
        <ContentForm
          grupo={grupo}
          campos={definicion.campos}
          valores={valores}
        />
      </section>
    </>
  );
}
