import type { Comprobante } from "@/lib/db/schema";
import { sePuedeMarcarNoEmitido } from "@/lib/facturacion/estado";
import propios from "./facturacion.module.css";

type EnCamino = Pick<Comprobante, "estado" | "facturanteId" | "enviadoEn" | "createdAt">;

/**
 * ¿Sigue en camino y todavía es razonable esperar? Pasada la espera, el
 * spinner mentiría: la pantalla ya pide revisar a mano.
 */
export const esperandoCae = (c: EnCamino, ahora = Date.now()) =>
  (c.estado === "pendiente" || c.estado === "en_proceso") && !sePuedeMarcarNoEmitido(c, ahora);

export function Spinner() {
  return <span className={propios.spinner} aria-hidden="true" />;
}

/** El estado de un comprobante en una tabla: con spinner mientras se emite. */
export function EstadoComprobante({ c, texto }: { c: EnCamino; texto: string }) {
  if (!esperandoCae(c)) return <span>{texto}</span>;
  return (
    <span className={propios.enCurso}>
      <Spinner />
      {texto}
    </span>
  );
}

/**
 * Arriba del detalle, mientras algo se está emitiendo: qué pasa, cuánto tarda
 * y que no hace falta hacer nada. `role="status"` para que un lector de
 * pantalla lo anuncie.
 */
export function AvisoEmitiendo({ comps }: { comps: (EnCamino & Pick<Comprobante, "tipo">)[] }) {
  const enCamino = comps.find((c) => esperandoCae(c));
  if (!enCamino) return null;
  const que = enCamino.tipo === "nota_credito" ? "la nota de crédito" : "la factura";
  return (
    <div className={propios.emitiendo} role="status">
      <Spinner />
      <div>
        <strong>Emitiendo {que} en ARCA…</strong>
        <p>
          Facturante tarda unos 20 segundos en devolver el CAE. La página se actualiza sola:
          podés quedarte o seguir con otra cosa.
        </p>
      </div>
    </div>
  );
}
