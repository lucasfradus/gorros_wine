/**
 * Fechas del panel. La zona horaria va fija a Buenos Aires y no se toma del
 * servidor: si mañana el sitio se despliega en una máquina en UTC, las horas
 * tienen que seguir leyéndose como las lee el local.
 */
const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatDateTime(value: Date | null | undefined): string {
  return value ? dateTimeFormat.format(value) : "—";
}
