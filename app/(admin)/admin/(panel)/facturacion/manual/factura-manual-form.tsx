"use client";

import { useActionState, useState } from "react";
import type { FormaPago } from "@/lib/db/schema";
import { calcular, type Renglon } from "@/lib/facturacion/calculo";
import { FORMAS_DE_PAGO, FORMAS_MANUALES } from "@/lib/facturacion/formas-de-pago";
import { DIAS_HACIA_ATRAS, rangoDeFecha, validarFecha } from "@/lib/facturacion/reglas";
import { formatFecha } from "@/lib/format";
import type { FormState } from "../../form-ui";
import { emitirFacturaManualAction } from "../actions";
import { HojaFactura, PercepcionCampo, usePercepcion } from "../hoja-factura";
import { VistaPrevia } from "../vista-previa";
import {
  ReceptorCampos,
  SIN_IDENTIFICAR,
  letraDe,
  type ClienteParaFacturar,
  type DatosIniciales,
} from "../receptor-campos";
import { RenglonesCampos, useRenglones, type ProductoParaFacturar } from "../renglones";
import styles from "../../../admin.module.css";
import propios from "../facturacion.module.css";

const INICIAL: FormState = {};

/**
 * La fecha con la que arranca una factura que sale de un presupuesto o recibo:
 * la del documento, que es la de la venta, corrida a lo más cercano que deja
 * ARCA si quedó afuera del rango. La letra se adivina como la va a poner el
 * receptor al precargar el cliente; si después cambia, la validación de la
 * fecha lo avisa.
 */
function fechaInicial(
  desde: { fecha: string; cliente: ClienteParaFacturar | null },
  hoy: string,
  ultimas: Record<"A" | "B", string | null>,
) {
  // La misma regla que `elegirCliente` en receptor-campos.tsx; sin cliente,
  // el receptor arranca como consumidor final.
  const c = desde.cliente;
  const conCuit = (c?.documento ?? "").replace(/\D/g, "").length === 11;
  const condicion = c ? (c.condicionIva ?? (conCuit ? "responsable_inscripto" : "consumidor_final")) : "consumidor_final";
  const { min, max } = rangoDeFecha(hoy, ultimas[letraDe(condicion)]);
  return desde.fecha < min ? min : desde.fecha > max ? max : desde.fecha;
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
  emisorCuit,
  desde,
}: {
  id: string;
  clientes: ClienteParaFacturar[];
  productos: ProductoParaFacturar[];
  /** "AAAA-MM-DD" en Buenos Aires, del servidor: el reloj del navegador puede mentir. */
  hoy: string;
  /** La fecha de la última factura de cada letra, para no romper la correlatividad. */
  ultimas: Record<"A" | "B", string | null>;
  emisorCuit: string | null;
  /** El presupuesto o recibo que se pasa a factura: precarga renglones y receptor. */
  desde?: {
    documentoId: string;
    renglones: Renglon[];
    cliente: ClienteParaFacturar | null;
    receptor: DatosIniciales;
    /** La del documento: es la de la venta. */
    fecha: string;
    formaPago: FormaPago | null;
  };
}) {
  const [state, action] = useActionState(emitirFacturaManualAction, INICIAL);
  const renglonesEstado = useRenglones(desde?.renglones);
  const { validos, problema } = renglonesEstado;
  const percepcion = usePercepcion();
  const [formaPago, setFormaPago] = useState<FormaPago>(desde?.formaPago ?? "efectivo");
  const [fecha, setFecha] = useState(() => (desde ? fechaInicial(desde, hoy, ultimas) : hoy));

  const calc = calcular(validos, { percepcionIva: percepcion.aplica });
  const { letra } = percepcion;
  const rango = rangoDeFecha(hoy, ultimas[letra]);
  const errorFecha = validarFecha(fecha, rango);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="renglones" value={JSON.stringify(validos)} />
      {desde ? <input type="hidden" name="documentoId" value={desde.documentoId} /> : null}

      <HojaFactura
        letra={letra}
        fecha={fecha}
        emisorCuit={emisorCuit}
        receptor={
          // Primero a quién: el cliente precarga el receptor y la percepción.
          <ReceptorCampos
            iniciales={desde?.receptor ?? SIN_IDENTIFICAR}
            clientes={clientes}
            clienteInicial={desde?.cliente}
            onCambio={percepcion.alCambiarReceptor}
          />
        }
        renglones={
          <RenglonesCampos
            estado={renglonesEstado}
            productos={productos}
            calc={calc}
            conAlcanzado={percepcion.aplica}
          />
        }
        condiciones={
          <>
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
            {errorFecha ? (
              <span className={propios.error}>{errorFecha}</span>
            ) : (
              <span className={styles.hint}>
                {rango.min === rango.max
                  ? `Sólo hoy: ya hay una Factura ${letra} con fecha de hoy, y ARCA no deja emitir una con fecha anterior.`
                  : `Desde el ${formatFecha(rango.min)}: hasta ${DIAS_HACIA_ATRAS} días atrás, y nunca antes de la última Factura ${letra}.`}
              </span>
            )}
            <PercepcionCampo estado={percepcion} calc={calc} />
          </>
        }
        calc={calc}
      >
        <VistaPrevia
          letra={letra}
          fecha={fecha}
          formaPago={FORMAS_DE_PAGO[formaPago]}
          calc={calc}
          clientes={clientes}
          state={state}
          deshabilitado={problema !== null || errorFecha !== null || validos.length === 0}
        />
      </HojaFactura>
    </form>
  );
}
