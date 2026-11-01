"use client";

import { useActionState } from "react";
import { calcular, errorDeTotalDelCobro } from "@/lib/facturacion/calculo";
import { FORMAS_DE_PAGO } from "@/lib/facturacion/formas-de-pago";
import type { FormState } from "../form-ui";
import { emitirFacturaAction } from "./actions";
import { HojaFactura, PercepcionCampo, usePercepcion } from "./hoja-factura";
import {
  ReceptorCampos,
  type ClienteParaFacturar,
  type DatosIniciales,
} from "./receptor-campos";
import { RenglonesCampos, useRenglones, type ProductoParaFacturar } from "./renglones";
import { VistaPrevia } from "./vista-previa";
import styles from "../../admin.module.css";

export type { ClienteParaFacturar, DatosIniciales };

const INICIAL: FormState = {};

/**
 * La factura de un cobro de MP. Arranca con un renglón por el total, precargado
 * con lo que mandó MP, y los conceptos se pueden cambiar mientras sumen lo
 * cobrado. Sale con la fecha del día y como pago electrónico.
 */
export function EmitirForm({
  movimientoId,
  importeCentavos,
  descripcion,
  hoy,
  iniciales,
  clientes,
  productos,
  emisorCuit,
}: {
  movimientoId: string;
  importeCentavos: number;
  /** El renglón con el que arranca (`descripcionDelCobro`). */
  descripcion: string;
  hoy: string;
  iniciales: DatosIniciales;
  clientes: ClienteParaFacturar[];
  productos: ProductoParaFacturar[];
  emisorCuit: string | null;
}) {
  const [state, action] = useActionState(emitirFacturaAction, INICIAL);
  const renglones = useRenglones([
    {
      productoId: null,
      descripcion,
      cantidad: 1,
      precioUnitarioCentavos: importeCentavos,
      descuentoPct: 0,
      alcanzado: false,
    },
  ]);
  const { validos, problema } = renglones;
  const percepcion = usePercepcion();
  const calc = calcular(validos, { percepcionIva: percepcion.aplica });
  const noCoincide = errorDeTotalDelCobro(calc.totalCentavos, importeCentavos) !== null;

  return (
    <form action={action}>
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <input type="hidden" name="renglones" value={JSON.stringify(validos)} />

      <HojaFactura
        letra={percepcion.letra}
        fecha={hoy}
        emisorCuit={emisorCuit}
        receptor={
          <ReceptorCampos
            iniciales={iniciales}
            clientes={clientes}
            onCambio={percepcion.alCambiarReceptor}
          />
        }
        renglones={
          <RenglonesCampos
            estado={renglones}
            productos={productos}
            calc={calc}
            conAlcanzado={percepcion.aplica}
          />
        }
        condiciones={
          <>
            <p className={styles.hint}>
              Sale con la fecha de hoy y forma de pago {FORMAS_DE_PAGO.electronico.toLowerCase()}.
            </p>
            <PercepcionCampo estado={percepcion} calc={calc} />
          </>
        }
        calc={calc}
        cobroCentavos={importeCentavos}
      >
        <VistaPrevia
          letra={percepcion.letra}
          fecha={hoy}
          formaPago={FORMAS_DE_PAGO.electronico}
          calc={calc}
          clientes={clientes}
          state={state}
          deshabilitado={problema !== null || validos.length === 0 || noCoincide}
        />
      </HojaFactura>
    </form>
  );
}
