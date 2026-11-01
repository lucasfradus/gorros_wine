"use client";

import { useActionState, useState } from "react";
import type { DocumentoTipo, FormaPago } from "@/lib/db/schema";
import { calcular } from "@/lib/facturacion/calculo";
import { FORMAS_DE_PAGO, FORMAS_MANUALES } from "@/lib/facturacion/formas-de-pago";
import { formatARS } from "@/lib/format";
import { Aviso, Submit, type FormState } from "../../../form-ui";
import { ClienteBuscador, etiquetaCliente } from "../../cliente-buscador";
import type { ClienteParaFacturar } from "../../receptor-campos";
import { RenglonesCampos, useRenglones, type ProductoParaFacturar } from "../../renglones";
import { emitirDocumentoAction } from "../actions";
import styles from "../../../../admin.module.css";
import propios from "../../facturacion.module.css";

const INICIAL: FormState = {};

/**
 * Un presupuesto o un recibo: los mismos renglones que la factura manual, pero
 * sin receptor fiscal (alcanza con un nombre), sin percepción y con fecha
 * libre. El presupuesto lleva hasta cuándo vale; el recibo, cómo se pagó.
 */
export function DocumentoForm({
  id,
  tipoInicial,
  clientes,
  productos,
  hoy,
}: {
  id: string;
  tipoInicial: DocumentoTipo;
  clientes: ClienteParaFacturar[];
  productos: ProductoParaFacturar[];
  /** "AAAA-MM-DD" en Buenos Aires, del servidor. */
  hoy: string;
}) {
  const [state, action] = useActionState(emitirDocumentoAction, INICIAL);
  const renglones = useRenglones();
  const [tipo, setTipo] = useState<DocumentoTipo>(tipoInicial);
  const [cliente, setCliente] = useState<ClienteParaFacturar | null>(null);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");

  const calc = calcular(renglones.validos, { percepcionIva: false });
  const esRecibo = tipo === "recibo";

  function elegirCliente(c: ClienteParaFacturar | null) {
    setCliente(c);
    // Precarga lo del cliente; después se puede corregir a mano.
    setNombre(c ? etiquetaCliente(c) : "");
    setDocumento(c?.documento ?? "");
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="clienteId" value={cliente?.id ?? ""} />
      <input type="hidden" name="renglones" value={JSON.stringify(renglones.validos)} />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="tipo">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as DocumentoTipo)}
          className={styles.select}
        >
          <option value="presupuesto">Presupuesto</option>
          <option value="recibo">Recibo</option>
        </select>
        <span className={styles.hint}>
          Sin validez fiscal: no pasa por ARCA. Después se puede pasar a factura.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Cliente</span>
        <ClienteBuscador clientes={clientes} elegido={cliente} onElegir={elegirCliente} />
        <span className={styles.hint}>O dejalo vacío y escribí el nombre.</span>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="receptorNombre">
            Nombre
          </label>
          <input
            id="receptorNombre"
            name="receptorNombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={160}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="receptorDocumento">
            CUIT / DNI (opcional)
          </label>
          <input
            id="receptorDocumento"
            name="receptorDocumento"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            maxLength={40}
            className={styles.input}
          />
        </div>
      </div>

      <RenglonesCampos estado={renglones} productos={productos} calc={calc} conAlcanzado={false} />

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fecha">
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={hoy}
            required
            className={styles.input}
          />
          <span className={styles.hint}>La de la venta: no tiene el límite de días de la factura.</span>
        </div>
        {esRecibo ? (
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
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="validoHasta">
              Válido hasta (opcional)
            </label>
            <input id="validoHasta" name="validoHasta" type="date" min={hoy} className={styles.input} />
          </div>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="observaciones">
          Observaciones (opcional)
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          maxLength={1000}
          rows={3}
          className={styles.textarea}
        />
      </div>

      <p className={propios.resumen}>
        <span>Neto {formatARS(calc.netoCentavos)}</span>
        <span>IVA 21% {formatARS(calc.ivaCentavos)}</span>
        <strong>Total {formatARS(calc.totalCentavos)}</strong>
      </p>

      <Aviso state={state} />
      <div className={styles.btnRow}>
        {renglones.problema || renglones.validos.length === 0 ? (
          <button type="button" disabled className={`${styles.btn} ${styles.btnPrimary}`}>
            Guardar {esRecibo ? "recibo" : "presupuesto"}
          </button>
        ) : (
          <Submit>{`Guardar ${esRecibo ? "recibo" : "presupuesto"}`}</Submit>
        )}
      </div>
    </form>
  );
}
