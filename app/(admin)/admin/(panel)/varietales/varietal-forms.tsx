"use client";

import { useActionState } from "react";
import { Aviso, Submit, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

/**
 * Alta rápida, arriba del listado.
 *
 * Sin pantalla propia: agregar un varietal es escribir una palabra, y mandar a
 * alguien a otra página para eso es fricción sin contrapartida.
 */
export function NuevoVarietalForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            placeholder="Cabernet Franc"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>&nbsp;</span>
          <Submit variant="plain">Agregar</Submit>
        </div>
      </div>
    </form>
  );
}

export function VarietalForm({
  action,
  defaults,
}: {
  action: FormAction;
  defaults: { id: string; nombre: string; slug: string };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={defaults.id} />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={defaults.nombre}
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
            defaultValue={defaults.slug}
            className={styles.input}
          />
        </div>
      </div>

      <span className={styles.hint}>
        Corregir el nombre acá lo corrige en todos los vinos que lo usan: la
        relación va por id, no por texto.
      </span>

      <div className={styles.btnRow}>
        <Submit>Guardar cambios</Submit>
      </div>
    </form>
  );
}

export function ArchivarVarietalForm({
  action,
  varietalId,
  isActive,
  enUso,
}: {
  action: FormAction;
  varietalId: string;
  isActive: boolean;
  enUso: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={varietalId} />

      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive
          ? enUso === 0
            ? "Archivarlo lo saca de la lista al cargar un vino. No se borra."
            : `Archivarlo lo saca de la lista al cargar un vino. Los ${enUso} que ya lo tienen lo conservan.`
          : "Reactivarlo lo devuelve a la lista para elegir."}
      </p>

      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Archivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}
