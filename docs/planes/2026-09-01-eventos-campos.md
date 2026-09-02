# Eventos: sacar el precio y la hora — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** que un evento sea un título, **un día**, un lugar, un detalle
opcional y una foto. Ni precio ni hora, en ningún lado.

**Enfoque:** `comienza` deja de ser un `timestamptz` y pasa a ser una columna
`date` **en modo string**, y `precio_centavos` se borra. El cambio de tipo es lo
que ordena todo lo demás: sin `Date` no hay huso horario, así que se van tres
funciones de `lib/format.ts` y la frontera de serialización de `lib/eventos.ts`.
La iteración resta código; no suma.

**Worktree:** `../Gorros-eventos-campos` · rama `feat/eventos-campos` · puerto `:3007`

---

## Contexto

La tabla `eventos` se diseñó en la [iteración del ABM](2026-08-25-eventos.md)
copiando la forma de los cuatro eventos hardcodeados de `lib/data.ts`: cada uno
traía precio y horario porque así estaban escritos en el diseño original. En el
uso real ninguno de los dos sirve — el precio de una cata no se publica en el
sitio, y la hora no se decide cuando se carga la fecha.

Eso costaba caro. `precio_centavos` obligaba a un campo requerido en el
formulario, un esquema zod propio y una columna en el listado. Y la hora
arrastraba más: para que "19:30" signifique lo mismo en la notebook de acá y en
producción (que corre en UTC) hacían falta tres funciones de huso en
`lib/format.ts`, un ida y vuelta `Date` ↔ `string` en `lib/eventos.ts` para
sobrevivir al `unstable_cache`, y un párrafo de `ARQUITECTURA.md` explicándolo.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Tabla `eventos` | `lib/db/schema.ts` |
| Lectura cacheada y corte próximos/pasados | `lib/eventos.ts` |
| Formato de día, mes y hora; husos | `lib/format.ts` |
| Alta, edición y borrado | `app/(admin)/admin/(panel)/eventos/actions.ts` |
| Formulario compartido | `app/(admin)/admin/(panel)/eventos/evento-forms.tsx` |
| Listado del panel | `app/(admin)/admin/(panel)/eventos/page.tsx` |
| Ficha de edición | `app/(admin)/admin/(panel)/eventos/[id]/page.tsx` |
| Página pública | `app/(store)/eventos/page.tsx` |
| Bloque de la home | `components/home-events.tsx` |
| Seed one-off ya corrido en producción | `scripts/_eventos-seed.mjs` |

## Decisiones ya tomadas (NO volver a preguntar)

1. **La hora se va de la base, no sólo de la pantalla.** `comienza` pasa a
   `date`. La alternativa —guardar 00:00 en un `timestamptz` y no mostrarlo—
   deja una columna con un dato que nadie eligió ni ve.
2. **`date` en modo string, no en modo `Date`.** Verificado en
   `node_modules/drizzle-orm/node-postgres/session.js:33`: drizzle pisa el
   parser de `pg` para `DATE` y devuelve el string crudo. El valor viaja como
   "2026-09-18" de Postgres al `<input type="date">` y de vuelta, sin pasar
   nunca por un `Date`. **Ésa es toda la razón por la que la agenda no necesita
   husos.**
3. **Vale al revés, y es la trampa de este diseño:** convertir esa fecha a
   `Date` para formatearla la ancla a medianoche UTC, y formateada en Buenos
   Aires —tres horas atrás— se muestra **un día antes**. Por eso `formatDia` y
   `formatMes` leen el string a mano en vez de pasar por `Intl`.
4. **Un evento de hoy cuenta como próximo hasta que el día termina.** Sin hora
   no se puede saber si ya pasó, y es lo que alguien espera al abrir la página
   la mañana de la cata. El corte compara contra `hoyEnArgentina()`, que ya
   existía para la cuenta corriente.
5. **El precio se borra con su columna.** Se pierden los cuatro importes
   sembrados; ninguno se publicaba.
6. **El seed one-off se actualiza, no se borra.** Cuesta cinco líneas y es el
   registro de dónde salieron esas cuatro filas.

## Fuera de alcance

- El botón **Reservar** sigue sin hacer nada, como hoy. Sólo pierde el precio.
- Los textos y la galería de `/eventos` son del CMS y no se tocan.
- Eventos que duran dos días o se repiten: siguen sin existir.

---

## Archivos

- **Modificar** `lib/db/schema.ts` — `comienza` a `date`, fuera `precioCentavos`.
- **Crear** `drizzle/0008_tense_newton_destine.sql` — generada y **editada a mano**.
- **Modificar** `lib/format.ts` — el borrado grande.
- **Modificar** `lib/eventos.ts` — se va la frontera de serialización.
- **Modificar** los cuatro archivos del panel, los dos de la tienda y el seed.
- **Modificar** `docs/ARQUITECTURA.md` — la sección de la agenda.

