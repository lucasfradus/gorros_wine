"use client";

import { useMemo, useRef, useState } from "react";
import {
  conIvaDeNeto,
  netoDeConIva,
  parseImporte,
  validarRenglones,
  type Calculo,
  type Renglon,
} from "@/lib/facturacion/calculo";
import { formatARS } from "@/lib/format";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

/**
 * Los renglones de una venta, compartidos por la factura manual y por los
 * presupuestos y recibos: catálogo o texto libre, cantidad, precio con o sin
 * IVA y descuento. El estado vive en `useRenglones` y el formulario que los usa
 * decide qué hacer con las cuentas (percepción, totales).
 */

export interface ProductoParaFacturar {
  id: string;
  /** Lo que se busca y lo que va a la factura: "Malbec Reserva 2021 750 ml". */
  etiqueta: string;
  /** Ya en pesos: los de USD vienen pesificados con la última cotización. */
  precioCentavos: number;
  /** Si el precio de catálogo es en dólares, para avisarlo. */
  precioUsdCentavos: number | null;
  /** Bebida: entra en la base de la percepción de IVA. */
  alcanzado: boolean;
}

/** Un renglón mientras se escribe: todo texto, se interpreta al calcular. */
interface Fila {
  key: number;
  productoId: string | null;
  descripcion: string;
  cantidad: string;
  /** Con IVA: es el que vale para las cuentas. */
  precio: string;
  /** Sin IVA: se tipea o se completa a partir de `precio`. */
  neto: string;
  descuento: string;
  alcanzado: boolean;
}

export const pesosEditables = (centavos: number) =>
  (centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** La key es también el sufijo de los ids de los campos: tiene que salir igual
 *  en el servidor y en el cliente, así que la lleva el formulario y no un
 *  contador global (que React en dev incrementa dos veces). */
const filaVacia = (key: number): Fila => ({
  key,
  productoId: null,
  descripcion: "",
  cantidad: "1",
  precio: "",
  neto: "",
  descuento: "",
  // Un renglón libre arranca alcanzado: en una vinoteca lo que no está en el
  // catálogo casi siempre es una bebida. Se destilda si no.
  alcanzado: true,
});

/** Un renglón ya cargado (de un presupuesto que se pasa a factura) como fila. */
const filaDe = (key: number, r: Renglon): Fila => ({
  key,
  productoId: r.productoId,
  descripcion: r.descripcion,
  cantidad: String(r.cantidad),
  precio: pesosEditables(r.precioUnitarioCentavos),
  neto: pesosEditables(netoDeConIva(r.precioUnitarioCentavos)),
  descuento: r.descuentoPct ? String(r.descuentoPct).replace(".", ",") : "",
  alcanzado: r.alcanzado,
});

/** Una fila sin nada cargado no cuenta: es la que queda al agregar de más. */
const vacia = (f: Fila) =>
  !f.descripcion.trim() &&
  !f.precio.trim() &&
  !f.neto.trim() &&
  !f.descuento.trim() &&
  ["", "1"].includes(f.cantidad.trim());

/** La fila tal como la entiende el cálculo; `null` si todavía no cierra. */
function renglonDe(f: Fila): Renglon | null {
  const cantidad = Number(f.cantidad);
  const precio = parseImporte(f.precio);
  const descuento = f.descuento.trim() === "" ? 0 : Number(f.descuento.replace(",", "."));
  if (!f.descripcion.trim() || !Number.isInteger(cantidad) || cantidad < 1 || precio === null) return null;
  if (!(descuento >= 0 && descuento < 100)) return null;
  return {
    productoId: f.productoId,
    descripcion: f.descripcion.trim(),
    cantidad,
    precioUnitarioCentavos: precio,
    descuentoPct: descuento,
    alcanzado: f.alcanzado,
  };
}

/** El otro precio, o vacío si el tipeado todavía no se entiende. */
const convertido = (texto: string, de: (c: number) => number) => {
  const c = parseImporte(texto);
  return c === null ? "" : pesosEditables(de(c));
};

export function useRenglones(iniciales: Renglon[] = []) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.length ? iniciales.map((r, i) => filaDe(i, r)) : [filaVacia(0)],
  );
  const proximaKey = useRef(Math.max(1, iniciales.length));

  const renglones = filas.map(renglonDe);
  const validos = renglones.filter((r): r is Renglon => r !== null);
  // Un renglón a medio cargar, o con un precio que no se entiende ("12,345"),
  // frena el envío: descartarlo en silencio facturaría de menos.
  const aMedias = filas.findIndex((f, i) => !vacia(f) && renglones[i] === null);
  const problema =
    aMedias >= 0
      ? `Renglón ${aMedias + 1}: falta la descripción, la cantidad o el precio, o el precio no se entiende (escribilo como 12.345,67).`
      : validos.length > 0
        ? validarRenglones(validos)
        : null;

  function cambiar(key: number, cambio: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...cambio } : f)));
  }

  return {
    filas,
    renglones,
    validos,
    problema,
    cambiar,
    agregar: () => {
      const key = proximaKey.current++;
      setFilas((fs) => [...fs, filaVacia(key)]);
    },
    quitar: (key: number) => setFilas((fs) => fs.filter((x) => x.key !== key)),
  };
}

export type EstadoRenglones = ReturnType<typeof useRenglones>;

const rotulo = `${styles.label} ${propios.renglonRotulo}`;
const campoNumero = `${styles.input} ${propios.renglonNumero}`;

