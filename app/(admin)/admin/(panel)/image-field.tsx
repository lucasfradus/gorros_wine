"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { ImagenValor } from "@/lib/content/types";
import {
  MAX_BYTES_SUBIDA,
  mensajeDemasiadoPesada,
} from "@/lib/content/limites";
import { uploadMediaAction } from "./media-actions";
import styles from "../admin.module.css";
import campo from "./image-field.module.css";

/**
 * Un campo de imagen: subir, ver, describir y quitar.
 *
 * La subida va por su propia action y no espera al submit del formulario: así
 * la vista previa aparece en el momento y el texto alternativo se escribe
 * mirando la foto. Lo que se guarda con el resto del formulario es la
 * referencia que quedó acá.
 *
 * Está en la raíz del panel porque lo usan dos secciones que no se conocen
 * entre sí, el CMS y la agenda de eventos.
 */
export function ImageField({
  valor,
  onChange,
  disabled,
}: {
  valor: ImagenValor | null;
  onChange: (v: ImagenValor | null) => void;
  disabled?: boolean;
}) {
  const [subiendo, empezarSubida] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);

    // Se mide acá antes de mandar nada: pasado el `bodySizeLimit` de Next la
    // action ni siquiera corre, así que su mensaje no llegaría nunca.
    if (archivo.size > MAX_BYTES_SUBIDA) {
      setError(mensajeDemasiadoPesada(archivo.size));
      return;
    }

    empezarSubida(async () => {
      const fd = new FormData();
      fd.set("file", archivo);

      try {
        const res = await uploadMediaAction(fd);
        if (res.error || !res.imagen) {
          setError(res.error ?? "No se pudo subir la imagen.");
          return;
        }

        // Se conserva el texto alternativo si ya había uno escrito: casi
        // siempre reemplazar la foto es cambiar la toma, no cambiar lo que
        // muestra.
        onChange({ ...res.imagen, alt: valor?.alt ?? "" });
      } catch {
        // Si la subida se corta antes de que la action conteste, el botón no
        // se puede quedar en "Subiendo…" para siempre.
        setError("Se cortó la subida. Probá de nuevo.");
      }
    });
  }

  return (
    <div className={campo.imagen}>
      {valor ? (
        <div className={campo.preview}>
          <Image
            src={valor.src}
            alt=""
            width={valor.width ?? 320}
            height={valor.height ?? 200}
            className={campo.previewImg}
            unoptimized
          />
          <span className={campo.previewMeta}>
            {valor.width && valor.height
              ? `${valor.width} × ${valor.height}`
              : "medidas desconocidas"}
          </span>
        </div>
      ) : (
        <p className={campo.previewVacio}>
          Sin foto. El sitio muestra el hueco rayado del diseño.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={campo.file}
        disabled={disabled || subiendo}
        onChange={(e) => {
          elegir(e.target.files?.[0]);
          // Se limpia para que volver a elegir el mismo archivo dispare igual.
          e.target.value = "";
        }}
      />

      <div className={styles.btnRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          disabled={disabled || subiendo}
          onClick={() => input.current?.click()}
        >
          {subiendo ? "Subiendo…" : valor ? "Cambiar foto" : "Subir foto"}
        </button>

        {valor ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall}`}
            disabled={disabled || subiendo}
            onClick={() => onChange(null)}
          >
            Quitar
          </button>
        ) : null}
      </div>

      {error ? (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </p>
      ) : null}

      {valor ? (
        <label className={campo.alt}>
          <span className={styles.label}>Texto alternativo</span>
          <input
            type="text"
            className={styles.input}
            value={valor.alt}
            disabled={disabled}
            placeholder="Qué se ve en la foto"
            onChange={(e) => onChange({ ...valor, alt: e.target.value })}
          />
          <span className={styles.hint}>
            Lo lee en voz alta un lector de pantalla, y es lo que se ve si la
            foto no carga. Describí la escena, no repitas el título.
          </span>
        </label>
      ) : null}
    </div>
  );
}
