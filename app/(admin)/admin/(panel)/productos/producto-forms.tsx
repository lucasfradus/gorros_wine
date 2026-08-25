"use client";

import { useActionState, useState } from "react";
import type { Moneda, TipoVino } from "@/lib/db/schema";
import { MARIDAJES, MONEDAS, MONEDA_LABEL, TIPOS } from "@/lib/catalogo";
import { aCentavos, aPesos, formatearPrecio } from "@/lib/precio";
import { Aviso, Submit, type FormAction, type FormState } from "../form-ui";
import styles from "../../admin.module.css";

export interface BodegaOpcion {
  id: string;
  nombre: string;
}

export interface VarietalOpcion {
  id: string;
  nombre: string;
}

export interface CategoriaOpcion {
  id: string;
  /** Ya viene armado como "Accesorios › Copas" para el desplegable. */
  etiqueta: string;
  esVino: boolean;
}

export interface ProductoDefaults {
  id?: string;
  nombre?: string;
  slug?: string;
  categoriaId?: string;
  bodegaId?: string | null;
  tipo?: TipoVino | null;
  varietalIds?: string[];
  region?: string | null;
  anada?: number | null;
  precioCentavos?: number;
  moneda?: Moneda;
  stock?: number;
  destacado?: boolean;
  descripcion?: string | null;
  guarda?: string | null;
  maridajes?: string[];
  volumenMl?: number | null;
}

