import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema";
import type { ClienteParaFacturar } from "./receptor-campos";

/**
 * Los clientes que ofrece el buscador de la factura: todos los activos, también
 * los que no tienen documento (salen como B sin identificar, pero la factura
 * queda asociada). Viajan enteros al formulario: son cientos, no miles.
 */
export function clientesParaFacturar(): Promise<ClienteParaFacturar[]> {
  return db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apodo: clientes.apodo,
      razonSocial: clientes.razonSocial,
      documento: clientes.documento,
      condicionIva: clientes.condicionIva,
      percepcionIva: clientes.percepcionIva,
      direccion: clientes.direccion,
      localidad: clientes.localidad,
      provincia: clientes.provincia,
      email: clientes.email,
    })
    .from(clientes)
    .where(eq(clientes.isActive, true))
    .orderBy(asc(clientes.nombre));
}
