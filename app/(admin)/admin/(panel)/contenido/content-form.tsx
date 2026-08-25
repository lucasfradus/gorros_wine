"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { iguales } from "@/lib/content/iguales";
import type { Campo, ImagenValor, ItemValor } from "@/lib/content/types";
import { saveGroupAction, type ContentFormState } from "./actions";
import { ImageField } from "../image-field";
import { ListEditor } from "./list-editor";
import styles from "../../admin.module.css";
import cms from "./contenido.module.css";

/**
 * El formulario de una sección, armado recorriendo el registro.
 *
 * No hay un componente por pantalla: sumar un campo al sitio es agregarlo a
 * `lib/content/registry.ts` y acá aparece solo, con su etiqueta y su ayuda.
 *
 * "Restaurar el original" no necesita ir al servidor: el original viaja en el
 * registro, así que alcanza con volver el campo a ese valor. Al guardar, la
 * action ve que quedó igual y borra la fila.
 */
export function ContentForm({
  grupo,
  campos,
  valores,
}: {
  grupo: string;
  campos: Record<string, Campo>;
  valores: Record<string, unknown>;
}) {
  const [state, formAction] = useActionState<ContentFormState, FormData>(
    saveGroupAction,
    {},
  );
  const [datos, setDatos] = useState<Record<string, unknown>>(valores);

  function set(nombre: string, valor: unknown) {
    setDatos((d) => ({ ...d, [nombre]: valor }));
  }

  const editados = Object.entries(campos).filter(
    ([nombre, campo]) => !iguales(datos[nombre], campo.original),
  ).length;

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className={`${styles.alert} ${styles.alertOk}`} role="status">
          {state.ok}
        </p>
      ) : null}

      <input type="hidden" name="grupo" value={grupo} />

      {Object.entries(campos).map(([nombre, campo]) => (
        <CampoUI
          key={nombre}
          nombre={nombre}
          campo={campo}
          valor={datos[nombre]}
          onChange={(v) => set(nombre, v)}
        />
      ))}

      <div className={cms.barra}>
        <Guardar />
        <span className={styles.hint}>
          {editados === 0
            ? "Todo como vino de fábrica."
            : editados === 1
              ? "1 campo distinto del original."
              : `${editados} campos distintos del original.`}
        </span>
      </div>
    </form>
  );
}

function Guardar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnPrimary}`}
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

function CampoUI({
  nombre,
  campo,
  valor,
  onChange,
}: {
  nombre: string;
  campo: Campo;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  const editado = !iguales(valor, campo.original);

  return (
    <div className={cms.campo}>
      <div className={cms.campoHead}>
        <span className={styles.label}>{campo.label}</span>

        {editado ? (
          <span className={cms.campoAcciones}>
            <span className={cms.editado}>Editado</span>
            <button
              type="button"
              className={cms.restaurar}
              onClick={() => onChange(campo.original)}
            >
              Restaurar el original
            </button>
          </span>
        ) : null}
      </div>

      {campo.help ? <p className={styles.hint}>{campo.help}</p> : null}

      <Editor nombre={nombre} campo={campo} valor={valor} onChange={onChange} />
    </div>
  );
}

function Editor({
  nombre,
  campo,
  valor,
  onChange,
}: {
  nombre: string;
  campo: Campo;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  // Las imágenes y las listas son estructuras: viajan como JSON en un input
  // oculto, porque un formulario sólo sabe mandar texto.
  if (campo.tipo === "imagen") {
    const imagen = (valor as ImagenValor | null) ?? null;
    return (
      <>
        <input type="hidden" name={nombre} value={JSON.stringify(imagen)} />
        <ImageField valor={imagen} onChange={onChange} />
      </>
    );
  }

  if (campo.tipo === "lista") {
    const lista = Array.isArray(valor) ? (valor as ItemValor[]) : [];
    return (
      <>
        <input type="hidden" name={nombre} value={JSON.stringify(lista)} />
        <ListEditor campo={campo} valor={lista} onChange={onChange} />
      </>
    );
  }

  const texto = typeof valor === "string" ? valor : "";

  if (campo.tipo === "texto") {
    return (
      <input
        type="text"
        name={nombre}
        className={styles.input}
        value={texto}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <textarea
      name={nombre}
      className={`${styles.input} ${cms.textarea}`}
      rows={campo.tipo === "rico" ? 14 : contarRenglones(texto)}
      value={texto}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Que el campo entre sin scroll: crece con el texto, dentro de un rango. */
function contarRenglones(texto: string): number {
  return Math.min(12, Math.max(3, texto.split("\n").length + 1));
}