---

## Tarea 1: Schema y migración

- [x] **Paso 1**: importar `date`, poner
      `comienza: date("comienza", { mode: "string" })` y borrar
      `precioCentavos`. El índice `eventos_agenda_idx` queda igual.
- [x] **Paso 2**: `npm run db:generate` y **editar el SQL a mano**, como
      `0001_dos_roles.sql`. Drizzle emite el `ALTER` pelado y ése falla:
      `timestamptz` → `date` no tiene cast de asignación en Postgres. Va con
      `USING (... AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`.
      La zona no es decorativa: una cata de las 21:00 de Buenos Aires está
      guardada como 00:00 UTC **del día siguiente**, y el cast pelado en un
      servidor UTC la corre un día entero.
- [x] **Verificar**: comprobado en SQL, antes de migrar, que un instante de las
      21:30 de Buenos Aires da el 19 con el cast pelado y el 18 con el
      `AT TIME ZONE`. Después de migrar, los cuatro eventos quedaron en su día
      correcto y el índice sigue en pie.

## Tarea 2: `lib/format.ts` y `lib/eventos.ts`

- [x] **Paso 1**: `formatDia` y `formatMes` reciben el string y lo leen a mano,
      con una tabla `MESES`. Se borran `formatHora`, `desdeInputLocal`,
      `aInputLocal`, los tres `Intl.DateTimeFormat` de la agenda y las
      constantes `OFFSET_AR` / `OFFSET_MS`.
- [x] **Paso 2**: en `lib/eventos.ts` se borra el tipo `EventoGuardado` con su
      comentario, el `.map()` con `toISOString()` y el `new Date()` de
      `getAgenda`. El corte pasa a comparar strings contra `hoyEnArgentina()`.
- [x] **Verificar**: `npx tsc --noEmit` en verde, y `/eventos` leída tres veces
      seguidas —caché frío y caliente— devuelve exactamente lo mismo. Es justo
      lo que la frontera borrada existía para evitar.

## Tarea 3: Panel y tienda

- [x] **Paso 1**: `actions.ts` — `cuando` queda como string validado, sin
      `transform`. Se van el esquema `precio`, su campo en `leerFormulario` y
      los dos `precioCentavos:`.
- [x] **Paso 2**: el formulario pasa a `type="date"` y pierde el campo Precio;
      la ficha manda `evento.comienza` derecho; el listado corta con
      `hoyEnArgentina()` y pierde la columna Precio y el renglón de la hora.
- [x] **Paso 3**: en la tienda y en la home el `meta` queda `[lugar, detalle]`,
      y el botón dice `Reservar` a secas.
- [x] **Verificar**: con sesión, `/admin/eventos` lista sin columna Precio y con
      un evento de hoy en Próximos; la ficha trae
      `type="date" value="2026-09-01"` y cero apariciones de "precio";
      `/eventos` y `/` muestran el día y el mes correctos, sin hora ni precio.

## Tarea 4: Seed y documentación

- [x] **Paso 1**: `_eventos-seed.mjs` con fechas "AAAA-MM-DD", sin `pesos` ni
      `precio_centavos`. El dry-run matchea los cuatro por título + fecha.
- [x] **Paso 2**: `docs/ARQUITECTURA.md`, sección "La agenda de eventos".

---

## Migraciones

- [x] `npm run db:generate` — quedó en `drizzle/0008_tense_newton_destine.sql`.
- [x] **No es aditiva**: borra una columna y cambia el tipo de otra. La base es
      compartida entre worktrees, así que desde que se aplicó, `main` y los
      demás árboles rompen en las pantallas de eventos hasta que se mergee este
      PR. Es la razón por la que conviene cerrarlo rápido.

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] Probado en `:3007`
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar eventos-campos -borrarRama`

## Review

Salió como estaba planeado y sin sorpresas. El saldo es negativo en líneas: lo
único que suma código es la tabla `MESES`, y paga con creces las tres funciones
de huso que reemplaza.

Dos cosas que conviene recordar de acá:

- **El tipo de la columna resolvió un problema de diseño, no de tipos.** El
  comentario más largo de `lib/eventos.ts` era el del `unstable_cache` que
  serializa las `Date` a JSON. No se reescribió: **desapareció**, porque con la
  fecha ya siendo string no hay nada que serializar mal. Cuando un comentario
  largo explica cómo convivir con un problema, vale preguntarse si el problema
  se puede sacar de raíz.
- **Lo que quedó sin probar.** El POST de la Server Action no se pudo ejercitar
  con `curl`: el encoding RSC de `useActionState` no se reproduce a mano. La
  validación se comprobó aparte —el predicado del `refine` coincide con la
  realidad en los 744 días de un año bisiesto y uno normal, y rechaza
  `2026-02-31`, `2026-13-01` y `2026-09-18T19:30`— pero el submit del
  formulario en el navegador es lo único que falta ver con los ojos.
