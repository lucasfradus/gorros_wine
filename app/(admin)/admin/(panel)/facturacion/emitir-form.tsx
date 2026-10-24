"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CondicionIva } from "@/lib/db/schema";
import { formatARS } from "@/lib/format";
import { Aviso, type FormState } from "../form-ui";
import { emitirFacturaAction } from "./actions";
import {
  ReceptorCampos,
  letraDe,
  type ClienteParaFacturar,
  type DatosIniciales,
} from "./receptor-campos";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

export type { ClienteParaFacturar, DatosIniciales };

const INICIAL: FormState = {};

/**
 * La factura de un cobro de MP: el importe es el del cobro, lo único que se
 * carga es el receptor. Precargado con lo que mandó MP del pagador.
 */
export function EmitirForm({
  movimientoId,
  importeCentavos,
  iniciales,
  clientes,
}: {
  movimientoId: string;
  importeCentavos: number;
  iniciales: DatosIniciales;
  clientes: ClienteParaFacturar[];
}) {
  const [state, action] = useActionState(emitirFacturaAction, INICIAL);
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  // Neto e IVA para mostrar: el precio va con IVA incluido al 21%.
  const neto = Math.round(importeCentavos / 1.21);

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <ReceptorCampos
        iniciales={iniciales}
        clientes={clientes}
        onCambio={(r) => setCondicion(r.condicion)}
      />

      <p className={propios.resumen}>
        <span>Neto {formatARS(neto)}</span>
        <span>IVA 21% {formatARS(importeCentavos - neto)}</span>
        <strong>Total {formatARS(importeCentavos)}</strong>
      </p>

      <Aviso state={state} />
      <Boton letra={letraDe(condicion)} />
    </form>
  );
}

export function Boton({ letra, deshabilitado = false }: { letra: string; deshabilitado?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || deshabilitado} className={`${styles.btn} ${styles.btnPrimary}`}>
      {pending ? "Reservando…" : `Emitir Factura ${letra}`}
    </button>
  );
}
