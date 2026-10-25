"use client";

import { useActionState, useState } from "react";
import type { CondicionIva } from "@/lib/db/schema";
import { calcular } from "@/lib/facturacion/calculo";
import { FORMAS_DE_PAGO } from "@/lib/facturacion/formas-de-pago";
import { formatARS } from "@/lib/format";
import type { FormState } from "../form-ui";
import { emitirFacturaAction } from "./actions";
import {
  ReceptorCampos,
  letraDe,
  type ClienteParaFacturar,
  type DatosIniciales,
} from "./receptor-campos";
import { VistaPrevia } from "./vista-previa";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

export type { ClienteParaFacturar, DatosIniciales };

const INICIAL: FormState = {};

/**
 * La factura de un cobro de MP: el importe es el del cobro, lo único que se
 * carga es el receptor. Precargado con lo que mandó MP del pagador. Sale con la
 * fecha del día y como pago electrónico.
 */
export function EmitirForm({
  movimientoId,
  importeCentavos,
  descripcion,
  hoy,
  iniciales,
  clientes,
}: {
  movimientoId: string;
  importeCentavos: number;
  /** El renglón que va a la factura (`descripcionDelCobro`). */
  descripcion: string;
  hoy: string;
  iniciales: DatosIniciales;
  clientes: ClienteParaFacturar[];
}) {
  const [state, action] = useActionState(emitirFacturaAction, INICIAL);
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  // El mismo cálculo que hace el servidor con el único renglón del cobro.
  const calc = calcular(
    [
      {
        productoId: null,
        descripcion,
        cantidad: 1,
        precioUnitarioCentavos: importeCentavos,
        descuentoPct: 0,
        alcanzado: false,
      },
    ],
    { percepcionIva: false },
  );

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <ReceptorCampos
        iniciales={iniciales}
        clientes={clientes}
        onCambio={(r) => setCondicion(r.condicion)}
      />

      <p className={propios.resumen}>
        <span>Neto {formatARS(calc.netoCentavos)}</span>
        <span>IVA 21% {formatARS(calc.ivaCentavos)}</span>
        <strong>Total {formatARS(calc.totalCentavos)}</strong>
      </p>

      <VistaPrevia
        letra={letraDe(condicion)}
        fecha={hoy}
        formaPago={FORMAS_DE_PAGO.electronico}
        calc={calc}
        clientes={clientes}
        state={state}
        deshabilitado={false}
      />
    </form>
  );
}
