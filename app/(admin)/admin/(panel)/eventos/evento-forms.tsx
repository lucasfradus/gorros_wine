"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ImagenValor } from "@/lib/content/types";
import { ImageField } from "../image-field";
import { Aviso, Submit, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

export interface EventoDefaults {
  id?: string;
  titulo?: string;
  /** Ya convertida a hora de acá con `aInputLocal`: el input la toma tal cual. */
  comienza?: string;
  lugar?: string;
  detalle?: string;
  /** En pesos enteros, que es como se escribe y como se lee. */
  precio?: string;
  imagen?: ImagenValor | null;
  publicado?: boolean;
}

/** Alta y edición. La misma pantalla, distinto action. */
export function EventoForm({
  action,
  defaults,
  submitLabel,
}: {
  action: FormAction;
  defaults?: EventoDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  // La foto se elige y se sube antes del submit, así que su valor vive acá y
  // viaja al servidor como JSON en un input oculto: un `<input>` sólo sabe de
  // strings y esto es una estructura.
  const [imagen, setImagen] = useState<ImagenValor | null>(
    defaults?.imagen ?? null,
  );

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="titulo">
          Título
        </label>
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults?.titulo ?? ""}
          placeholder="Cata de Malbecs de altura"
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="comienza">
          Cuándo empieza
        </label>
        <input
          id="comienza"
          name="comienza"
          type="datetime-local"
          required
          defaultValue={defaults?.comienza ?? ""}
          className={styles.input}
        />
        <span className={styles.hint}>
          La hora de acá, la del local. De esta fecha salen el día y el mes que
          se ven en la tarjeta del sitio.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="lugar">
          Dónde
        </label>
        <input
          id="lugar"
          name="lugar"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults?.lugar ?? "Local Pilar"}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="detalle">
          Detalle
        </label>
        <input
          id="detalle"
          name="detalle"
          type="text"
          maxLength={300}
          defaultValue={defaults?.detalle ?? ""}
          placeholder="8 etiquetas a ciegas"
          className={styles.input}
        />
        <span className={styles.hint}>
          Opcional. La línea corta que va junto al horario y el lugar.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="precio">
          Precio
        </label>
        <input
          id="precio"
          name="precio"
          type="number"
          required
          min={0}
          step={1}
          defaultValue={defaults?.precio ?? ""}
          placeholder="9000"
          className={styles.input}
        />
        <span className={styles.hint}>
          En pesos enteros, sin puntos ni centavos. Cero si el evento es gratis.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Foto</span>
        <ImageField valor={imagen} onChange={setImagen} />
        <input
          type="hidden"
          name="imagen"
          value={imagen ? JSON.stringify(imagen) : ""}
        />
      </div>

      <div className={styles.field}>
        {/* `radioRow` es el estilo de la fila, no del tipo de control: la misma
            caja con borde que usa el selector de rol. */}
        <label className={styles.radioRow}>
          <input
            type="checkbox"
            name="publicado"
            defaultChecked={defaults?.publicado ?? false}
          />
          <span>
            <span className={styles.radioName}>Publicado</span>
            <span className={styles.radioDesc}>
              Mientras esté sin tildar es un borrador: no se ve en el sitio.
            </span>
          </span>
        </label>
      </div>

      <div className={styles.btnRow}>
        <Submit>{submitLabel}</Submit>
      </div>
    </form>
  );
}

/**
 * Borrar un evento.
 *
 * Se borra de verdad y no se archiva: no hay reservas ni pedidos colgando de
 * un evento, así que no hay historial que quede huérfano. Cuando las haya,
 * esto tiene que volver a pensarse.
 */
export function BorrarEvento({
  action,
  eventoId,
  titulo,
}: {
  action: FormAction;
  eventoId: string;
  titulo: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className={styles.form}
      onSubmit={(e) => {
        if (!confirm(`¿Borrar "${titulo}"? No se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <Aviso state={state} />
      <input type="hidden" name="id" value={eventoId} />
      <p className={styles.hint} style={{ margin: 0 }}>
        Se va del sitio y del panel. Si sólo querés sacarlo de la vista,
        destildá <strong>Publicado</strong> y guardá.
      </p>
      <div className={styles.btnRow}>
        <BotonBorrar />
      </div>
    </form>
  );
}

function BotonBorrar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.btn} ${styles.btnDanger}`}
    >
      {pending ? "Borrando…" : "Borrar evento"}
    </button>
  );
}
