"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { ImagenValor } from "@/lib/content/types";
import { uploadMediaAction } from "./actions";
import styles from "../../admin.module.css";
import cms from "./contenido.module.css";

/**
 * Un campo de imagen: subir, ver, describir y quitar.
 *
 * La subida va por su propia action y no espera al submit del formulario: así
 * la vista previa aparece en el momento y el texto alternativo se escribe
 * mirando la foto. Lo que se guarda con el resto del grupo es la referencia
 * que quedó acá.
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

    empezarSubida(async () => {
      const fd = new FormData();
      fd.set("file", archivo);

      const res = await uploadMediaAction(fd);
      if (res.error || !res.imagen) {
        setError(res.error ?? "No se pudo subir la imagen.");
        return;
      }

      // Se conserva el texto alternativo si ya había uno escrito: casi siempre
      // reemplazar la foto es cambiar la toma, no cambiar lo que muestra.
      onChange({ ...res.imagen, alt: valor?.alt ?? "" });
    });
  }

  return (
    <div className={cms.imagen}>
      {valor ? (
        <div className={cms.preview}>
          <Image
            src={valor.src}
            alt=""
            width={valor.width ?? 320}
            height={valor.height ?? 200}
            className={cms.previewImg}
            unoptimized
          />
          <span className={cms.previewMeta}>
            {valor.width && valor.height
              ? `${valor.width} × ${valor.height}`
              : "medidas desconocidas"}
          </span>
        </div>
      ) : (
        <p className={cms.previewVacio}>
          Sin foto. El sitio muestra el hueco rayado del diseño.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={cms.file}
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
        <label className={cms.alt}>
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
