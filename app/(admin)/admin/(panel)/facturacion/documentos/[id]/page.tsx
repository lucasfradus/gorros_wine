import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireFacturacion } from "@/lib/auth";
import { configFacturante } from "@/lib/facturante/config";
import { formatCuit } from "@/lib/facturacion/cuit";
import {
  NOMBRE_DOCUMENTO,
  documentoConItems,
  facturaViva,
  numeroDocumento,
} from "@/lib/facturacion/documentos";
import { FORMAS_DE_PAGO } from "@/lib/facturacion/formas-de-pago";
import { formatARS, formatFecha } from "@/lib/format";
import { AccionComprobante } from "../../acciones-comprobante";
import { anularDocumentoAction } from "../actions";
import { Imprimir } from "./imprimir";
import styles from "../../../../admin.module.css";
import propios from "../documentos.module.css";

export const metadata = { title: "Presupuesto o recibo" };

const porcentaje = (n: number) => `${String(n).replace(".", ",")}%`;

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFacturacion();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const encontrado = await documentoConItems(id);
  if (!encontrado) notFound();
  const { doc, items } = encontrado;
  const factura = await facturaViva(db, doc.id);

  const nombre = NOMBRE_DOCUMENTO[doc.tipo];
  const cuit = configFacturante()?.emisorCuit;
  const hayDescuento = items.some((it) => it.descuentoPct > 0);


  return (
    <>
      <Link href="/admin/facturacion/documentos" className={styles.backLink}>
        ← Presupuestos y recibos
      </Link>

      <div className={propios.acciones}>
        <Imprimir />
        {factura ? (
          <Link href={`/admin/facturacion/manual/${factura.id}`} className={`${styles.btn} ${styles.btnSmall}`}>
            Facturado: {factura.numero ?? `Factura ${factura.letra}`}
          </Link>
        ) : !doc.anulado ? (
          <Link
            href={`/admin/facturacion/manual?desde=${doc.id}`}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Pasar a factura
          </Link>
        ) : null}
        {/* Uno facturado ya no se anula acá: lo que se anula es la factura, con su NC. */}
        {!doc.anulado && !factura ? (
          <AccionComprobante
            action={anularDocumentoAction}
            id={doc.id}
            label="Anular"
            pendiente="Anulando…"
            confirmar={`¿Anular el ${nombre.toLowerCase()} N° ${numeroDocumento(doc.numero)}? Queda guardado, marcado como anulado.`}
            peligro
          />
        ) : null}
      </div>

      <article className={propios.hoja}>
        {doc.anulado ? <span className={propios.anulado}>ANULADO</span> : null}
        <header className={propios.cabecera}>
          <div>
            <p className={propios.emisor}>Gorros Wine</p>
            {cuit ? <p className={propios.dato}>CUIT {formatCuit(cuit)}</p> : null}
          </div>
          <div className={propios.titulo}>
            <p className={propios.tipo}>
              {nombre} N° {numeroDocumento(doc.numero)}
            </p>
            <p className={propios.dato}>Fecha {formatFecha(doc.fecha)}</p>
            {doc.validoHasta ? (
              <p className={propios.dato}>Válido hasta {formatFecha(doc.validoHasta)}</p>
            ) : null}
          </div>
        </header>
        <p className={propios.leyenda}>DOCUMENTO NO VÁLIDO COMO FACTURA</p>

        <dl className={propios.receptor}>
          <dt>{doc.tipo === "recibo" ? "Recibí de" : "Para"}</dt>
          <dd>{doc.receptorNombre ?? "—"}</dd>
          {doc.receptorDocumento ? (
            <>
              <dt>CUIT / DNI</dt>
              <dd>{doc.receptorDocumento}</dd>
            </>
          ) : null}
          {doc.formaPago ? (
            <>
              <dt>Forma de pago</dt>
              <dd>{FORMAS_DE_PAGO[doc.formaPago]}</dd>
            </>
          ) : null}
        </dl>

        <table className={propios.tabla}>
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col" className={propios.num}>
                Cant.
              </th>
              <th scope="col" className={propios.num}>
                Precio
              </th>
              {hayDescuento ? (
                <th scope="col" className={propios.num}>
                  Dto.
                </th>
              ) : null}
              <th scope="col" className={propios.num}>
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.descripcion}</td>
                <td data-label="Cant." className={propios.num}>
                  {it.cantidad}
                </td>
                <td data-label="Precio" className={propios.num}>
                  {formatARS(it.precioUnitarioCentavos)}
                </td>
                {hayDescuento ? (
                  <td data-label="Dto." className={propios.num}>
                    {it.descuentoPct ? porcentaje(it.descuentoPct) : "—"}
                  </td>
                ) : null}
                <td data-label="Subtotal" className={propios.num}>
                  {formatARS(it.subtotalCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={propios.totales}>
          <span className={propios.dato}>Precios con IVA incluido</span>
          <span className={propios.total}>Total {formatARS(doc.totalCentavos)}</span>
        </div>

        {doc.observaciones ? <p className={propios.observaciones}>{doc.observaciones}</p> : null}
      </article>
    </>
  );
}
