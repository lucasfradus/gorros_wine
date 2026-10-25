"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { CondicionIva, FormaPago } from "@/lib/db/schema";
import {
  calcular,
  parseImporte,
  RG_5329,
  validarRenglones,
  type Renglon,
} from "@/lib/facturacion/calculo";
import { FORMAS_DE_PAGO, FORMAS_MANUALES } from "@/lib/facturacion/formas-de-pago";
import { DIAS_HACIA_ATRAS, rangoDeFecha, validarFecha } from "@/lib/facturacion/reglas";
import { formatARS, formatFecha } from "@/lib/format";
import type { FormState } from "../../form-ui";
import { emitirFacturaManualAction } from "../actions";
import { VistaPrevia } from "../vista-previa";
import {
  ReceptorCampos,
  SIN_IDENTIFICAR,
  letraDe,
  type ClienteParaFacturar,
} from "../receptor-campos";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

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
  precio: string;
  descuento: string;
  alcanzado: boolean;
}

const INICIAL: FormState = {};
const pesosEditables = (centavos: number) =>
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
  descuento: "",
  // Un renglón libre arranca alcanzado: en una vinoteca lo que no está en el
  // catálogo casi siempre es una bebida. Se destilda si no.
  alcanzado: true,
});

/** Una fila sin nada cargado no cuenta: es la que queda al agregar de más. */
const vacia = (f: Fila) =>
  !f.descripcion.trim() && !f.precio.trim() && !f.descuento.trim() && ["", "1"].includes(f.cantidad.trim());

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

/**
 * La factura de una venta de mostrador o mayorista: renglones del catálogo o
 * libres, descuento por renglón, percepción de IVA y forma de pago. Las cuentas
 * se muestran con el mismo `calcular()` que usa el servidor, pero las que valen
 * son las del servidor.
 */