export function RenglonesCampos({
  estado,
  productos,
  calc,
  conAlcanzado,
}: {
  estado: EstadoRenglones;
  productos: ProductoParaFacturar[];
  calc: Calculo;
  /** Si se muestra la casilla "Bebida (percepción)" en cada renglón. */
  conAlcanzado: boolean;
}) {
  const { filas, renglones, validos, problema, cambiar, agregar, quitar } = estado;
  const porEtiqueta = useMemo(() => new Map(productos.map((p) => [p.etiqueta, p])), [productos]);

  /** Al escribir la descripción: si coincide con un producto, trae su precio. */
  function describir(key: number, texto: string) {
    const p = porEtiqueta.get(texto);
    cambiar(
      key,
      p
        ? {
            descripcion: texto,
            productoId: p.id,
            precio: pesosEditables(p.precioCentavos),
            neto: pesosEditables(netoDeConIva(p.precioCentavos)),
            alcanzado: p.alcanzado,
          }
        : { descripcion: texto, productoId: null },
    );
  }

  return (
    <fieldset className={propios.renglones}>
      <legend className={styles.label}>Qué se vende</legend>
      <datalist id="productos">
        {productos.map((p) => (
          <option key={p.id} value={p.etiqueta} />
        ))}
      </datalist>

      {/* Los títulos de columna se ven una sola vez. Cada campo conserva su
          label, oculto en escritorio y visible en la tarjeta del teléfono. */}
      <div className={propios.renglonesTitulos} aria-hidden="true">
        <span>Detalle</span>
        <span>Cant.</span>
        <span>Precio s/IVA</span>
        <span>Precio c/IVA</span>
        <span>Dto. %</span>
        <span>Subtotal</span>
        <span />
      </div>

      {filas.map((f, i) => {
        const r = renglones[i];
        const calculado = r ? calc.renglones[validos.indexOf(r)] : null;
        const producto = f.productoId ? productos.find((p) => p.id === f.productoId) : null;
        return (
          <div key={f.key} className={propios.renglon}>
            <div className={`${styles.field} ${propios.renglonDescripcion}`}>
              <label className={rotulo} htmlFor={`desc-${f.key}`}>
                Producto o descripción
              </label>
              <input
                id={`desc-${f.key}`}
                list="productos"
                value={f.descripcion}
                onChange={(e) => describir(f.key, e.target.value)}
                maxLength={200}
                placeholder="Buscá en el catálogo o escribí"
                autoComplete="off"
                className={styles.input}
              />
              {producto?.precioUsdCentavos != null ? (
                <span className={styles.hint}>
                  Precio de catálogo en USD {pesosEditables(producto.precioUsdCentavos)}, pasado a
                  pesos con la última cotización.
                </span>
              ) : null}
              {conAlcanzado ? (
                <label className={propios.renglonCheck}>
                  <input
                    type="checkbox"
                    checked={f.alcanzado}
                    onChange={(e) => cambiar(f.key, { alcanzado: e.target.checked })}
                  />
                  Bebida (percepción)
                </label>
              ) : null}
            </div>
            <div className={styles.field}>
              <label className={rotulo} htmlFor={`cant-${f.key}`}>
                Cantidad
              </label>
              <input
                id={`cant-${f.key}`}
                inputMode="numeric"
                value={f.cantidad}
                onChange={(e) => cambiar(f.key, { cantidad: e.target.value })}
                className={campoNumero}
              />
            </div>
            {/* Las dos columnas de precio: la que se tipea manda y la otra se
                completa. Las cuentas salen siempre del precio con IVA. */}
            <div className={styles.field}>
              <label className={rotulo} htmlFor={`neto-${f.key}`}>
                Precio s/IVA
              </label>
              <input
                id={`neto-${f.key}`}
                inputMode="decimal"
                value={f.neto}
                onChange={(e) =>
                  cambiar(f.key, { neto: e.target.value, precio: convertido(e.target.value, conIvaDeNeto) })
                }
                placeholder="0,00"
                className={campoNumero}
              />
            </div>
            <div className={styles.field}>
              <label className={rotulo} htmlFor={`precio-${f.key}`}>
                Precio c/IVA
              </label>
              <input
                id={`precio-${f.key}`}
                inputMode="decimal"
                value={f.precio}
                onChange={(e) =>
                  cambiar(f.key, { precio: e.target.value, neto: convertido(e.target.value, netoDeConIva) })
                }
                placeholder="0,00"
                className={campoNumero}
              />
            </div>
            <div className={styles.field}>
              <label className={rotulo} htmlFor={`dto-${f.key}`}>
                Dto. %
              </label>
              <input
                id={`dto-${f.key}`}
                inputMode="decimal"
                value={f.descuento}
                onChange={(e) => cambiar(f.key, { descuento: e.target.value })}
                placeholder="0"
                className={campoNumero}
              />
            </div>
            <span className={`${propios.importe} ${propios.renglonImporte}`}>
              {calculado ? formatARS(calculado.subtotalCentavos) : "—"}
            </span>
            {filas.length > 1 ? (
              <button
                type="button"
                onClick={() => quitar(f.key)}
                className={`${styles.btn} ${styles.btnSmall}`}
                aria-label={`Quitar el renglón ${i + 1}`}
              >
                Quitar
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}

      <button type="button" onClick={agregar} className={styles.btn}>
        + Agregar renglón
      </button>
      {problema ? <span className={propios.error}>{problema}</span> : null}
    </fieldset>
  );
}