/** Pastillas de selección múltiple. */
function Chips({
  name,
  opciones,
  seleccionadas,
}: {
  name: string;
  opciones: { value: string; label: string }[];
  seleccionadas: string[];
}) {
  return (
    <div className={styles.chips}>
      {opciones.map((o) => (
        <label key={o.value} className={styles.chip}>
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={seleccionadas.includes(o.value)}
          />
          <span className={styles.chipText}>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * El precio con su moneda, y —cuando es en dólares— cuánto da en pesos.
 *
 * El equivalente se calcula en el navegador mientras se escribe, pero **no se
 * guarda**: lo que se persiste es el precio en su moneda. Si se guardara la
 * conversión, cada movimiento del dólar obligaría a reescribir el catálogo.
 */
function CampoPrecio({
  precioInicial,
  monedaInicial,
  cotizacion,
}: {
  precioInicial: string;
  monedaInicial: Moneda;
  cotizacion: number | null;
}) {
  const [precio, setPrecio] = useState(precioInicial);
  const [moneda, setMoneda] = useState<Moneda>(monedaInicial);

  const centavos = aCentavos(precio);
  const enPesos =
    centavos === null ? null : aPesos(centavos, moneda, cotizacion);

  return (
    <>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="precio">
            Precio
          </label>
          <input
            id="precio"
            name="precio"
            type="number"
            min="0"
            step="0.01"
            required
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="moneda">
            Moneda
          </label>
          <select
            id="moneda"
            name="moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as Moneda)}
            className={styles.select}
          >
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {MONEDA_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {moneda === "USD" ? (
        <span className={styles.hint}>
          {cotizacion === null ? (
            <>
              No hay ninguna cotización cargada, así que no se puede mostrar el
              equivalente en pesos. Se carga desde el listado de Productos.
            </>
          ) : enPesos === null ? (
            <>
              Con el dólar a {formatearPrecio(cotizacion, "ARS")}, el
              equivalente aparece acá al escribir un precio válido.
            </>
          ) : (
            <>
              Son {formatearPrecio(enPesos, "ARS")} con el dólar a{" "}
              {formatearPrecio(cotizacion, "ARS")}. Se guarda el precio en
              dólares: el equivalente se recalcula solo cuando cambia la
              cotización.
            </>
          )}
        </span>
      ) : null}
    </>
  );
}

/**
 * Alta y edición: la misma pantalla, distinto action.
 *
 * La categoría elegida decide qué se muestra. Los campos de vino no se
 * deshabilitan: directamente **no se renderizan**, así el formulario no manda
 * datos que la action va a descartar, y quien carga una heladera no tiene que
 * leer seis campos que no le sirven.
 */
export function ProductoForm({
  action,
  categoriasOpciones,
  bodegasOpciones,
  varietalesOpciones,
  cotizacion,
  defaults,
  submitLabel,
}: {
  action: FormAction;
  categoriasOpciones: CategoriaOpcion[];
  bodegasOpciones: BodegaOpcion[];
  varietalesOpciones: VarietalOpcion[];
  cotizacion: number | null;
  defaults?: ProductoDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [categoriaId, setCategoriaId] = useState(defaults?.categoriaId ?? "");

  const categoria = categoriasOpciones.find((c) => c.id === categoriaId);
  const esVino = categoria?.esVino ?? false;

  const precioInicial =
    defaults?.precioCentavos === undefined
      ? ""
      : String(defaults.precioCentavos / 100);

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="categoriaId">
          Categoría
        </label>
        <select
          id="categoriaId"
          name="categoriaId"
          required
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className={styles.select}
        >
          <option value="" disabled>
            Elegí una categoría…
          </option>
          {categoriasOpciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          Decide qué ficha se pide.{" "}
          {categoria
            ? esVino
              ? "Ésta lleva ficha de vino: bodega, varietales y añada."
              : "Ésta lleva ficha corta: nombre, precio y stock."
            : "Las de vino piden bodega, varietales y añada; el resto, no."}
        </span>
      </div>

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
          Vacío sale del nombre. Es la URL de la ficha cuando la tienda lea de
          la base.
        </span>
      </div>

      {esVino ? (
        <>
          <div className={styles.formSection}>Qué vino es</div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bodegaId">
              Bodega
            </label>
            <select
              id="bodegaId"
              name="bodegaId"
              required
              defaultValue={defaults?.bodegaId ?? ""}
              className={styles.select}
            >
              <option value="" disabled>
                Elegí una bodega…
              </option>
              {bodegasOpciones.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tipo">
              Tipo
            </label>
            <select
              id="tipo"
              name="tipo"
              required
              defaultValue={defaults?.tipo ?? ""}
              className={styles.select}
            >
              <option value="" disabled>
                Elegí un tipo…
              </option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              El estilo del vino. No se modela como categoría para no tener el
              mismo dato en dos lugares.
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Varietales</span>
            {varietalesOpciones.length === 0 ? (
              <span className={styles.hint}>
                No hay varietales cargados. Se agregan en Catálogo &rsaquo;
                Varietales.
              </span>
            ) : (
              <>
                <Chips
                  name="varietales"
                  opciones={varietalesOpciones.map((v) => ({
                    value: v.id,
                    label: v.nombre,
                  }))}
                  seleccionadas={defaults?.varietalIds ?? []}
                />
                <span className={styles.hint}>
                  Al menos uno. Los blends llevan todas sus uvas.
                </span>
              </>
            )}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="region">
                Región
              </label>
              <input
                id="region"
                name="region"
                type="text"
                placeholder="Valle de Uco · Mendoza"
                defaultValue={defaults?.region ?? ""}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="anada">
                Añada
              </label>
              <input
                id="anada"
                name="anada"
                type="number"
                min="1900"
                max="2100"
                step="1"
                defaultValue={defaults?.anada ?? ""}
                className={styles.input}
              />
              <span className={styles.hint}>
                Vacío si no tiene: pasa con espumantes y blends.
              </span>
            </div>
          </div>
        </>
      ) : null}

      <div className={styles.formSection}>Cuánto sale</div>

      <CampoPrecio
        precioInicial={precioInicial}
        monedaInicial={defaults?.moneda ?? "ARS"}
        cotizacion={cotizacion}
      />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="stock">
            Stock
          </label>
          <input
            id="stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={defaults?.stock ?? 0}
            className={styles.input}
          />
          <span className={styles.hint}>Unidades disponibles.</span>
        </div>

        {esVino ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="volumenMl">
              Volumen (ml)
            </label>
            <input
              id="volumenMl"
              name="volumenMl"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={defaults?.volumenMl ?? 750}
              className={styles.input}
            />
            <span className={styles.hint}>750 salvo magnums y medias.</span>
          </div>
        ) : null}
      </div>

      <div className={styles.formSection}>La ficha</div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="descripcion">
          {esVino ? "Notas de cata" : "Descripción"}
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={5}
          defaultValue={defaults?.descripcion ?? ""}
          className={styles.textarea}
        />
      </div>

      {esVino ? (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="guarda">
              Guarda
            </label>
            <input
              id="guarda"
              name="guarda"
              type="text"
              placeholder="Listo para beber"
              defaultValue={defaults?.guarda ?? ""}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Maridajes</span>
            <Chips
              name="maridajes"
              opciones={MARIDAJES.map((m) => ({ value: m, label: m }))}
              seleccionadas={defaults?.maridajes ?? []}
            />
          </div>
        </>
      ) : null}

      <div className={styles.field}>
        <label className={styles.radioRow}>
          <input
            type="checkbox"
            name="destacado"
            defaultChecked={defaults?.destacado ?? false}
          />
          <span>
            <span className={styles.radioName}>Destacado</span>
            <span className={styles.radioDesc}>
              Los destacados son los que la home muestra primero.
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

/** Archiva o reactiva. No hay borrado: mañana hay pedidos colgando de acá. */
export function ArchivarProductoForm({
  action,
  productoId,
  isActive,
}: {
  action: FormAction;
  productoId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />
      <input type="hidden" name="id" value={productoId} />

      <p className={styles.hint} style={{ margin: 0 }}>
        {isActive
          ? "Archivarlo lo saca del catálogo. No se borra: queda para el historial y se puede reactivar."
          : "Reactivarlo lo devuelve al catálogo con los mismos datos."}
      </p>

      <div className={styles.btnRow}>
        <Submit variant="plain">{isActive ? "Archivar" : "Reactivar"}</Submit>
      </div>
    </form>
  );
}

/**
 * La cotización del dólar, arriba del listado.
 *
 * No tiene pantalla propia a propósito: es un dato, no una sección, y se mira
 * justo cuando se están cargando precios.
 */
export function CotizacionForm({
  action,
  cotizacion,
}: {
  action: FormAction;
  cotizacion: number | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className={styles.form}>
      <Aviso state={state} />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cotizacion">
            US$ 1 en pesos
          </label>
          <input
            id="cotizacion"
            name="cotizacion"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={cotizacion === null ? "" : String(cotizacion / 100)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>&nbsp;</span>
          <Submit variant="plain">Actualizar</Submit>
        </div>
      </div>
    </form>
  );
}
