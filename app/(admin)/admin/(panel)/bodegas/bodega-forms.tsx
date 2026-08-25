"use client";

import { useActionState } from "react";
import { Aviso, Submit, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

export interface BodegaDefaults {
  id?: string;
  nombre?: string;
  slug?: string;
  pais?: string | null;
  sitioWeb?: string | null;
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  contactoTelefono?: string | null;
  notas?: string | null;
}

/** Alta y edición: la misma pantalla, distinto action. */
export function BodegaForm({
  action,
  defaults,
  submitLabel,
}: {
  action: FormAction;
  defaults?: BodegaDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={defaults?.nombre}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="slug">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={defaults?.slug}
          className={styles.input}
        />
        <span className={styles.hint}>
          Cómo va a aparecer en la URL. Si lo dejás vacío sale del nombre:
          &ldquo;Bodega Andina&rdquo; ⇒ <code>bodega-andina</code>.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="pais">
          País
        </label>
        <input
          id="pais"
          name="pais"
          type="text"
          defaultValue={defaults?.pais ?? ""}
          className={styles.input}
        />
        <span className={styles.hint}>
          Para distinguir las importadas. Vacío se lee como Argentina.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="sitioWeb">
          Sitio web
        </label>
        <input
          id="sitioWeb"
          name="sitioWeb"
          type="url"
          placeholder="https://"
          defaultValue={defaults?.sitioWeb ?? ""}
          className={styles.input}
        />
      </div>

      <div className={styles.formSection}>Contacto comercial</div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactoNombre">
          Nombre
        </label>
        <input
          id="contactoNombre"
          name="contactoNombre"
          type="text"
          defaultValue={defaults?.contactoNombre ?? ""}
          className={styles.input}
        />
        <span className={styles.hint}>
          Con quién se habla para pedir. No se muestra en la tienda.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactoEmail">
          Mail
        </label>
        <input
          id="contactoEmail"
          name="contactoEmail"
          type="email"
          autoComplete="off"
          defaultValue={defaults?.contactoEmail ?? ""}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactoTelefono">
          Teléfono
        </label>
        <input
          id="contactoTelefono"
          name="contactoTelefono"
          type="tel"
          defaultValue={defaults?.contactoTelefono ?? ""}
          className={styles.input}
        />
        <span className={styles.hint}>
          Con característica, así el enlace de WhatsApp funciona.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="notas">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={4}
          defaultValue={defaults?.notas ?? ""}
          className={styles.textarea}
        />
        <span className={styles.hint}>
          Plazos de entrega, mínimos de compra, condiciones de pago — lo que
          hoy vive en un WhatsApp.
        </span>
      </div>

      <div className={styles.btnRow}>
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}

/**
 * Archiva o reactiva. No hay borrado: los productos cuelgan de la bodega y la
 * clave foránea es `restrict`.
 */
export function ArchivarBodegaForm({
  action,
  bodegaId,
  isActive,
  productosActivos,
}: {
  action: FormAction;
  bodegaId: string;
  isActive: boolean;
  productosActivos: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={bodegaId} />

      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive
          ? productosActivos === 0
            ? "Archivarla la saca de la lista para cargar productos nuevos. No se borra nada."
            : `Archivarla la saca de la lista para cargar productos nuevos, pero sus ${productosActivos} ${
                productosActivos === 1
                  ? "producto activo sigue"
                  : "productos activos siguen"
              } en el catálogo. Se archiva al proveedor, no la góndola.`
          : "Reactivarla la devuelve a la lista de bodegas para elegir."}
      </p>

      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Archivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}
