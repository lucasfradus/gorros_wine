"use client";

import { useActionState, useState } from "react";
import { Aviso, Submit, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

export interface CategoriaOpcion {
  id: string;
  nombre: string;
  esVino: boolean;
}

export interface CategoriaDefaults {
  id?: string;
  nombre?: string;
  slug?: string;
  parentId?: string | null;
  orden?: number;
  esVino?: boolean;
}

/**
 * Alta y edición.
 *
 * `esVino` sólo se puede tocar en una categoría raíz: una subcategoría lo
 * hereda del padre. Por eso el checkbox se reemplaza por un texto cuando hay
 * padre elegido — mostrarlo deshabilitado invitaría a pelearse con él.
 */
export function CategoriaForm({
  action,
  padresPosibles,
  defaults,
  submitLabel,
}: {
  action: FormAction;
  padresPosibles: CategoriaOpcion[];
  defaults?: CategoriaDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [parentId, setParentId] = useState(defaults?.parentId ?? "");

  const padre = padresPosibles.find((p) => p.id === parentId);

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
        <label className={styles.label} htmlFor="parentId">
          Categoría padre
        </label>
        <select
          id="parentId"
          name="parentId"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className={styles.select}
        >
          <option value="">Ninguna — es una categoría principal</option>
          {padresPosibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          Se admiten dos niveles: &ldquo;Accesorios &rsaquo; Copas&rdquo;, no un
          tercero.
        </span>
      </div>

      <div className={styles.fieldRow}>
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
          <span className={styles.hint}>Vacío sale del nombre.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="orden">
            Orden
          </label>
          <input
            id="orden"
            name="orden"
            type="number"
            step="1"
            required
            defaultValue={defaults?.orden ?? 0}
            className={styles.input}
          />
          <span className={styles.hint}>
            De menor a mayor. El alfabético casi nunca es el que conviene.
          </span>
        </div>
      </div>

      <div className={styles.field}>
        {padre ? (
          <span className={styles.hint}>
            <strong>Ficha:</strong> la hereda de {padre.nombre}, así que sus
            productos {padre.esVino ? "llevan" : "no llevan"} ficha de vino.
          </span>
        ) : (
          <label className={styles.radioRow}>
            <input
              type="checkbox"
              name="esVino"
              defaultChecked={defaults?.esVino ?? false}
            />
            <span>
              <span className={styles.radioName}>Sus productos son vinos</span>
              <span className={styles.radioDesc}>
                Les pide bodega, tipo, varietales, añada, guarda y maridajes. Sin
                tildar, el producto queda con la ficha corta: nombre, precio y
                stock. Las subcategorías lo heredan.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className={styles.btnRow}>
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}

export function ArchivarCategoriaForm({
  action,
  categoriaId,
  isActive,
  productosActivos,
  subcategorias,
}: {
  action: FormAction;
  categoriaId: string;
  isActive: boolean;
  productosActivos: number;
  subcategorias: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={categoriaId} />

      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive ? (
          <>
            Archivarla la saca de la lista al cargar productos nuevos. No se
            borra nada
            {productosActivos > 0
              ? `, y sus ${productosActivos} ${
                  productosActivos === 1
                    ? "producto activo sigue"
                    : "productos activos siguen"
                } en el catálogo`
              : ""}
            {subcategorias > 0
              ? `. Sus ${subcategorias} ${
                  subcategorias === 1 ? "subcategoría queda" : "subcategorías quedan"
                } como estén: se archivan una por una`
              : ""}
            .
          </>
        ) : (
          "Reactivarla la devuelve a la lista de categorías para elegir."
        )}
      </p>

      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Archivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}
