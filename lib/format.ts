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

/**
 * Las dos de abajo reciben el `comienza` de un evento tal como sale de la base
 * y llega al navegador: el string `"2026-09-18"`, nunca un `Date`.
 *
 * Por eso leen el string a mano en vez de pasar por `Intl`. No es micro
 * optimización: una fecha sin hora no tiene instante, y convertirla a `Date`
 * para formatearla la ancla a medianoche UTC. Formateada después en Buenos
 * Aires —tres horas atrás— cada evento se mostraría **un día antes**. Sin
 * `Date` de por medio ese error no se puede cometer.
 */
const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** El número grande de la tarjeta: "18". */
export function formatDia(fecha: string): string {
  return fecha.slice(8, 10);
}

/**
 * El mes corto de la tarjeta: "Jul".
 *
 * La tabla es la que era: `es-AR` abrevia en minúscula y septiembre con cuatro
 * letras ("sept"), y acá el mes es una etiqueta suelta arriba del día. En un
 * badge de 10px con `letter-spacing: 0.2em` ese mes quedaba notoriamente más
 * ancho que el resto de la columna.
 */
export function formatMes(fecha: string): string {
  return MESES[Number(fecha.slice(5, 7)) - 1];
}

/** Sólo la fecha. El extracto de la cuenta no necesita la hora. */
const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeZone: ZONA,
});

export function formatDate(value: Date | null | undefined): string {
  return value ? dateFormat.format(value) : "—";
}

/**
 * Hoy en Buenos Aires, como "AAAA-MM-DD".
 *
 * Es el formato que habla `<input type="date">`, y sirve además para comparar
 * fechas por día sin meterse con husos: alcanza con comparar los strings.
 * Se calcula en el servidor y viaja como prop, porque si el navegador lo
 * resolviera por su cuenta el HTML hidratado no coincidiría.
 */
export function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
  }).format(new Date());
}

/**
 * Plata, siempre desde centavos.
 *
 * A mano y sin `Intl`, por la misma razón que `formatPrice` en `lib/data.ts`:
 * el separador de miles tiene que salir idéntico en el servidor y en el
 * navegador, o React se queja de que el HTML hidratado no coincide.
 *
 * Los centavos se muestran sólo cuando existen: "$5.000.000" se lee, y
 * "$5.000.000,00" es ruido en una pantalla llena de importes.
 */
function separarMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function cuerpoDelImporte(centavos: number): string {
  const abs = Math.abs(Math.round(centavos));
  const centavosSueltos = abs % 100;
  const entero = separarMiles(String(Math.floor(abs / 100)));
  return centavosSueltos === 0
    ? entero
    : `${entero},${String(centavosSueltos).padStart(2, "0")}`;
}

/** El signo va antes del símbolo: "-$1.500", no "$-1.500". */
export function formatARS(centavos: number): string {
  return `${centavos < 0 ? "-" : ""}$${cuerpoDelImporte(centavos)}`;
}

export function formatUSD(centavos: number): string {
  return `${centavos < 0 ? "-" : ""}USD ${cuerpoDelImporte(centavos)}`;
}

/**
 * El mismo importe pero para meter en un `<input>`: sin símbolo de moneda.
 * Conserva los puntos de miles porque `importeACentavos` los entiende y un
 * "5.000.000" se revisa de un vistazo; "5000000" no.
 */
export function importeEditable(centavos: number | null): string {
  return centavos === null ? "" : cuerpoDelImporte(centavos);
}

/**
 * La cotización que se pactó. Viene de Postgres como string —`numeric` no pasa
 * por un float ni de ida ni de vuelta— y se muestra sin los ceros de relleno
 * que trae la escala: "1200.0000" se lee "1.200".
 */
export function formatCotizacion(valor: string | null | undefined): string {
  if (!valor) return "—";
  const [entero, decimales = ""] = valor.split(".");
  const restantes = decimales.replace(/0+$/, "");
  const cuerpo = separarMiles(entero);
  // Si quedan decimales, van de a dos como mínimo: "1.250,50" y no "1.250,5".
  return restantes ? `${cuerpo},${restantes.padEnd(2, "0")}` : cuerpo;
}