export function FacturaManualForm({
  id,
  clientes,
  productos,
  hoy,
  ultimas,
}: {
  id: string;
  clientes: ClienteParaFacturar[];
  productos: ProductoParaFacturar[];
  /** "AAAA-MM-DD" en Buenos Aires, del servidor: el reloj del navegador puede mentir. */
  hoy: string;
  /** La fecha de la última factura de cada letra, para no romper la correlatividad. */
  ultimas: Record<"A" | "B", string | null>;
}) {
  const [state, action] = useActionState(emitirFacturaManualAction, INICIAL);
  const [filas, setFilas] = useState<Fila[]>(() => [filaVacia(0)]);
  const proximaKey = useRef(1);
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  const [percepcion, setPercepcion] = useState(false);
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [fecha, setFecha] = useState(hoy);

  const porEtiqueta = useMemo(() => new Map(productos.map((p) => [p.etiqueta, p])), [productos]);
  const esRI = condicion === "responsable_inscripto";

  const renglones = filas.map(renglonDe);
  const validos = renglones.filter((r): r is Renglon => r !== null);
  const calc = calcular(validos, { percepcionIva: esRI && percepcion });
  // Un renglón a medio cargar, o con un precio que no se entiende ("12,345"),
  // frena el envío: descartarlo en silencio facturaría de menos.
  const aMedias = filas.findIndex((f, i) => !vacia(f) && renglones[i] === null);
  const problema =
    aMedias >= 0
      ? `Renglón ${aMedias + 1}: falta la descripción, la cantidad o el precio, o el precio no se entiende (escribilo como 12.345,67).`
      : validos.length > 0
        ? validarRenglones(validos)
        : null;
  const clienteAnterior = useRef<string | null>(null);
  const letra = letraDe(condicion);
  const rango = rangoDeFecha(hoy, ultimas[letra]);
  const errorFecha = validarFecha(fecha, rango);

  function cambiar(key: number, cambio: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...cambio } : f)));
  }

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
            alcanzado: p.alcanzado,
          }
        : { descripcion: texto, productoId: null },
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="renglones" value={JSON.stringify(validos)} />

      {/* Primero a quién: el cliente precarga el receptor y la percepción. */}
      <ReceptorCampos
        iniciales={SIN_IDENTIFICAR}
        clientes={clientes}
        onCambio={(r) => {
          setCondicion(r.condicion);
          // La casilla se precarga del cliente al elegirlo (y se apaga al
          // volver a "Otro"); después se puede cambiar a mano.
          const id = r.cliente?.id ?? null;
          if (id !== clienteAnterior.current) {
            clienteAnterior.current = id;
            setPercepcion(r.cliente?.percepcionIva ?? false);
          }
        }}
      />

      {esRI ? (
        <div className={styles.field}>
          <label className={propios.renglonCheck}>
            <input
              type="checkbox"
              name="percepcionIva"
              checked={percepcion}
              onChange={(e) => setPercepcion(e.target.checked)}
            />
            Percepción de IVA RG 5329 (3% sobre las bebidas)
          </label>
          <span className={styles.hint}>
            A un responsable inscripto que revende: almacén, vinoteca, restaurante. Se aplica
            sólo si supera {formatARS(RG_5329.umbralCentavos)}.
          </span>
        </div>
      ) : null}

      <fieldset className={propios.renglones}>
        <legend className={styles.label}>Qué se vende</legend>
        <datalist id="productos">
          {productos.map((p) => (
            <option key={p.id} value={p.etiqueta} />
          ))}
        </datalist>

        {filas.map((f, i) => {
          const r = renglones[i];
          const calculado = r ? calc.renglones[validos.indexOf(r)] : null;
          const producto = f.productoId ? productos.find((p) => p.id === f.productoId) : null;
          return (
            <div key={f.key} className={propios.renglon}>
              <div className={`${styles.field} ${propios.renglonDescripcion}`}>
                <label className={styles.label} htmlFor={`desc-${f.key}`}>
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
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`cant-${f.key}`}>
                  Cantidad
                </label>
                <input
                  id={`cant-${f.key}`}
                  inputMode="numeric"
                  value={f.cantidad}
                  onChange={(e) => cambiar(f.key, { cantidad: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`precio-${f.key}`}>
                  Precio c/IVA
                </label>
                <input
                  id={`precio-${f.key}`}
                  inputMode="decimal"
                  value={f.precio}
                  onChange={(e) => cambiar(f.key, { precio: e.target.value })}
                  placeholder="0,00"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`dto-${f.key}`}>
                  Dto. %
                </label>
                <input
                  id={`dto-${f.key}`}
                  inputMode="decimal"
                  value={f.descuento}
                  onChange={(e) => cambiar(f.key, { descuento: e.target.value })}
                  placeholder="0"
                  className={styles.input}
                />
              </div>
              <div className={propios.renglonPie}>
                <span className={propios.importe}>
                  {calculado ? formatARS(calculado.subtotalCentavos) : "—"}
                </span>
                {esRI && percepcion ? (
                  <label className={propios.renglonCheck}>
                    <input
                      type="checkbox"
                      checked={f.alcanzado}
                      onChange={(e) => cambiar(f.key, { alcanzado: e.target.checked })}
                    />
                    Bebida (percepción)
                  </label>
                ) : null}
                {filas.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFilas((fs) => fs.filter((x) => x.key !== f.key))}
                    className={`${styles.btn} ${styles.btnSmall}`}
                    aria-label={`Quitar el renglón ${i + 1}`}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const key = proximaKey.current++;
            setFilas((fs) => [...fs, filaVacia(key)]);
          }}
          className={styles.btn}
        >
          + Agregar renglón
        </button>
        {problema ? <span className={propios.error}>{problema}</span> : null}
      </fieldset>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fecha">
            Fecha de la factura
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            value={fecha}
            min={rango.min}
            max={rango.max}
            onChange={(e) => setFecha(e.target.value)}
            required
            className={styles.input}
          />
          {errorFecha ? (
            <span className={propios.error}>{errorFecha}</span>
          ) : (
            <span className={styles.hint}>
              {rango.min === rango.max
                ? `Sólo hoy: ya hay una Factura ${letra} con fecha de hoy, y ARCA no deja emitir una con fecha anterior.`
                : `Desde el ${formatFecha(rango.min)}: hasta ${DIAS_HACIA_ATRAS} días atrás, y nunca antes de la última Factura ${letra}.`}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="formaPago">
            Forma de pago
          </label>
          <select
            id="formaPago"
            name="formaPago"
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPago)}
            className={styles.select}
          >
            {FORMAS_MANUALES.map((f) => (
              <option key={f} value={f}>
                {FORMAS_DE_PAGO[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className={propios.resumen}>
        <span>Neto {formatARS(calc.netoCentavos)}</span>
        <span>IVA 21% {formatARS(calc.ivaCentavos)}</span>
        {calc.percepciones.map((p) => (
          <span key={p.tipo}>Percepción IVA 3% {formatARS(p.montoCentavos)}</span>
        ))}
        <strong>Total {formatARS(calc.totalCentavos)}</strong>
      </p>
      {esRI && percepcion && calc.percepcionBajoUmbral ? (
        <p className={styles.hint}>
          La percepción daría {formatARS(calc.percepcionBajoUmbral.montoCentavos)}: no supera{" "}
          {formatARS(RG_5329.umbralCentavos)}, así que no corresponde.
        </p>
      ) : null}

      <VistaPrevia
        letra={letra}
        fecha={fecha}
        formaPago={FORMAS_DE_PAGO[formaPago]}
        calc={calc}
        clientes={clientes}
        state={state}
        deshabilitado={problema !== null || errorFecha !== null || validos.length === 0}
      />
    </form>
  );
}
