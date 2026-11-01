"use client";

import { useRef, useState } from "react";
import type { CondicionIva } from "@/lib/db/schema";
import { RG_5329, type Calculo } from "@/lib/facturacion/calculo";
import { formatCuit } from "@/lib/facturacion/cuit";
import { formatARS, formatFecha } from "@/lib/format";
import { letraDe, type ClienteParaFacturar } from "./receptor-campos";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";
import hoja from "./hoja-factura.module.css";

/**
 * La condición del receptor y la percepción, que dependen una de la otra. La
 * casilla se precarga del cliente al elegirlo (y se apaga al volver a "Otro");
 * después se puede cambiar a mano.
 */
export function usePercepcion() {
  const [condicion, setCondicion] = useState<CondicionIva>("consumidor_final");
  const [tildada, setTildada] = useState(false);
  const clienteAnterior = useRef<string | null>(null);
  const esRI = condicion === "responsable_inscripto";

  return {
    letra: letraDe(condicion),
    esRI,
    tildada,
    setTildada,
    /** Lo que vale para las cuentas: sólo un responsable inscripto se percibe. */
    aplica: esRI && tildada,
    alCambiarReceptor(r: { condicion: CondicionIva; cliente: ClienteParaFacturar | null }) {
      setCondicion(r.condicion);
      const id = r.cliente?.id ?? null;
      if (id !== clienteAnterior.current) {
        clienteAnterior.current = id;
        setTildada(r.cliente?.percepcionIva ?? false);
      }
    },
  };
}

export function PercepcionCampo({
  estado,
  calc,
}: {
  estado: ReturnType<typeof usePercepcion>;
  calc: Calculo;
}) {
  if (!estado.esRI) return null;
  return (
    <div className={styles.field}>
      <label className={propios.renglonCheck}>
        <input
          type="checkbox"
          name="percepcionIva"
          checked={estado.tildada}
          onChange={(e) => estado.setTildada(e.target.checked)}
        />
        Percepción de IVA RG 5329 (3% sobre las bebidas)
      </label>
      <span className={styles.hint}>
        A un responsable inscripto que revende: almacén, vinoteca, restaurante. Se aplica sólo si
        supera {formatARS(RG_5329.umbralCentavos)}.
      </span>
      {estado.aplica && calc.percepcionBajoUmbral ? (
        <span className={styles.hint}>
          La percepción daría {formatARS(calc.percepcionBajoUmbral.montoCentavos)}: no supera{" "}
          {formatARS(RG_5329.umbralCentavos)}, así que no corresponde.
        </span>
      ) : null}
    </div>
  );
}

/** Lo que falta o sobra para llegar al cobro: es lo que habilita emitir. */
function ControlDelCobro({ cobro, total }: { cobro: number; total: number }) {
  const diferencia = cobro - total;
  return (
    <>
      <dt>Cobro de MP</dt>
      <dd>{formatARS(cobro)}</dd>
      {diferencia === 0 ? (
        <dd className={`${hoja.control} ${hoja.controlOk}`}>Coincide con el cobro</dd>
      ) : (
        <>
          <dt className={hoja.controlFalta}>{diferencia > 0 ? "Falta" : "Sobra"}</dt>
          <dd className={hoja.controlFalta}>{formatARS(Math.abs(diferencia))}</dd>
        </>
      )}
    </>
  );
}

/**
 * La pantalla de emitir, dibujada como la factura: se carga sobre la hoja en
 * el mismo orden en que se va a leer. Sólo acomoda lo que le pasan; los campos y
 * las reglas son de cada formulario. El comprobante legal sigue siendo el PDF de
 * Facturante, por eso el número aparece recién al emitir.
 */
export function HojaFactura({
  letra,
  fecha,
  emisorCuit,
  receptor,
  renglones,
  condiciones,
  calc,
  cobroCentavos,
  children,
}: {
  letra: string;
  /** "AAAA-MM-DD". */
  fecha: string;
  emisorCuit: string | null;
  receptor: React.ReactNode;
  renglones: React.ReactNode;
  /** Abajo a la izquierda: fecha, forma de pago, percepción. */
  condiciones: React.ReactNode;
  calc: Calculo;
  /** En la factura de un cobro: contra qué se controla el total. */
  cobroCentavos?: number;
  /** El botón de emitir. */
  children: React.ReactNode;
}) {
  return (
    <article className={hoja.hoja}>
      <header className={hoja.encabezado}>
        <div className={hoja.emisor}>
          <strong>Gorros Wine</strong>
          {emisorCuit ? <span>CUIT {formatCuit(emisorCuit)}</span> : null}
        </div>
        <div className={hoja.letra} aria-label={`Factura ${letra}`}>
          {letra}
        </div>
        <dl className={hoja.identidad}>
          <dt>Factura</dt>
          <dd>Se numera al emitir</dd>
          <dt>Fecha</dt>
          <dd>{formatFecha(fecha)}</dd>
        </dl>
      </header>

      <section className={hoja.seccion} aria-label="Receptor">
        <div className={hoja.receptor}>{receptor}</div>
      </section>

      <section className={hoja.seccion} aria-label="Conceptos">
        {renglones}
      </section>

      <footer className={hoja.pie}>
        <div className={hoja.condiciones}>{condiciones}</div>
        <div className={hoja.cierre}>
          <dl className={hoja.totales}>
            <dt>Neto</dt>
            <dd>{formatARS(calc.netoCentavos)}</dd>
            <dt>IVA 21%</dt>
            <dd>{formatARS(calc.ivaCentavos)}</dd>
            {calc.percepciones.map((p) => (
              <div key={p.tipo} className={hoja.fila}>
                <dt>Percepción IVA 3%</dt>
                <dd>{formatARS(p.montoCentavos)}</dd>
              </div>
            ))}
            <dt className={hoja.total}>Total</dt>
            <dd className={hoja.total}>{formatARS(calc.totalCentavos)}</dd>
            {cobroCentavos !== undefined ? (
              <ControlDelCobro cobro={cobroCentavos} total={calc.totalCentavos} />
            ) : null}
          </dl>
          <div className={hoja.acciones}>{children}</div>
        </div>
      </footer>
    </article>
  );
}
