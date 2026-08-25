/**
 * Fechas del panel y de la agenda. La zona horaria va fija a Buenos Aires y no
 * se toma del servidor: si mañana el sitio se despliega en una máquina en UTC,
 * las horas tienen que seguir leyéndose como las lee el local.
 */
const ZONA = "America/Argentina/Buenos_Aires";

const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: ZONA,
});

export function formatDateTime(value: Date | null | undefined): string {
  return value ? dateTimeFormat.format(value) : "—";
}

// ---------- la agenda de eventos ----------

const diaFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
});

const mesFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  month: "short",
});

/**
 * `hour12: false` explícito. `es-AR` por defecto formatea en 12 horas y
 * devuelve "07:30 p. m."; el diseño de la agenda muestra "19:30 hs".
 */
const horaFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** El número grande de la tarjeta: "18". */
export function formatDia(fecha: Date): string {
  return diaFormat.format(fecha);
}

/**
 * El mes corto de la tarjeta: "Jul".
 *
 * Dos retoques sobre lo que devuelve `Intl`, los dos por el mismo motivo: acá
 * el mes es una etiqueta suelta arriba del día, no una palabra adentro de una
 * frase.
 *
 * - Va con mayúscula inicial, aunque en castellano los meses se escriban en
 *   minúscula.
 * - Se corta en tres letras. `es-AR` abrevia septiembre como "sept" y los
 *   otros once con tres; en un badge de 10px con `letter-spacing: 0.2em` ese
 *   mes queda notoriamente más ancho que el resto de la columna.
 */
export function formatMes(fecha: Date): string {
  const mes = mesFormat.format(fecha).slice(0, 3);
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

/** La hora del renglón: "19:30 hs". */
export function formatHora(fecha: Date): string {
  return `${horaFormat.format(fecha)} hs`;
}

/**
 * El offset de Buenos Aires es fijo desde 2009: acá no hay horario de verano.
 * Por eso las dos funciones de abajo pueden hacer la cuenta a mano en vez de
 * arrastrar una librería de zonas horarias.
 */
const OFFSET_AR = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Lo que escribió alguien en un `<input type="datetime-local">` → el instante
 * que corresponde.
 *
 * El input entrega `"2026-09-18T19:30"`, **sin zona**, y quien lo escribió
 * estaba pensando en la hora del local. Parsearlo con `new Date(valor)` a secas
 * lo interpreta en la zona del servidor: en producción, que corre en UTC, una
 * cata de las 19:30 se guardaría como 19:30 UTC y se mostraría a las 16:30.
 *
 * Devuelve una fecha inválida si el string no tiene la forma esperada. Eso lo
 * detecta zod del otro lado, que es donde va el mensaje para la persona.
 */
export function desdeInputLocal(valor: string): Date {
  return new Date(`${valor}:00${OFFSET_AR}`);
}

/**
 * El instante guardado → lo que tiene que mostrar el `<input datetime-local>`.
 *
 * El camino de vuelta del anterior: sin esto, abrir la edición de un evento
 * muestra la hora corrida. Se corre el instante y se recorta el ISO, que
 * siempre viene en UTC: restarle el offset deja la hora de acá.
 */
export function aInputLocal(fecha: Date): string {
  return new Date(fecha.getTime() - OFFSET_MS).toISOString().slice(0, 16);
}
