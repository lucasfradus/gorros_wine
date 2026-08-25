import { getContent } from "@/lib/content/get";
import { conDatos, inline, Rico } from "./rich-text";
import styles from "./legal-page.module.css";

/**
 * El marco de una página legal, con su texto ya editable desde el panel.
 *
 * El aviso de borrador también es un campo: cuando el texto pase por un asesor
 * se vacía desde el panel y el recuadro desaparece, sin tocar código.
 */
export async function LegalPage({
  grupo,
}: {
  grupo: "legalesPrivacidad" | "legalesTerminos";
}) {
  const [c, local] = await Promise.all([
    getContent(grupo),
    getContent("local"),
  ]);

  const datos = {
    direccion: local.direccion,
    horarios: local.horarios,
    email: local.email,
    instagram: local.instagram,
    whatsapp: local.whatsapp,
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Legales</p>
        <h1 className={styles.title}>{c.titulo}</h1>
        <p className={styles.updated}>
          Última actualización: {c.actualizado}
        </p>
      </header>

      {c.aviso.trim() ? (
        <p className={styles.draft}>
          {inline(c.aviso, { destacado: styles.draftLabel })}
        </p>
      ) : null}

      <div className={styles.prose}>
        <Rico texto={conDatos(c.cuerpo, datos)} />
      </div>
    </div>
  );
}
