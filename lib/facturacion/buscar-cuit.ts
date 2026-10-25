import { ciudadesDe, consultarCuit } from "@/lib/facturante/client";
import { configFacturante } from "@/lib/facturante/config";
import { datosDelPadron, type DatosPadron } from "@/lib/facturante/padron";
import { cuitValido, soloDigitos } from "./cuit";

export type BusquedaCuit =
  | { ok: true; datos: DatosPadron & { localidad: string | null } }
  | { ok: false; error: string };

const HORA = 60 * 60 * 1000;

/**
 * Cachés en memoria del servidor. El padrón no cambia mientras se arma una
 * factura, y tipear, borrar y volver a tipear el mismo CUIT no tiene por qué
 * repetir la consulta. Las ciudades (2931 en Buenos Aires) cambian todavía
 * menos. Lo que dura de verdad es el cliente que se guarda con estos datos.
 */
const porCuit = new Map<string, { vence: number; valor: BusquedaCuit }>();
const ciudadesPorProvincia = new Map<number, { vence: number; lista: Map<number, string> }>();

async function nombreDeCiudad(stateId: number, cityId: number): Promise<string | null> {
  const cfg = configFacturante();
  if (!cfg) return null;
  let cache = ciudadesPorProvincia.get(stateId);
  if (!cache || cache.vence < Date.now()) {
    const lista = await ciudadesDe(cfg, stateId);
    cache = { vence: Date.now() + 24 * HORA, lista: new Map(lista.map((c) => [c.id, c.name])) };
    ciudadesPorProvincia.set(stateId, cache);
  }
  return cache.lista.get(cityId) ?? null;
}

/**
 * Los datos fiscales de un CUIT según el padrón de ARCA, vía Facturante. Para
 * completar el receptor: todo lo que devuelve se muestra editable.
 */
export async function buscarCuit(texto: string): Promise<BusquedaCuit> {
  const cuit = soloDigitos(texto);
  if (!cuitValido(cuit)) return { ok: false, error: "El CUIT no es válido." };
  const cfg = configFacturante();
  if (!cfg) return { ok: false, error: "Falta la configuración de Facturante." };

  const guardado = porCuit.get(cuit);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;

  let respuesta;
  try {
    respuesta = await consultarCuit(cfg, cuit);
  } catch (e) {
    // Una caída no se cachea: el próximo intento puede andar.
    console.error("[padron] VerifyCuit:", e);
    return { ok: false, error: "No se pudo consultar el padrón de ARCA. Cargá los datos a mano." };
  }

  const datos = datosDelPadron(respuesta);
  let valor: BusquedaCuit;
  if (!datos) {
    valor = { ok: false, error: "Ese CUIT no está en el padrón de ARCA. Revisalo o cargá los datos a mano." };
  } else {
    // La localidad es un extra: si la tabla de ciudades falla, se tipea.
    const localidad =
      datos.stateId && datos.cityId
        ? await nombreDeCiudad(datos.stateId, datos.cityId).catch(() => null)
        : null;
    valor = { ok: true, datos: { ...datos, localidad } };
  }
  porCuit.set(cuit, { vence: Date.now() + HORA, valor });
  return valor;
}
