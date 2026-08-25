"use client";

import type {
  CampoDeItem,
  CampoLista,
  ImagenValor,
  ItemValor,
} from "@/lib/content/types";
import { ImageField } from "../image-field";
import styles from "../../admin.module.css";
import cms from "./contenido.module.css";

/**
 * Editor de listas: agregar, quitar y reordenar.
 *
 * El `min`/`max` que declara el registro no es una formalidad — la fila de
 * beneficios está maquetada para tres y con siete se rompe—, así que los
 * botones se apagan al llegar al límite y el motivo se dice en pantalla.
 */
export function ListEditor({
  campo,
  valor,
  onChange,
}: {
  campo: CampoLista;
  valor: ItemValor[];
  onChange: (v: ItemValor[]) => void;
}) {
  const subcampos = Object.entries(campo.item);

  function cambiarItem(i: number, nombre: string, v: unknown) {
    onChange(
      valor.map((item, j) =>
        j === i ? { ...item, [nombre]: v as ItemValor[string] } : item,
      ),
    );
  }

  function mover(i: number, delta: number) {
    const destino = i + delta;
    if (destino < 0 || destino >= valor.length) return;

    const copia = [...valor];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    onChange(copia);
  }

  return (
    <div className={cms.lista}>
      {valor.map((item, i) => (
        <div key={i} className={cms.item}>
          <div className={cms.itemHead}>
            <span className={cms.itemNum}>
              {String(i + 1).padStart(2, "0")}
              {campo.titulo && typeof item[campo.titulo] === "string" && item[campo.titulo]
                ? ` · ${item[campo.titulo]}`
                : ""}
            </span>

            <span className={cms.itemBotones}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={i === 0}
                onClick={() => mover(i, -1)}
                aria-label={`Subir el ítem ${i + 1}`}
              >
                ↑
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={i === valor.length - 1}
                onClick={() => mover(i, 1)}
                aria-label={`Bajar el ítem ${i + 1}`}
              >
                ↓
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                disabled={valor.length <= campo.min}
                onClick={() => onChange(valor.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            </span>
          </div>

          {subcampos.map(([nombre, sub]) => (
            <SubCampo
              key={nombre}
              campo={sub}
              valor={item[nombre]}
              onChange={(v) => cambiarItem(i, nombre, v)}
            />
          ))}
        </div>
      ))}

      <div className={styles.btnRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          disabled={valor.length >= campo.max}
          onClick={() => onChange([...valor, itemVacio(campo)])}
        >
          Agregar
        </button>

        <span className={styles.hint}>
          {valor.length} de {campo.min}–{campo.max}.
          {valor.length >= campo.max
            ? " Es el máximo que soporta el diseño de esta sección."
            : ""}
        </span>
      </div>
    </div>
  );
}

function SubCampo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoDeItem;
  valor: string | ImagenValor | null | undefined;
  onChange: (v: unknown) => void;
}) {
  if (campo.tipo === "imagen") {
    return (
      <div className={styles.field}>
        <span className={styles.label}>{campo.label}</span>
        <ImageField
          valor={(valor as ImagenValor | null) ?? null}
          onChange={onChange}
        />
      </div>
    );
  }

  const texto = typeof valor === "string" ? valor : "";

  return (
    <label className={styles.field}>
      <span className={styles.label}>{campo.label}</span>

      {campo.tipo === "parrafo" ? (
        <textarea
          className={`${styles.input} ${cms.textarea}`}
          rows={3}
          value={texto}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={styles.input}
          value={texto}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {campo.help ? <span className={styles.hint}>{campo.help}</span> : null}
    </label>
  );
}

/** Un ítem nuevo arranca con los originales de sus subcampos: vacíos o sin foto. */
function itemVacio(campo: CampoLista): ItemValor {
  return Object.fromEntries(
    Object.entries(campo.item).map(([nombre, sub]) => [nombre, sub.original]),
  ) as ItemValor;
}
