# Panel formal — Plan

> **Para quien lo ejecute**: este plan es autocontenido. Todo el contexto
> necesario está acá; no hace falta releer la conversación donde se decidió.
> Antes de tocar código, leer `AGENTS.md` y `tasks/lessons.md`.
> Los pasos van con checkbox (`- [ ]`) y se marcan a medida que avanzan.

**Objetivo:** el panel deja de verse como la tienda (negro, dorado, serif,
mayúsculas espaciadas) y pasa a ser un backoffice sobrio, con un lenguaje de
diseño que también funciona en el teléfono y sirve de base para todo lo que
venga.

**Enfoque:** casi todo el panel sale de `admin.module.css` y de los tokens que
define `.themed`. Se reescriben los tokens (con nombres semánticos), la
tipografía y los componentes compartidos, y el marco gana una barra superior y
un menú lateral para mobile. Las tablas se apilan como filas de lista en
pantallas angostas con un `data-label` por celda. Las páginas no cambian de
estructura.

**Worktree:** `../Gorros-panel-formal` · rama `feat/panel-formal` · puerto `:3002`

**Mockup de referencia:** https://claude.ai/artifact/G5PZ2NSGkabCq5wL6eXMcr
(pantalla de escritorio, paletas, y tres pantallas mobile: listado, menú,
formulario).

---

## Contexto

El panel hereda la estética de la tienda: tokens negro + dorado, Fraunces en
los títulos y rótulos en mayúsculas con 0.18em de tracking. Para una
herramienta de trabajo se siente "puesta en escena". En mobile, el sidebar se
convierte en una tira de links que envuelve en varias filas, las tablas sólo
scrollean de costado, y los campos de 15px hacen que iOS haga zoom al tocarlos.

## Mapa del código actual

| Qué | Dónde |
| --- | --- |
| Tokens del panel (`light-dark()`), marco, tabla, form, botones, badges | [app/(admin)/admin/admin.module.css](../../app/(admin)/admin/admin.module.css) |
| Marco del panel (sidebar, main) | [app/(admin)/admin/(panel)/layout.tsx](../../app/(admin)/admin/(panel)/layout.tsx) |
| Ítems del menú | [app/(admin)/admin/(panel)/nav-links.tsx](../../app/(admin)/admin/(panel)/nav-links.tsx) |
| Selector de modo | [app/(admin)/admin/theme-switch.tsx](../../app/(admin)/admin/theme-switch.tsx) |
| Layout del área admin (fuentes van acá) | [app/(admin)/layout.tsx](../../app/(admin)/layout.tsx) |
| CSS propios de sección | `clientes/`, `contenido/`, `facturacion/`, `eventos/` `*.module.css` e `image-field.module.css` |
| Las 11 tablas | bodegas, categorias, clientes, clientes/[id], eventos, facturacion, facturacion/comprobantes, facturacion/[id], productos, usuarios, varietales (`page.tsx`) |
| Reglas globales que pisan al panel | `h1,h2,h3 { font-family: Fraunces }` y `:focus-visible` dorado en [app/globals.css](../../app/globals.css) |

## Decisiones ya tomadas (NO volver a preguntar)

1. **Paleta Grafito**: grises neutros y un único acento casi negro
   (`#18181b` en claro, `#f4f4f5` en oscuro). Verde, ámbar y rojo sólo para
   estados.
2. **Tipografía Inter** en todo el panel (incluida la pantalla de ingreso),
   cargada con `next/font` sólo en `app/(admin)/layout.tsx`: la tienda no la
   descarga. Títulos en sans semibold; rótulos en minúscula normal, sin
   tracking.
3. **Se conservan** el modo claro/oscuro/sistema con `light-dark()` y la
   resolución en el servidor; y el isotipo rojo en el login como única marca.
4. **Tokens con nombres semánticos** dentro de `.themed`: `--bg`, `--surface`,
   `--accent`, `--on-accent`, etc. Se renombran en todos los CSS del panel; no
   quedan referencias a `--gold`, `--night`, `--panel`, `--red` ni a
   `--font-fraunces` bajo `app/(admin)`. Motivo: si un CSS del panel nombra un
   token de la tienda que `.themed` no redefine, hereda el dorado del `:root`
   sin avisar.
5. **Mobile**: barra superior (botón de menú + marca), menú como panel lateral
   que se cierra al navegar, con Escape y tocando afuera. Targets de 44px,
   campos a 16px, botonera de formulario fija abajo.
6. **Tablas en mobile → filas de lista** (≤ 640px): la primera celda es el
   título de la fila; el resto se muestra con su rótulo vía `data-label`.
7. Facturación ya está en `main` (PR #16): no hay coordinación en paralelo.

## Fuera de alcance

- La tienda pública: ni un token, ni una fuente.
- Reordenar contenido de páginas, iconos en el menú, dashboard con métricas.
- Acciones de página en la barra superior mobile (el "+" del mockup): exige que
  cada página exporte su acción. Queda para una iteración siguiente.

---

## Archivos

- **Crear** `app/(admin)/admin/(panel)/panel-shell.tsx` — cliente; estado
  abierto/cerrado del menú mobile, barra superior, velo.
- **Modificar** `admin.module.css` — tokens, tipografía, componentes, mobile.
- **Modificar** `(panel)/layout.tsx` — usa `PanelShell`.
- **Modificar** `app/(admin)/layout.tsx` — carga Inter.
- **Modificar** los 5 CSS de sección — tokens renombrados, sin mayúsculas ni serif.
- **Modificar** las 11 tablas — `data-label` en cada `<td>` salvo la primera.

---

## Tarea 1: Tokens y tipografía

- [x] Reescribir `.themed` con la paleta Grafito y nombres semánticos.
- [x] Inter vía `next/font` en `app/(admin)/layout.tsx`; `.themed` la usa y
      anula Fraunces en `h1–h3`; `:focus-visible` con el acento.
- [x] Renombrar tokens en los 5 CSS de sección; `grep` sin restos.
- [x] **Verificar**: `npx tsc --noEmit`; login y un listado en claro y oscuro.

## Tarea 2: Componentes compartidos

- [x] Botones, campos (16px, 40px de alto), rótulos, badges con fondo suave,
      tarjetas, tabla (cabecera gris, filas compactas), avisos, chips.
- [x] **Verificar**: productos, cliente con extracto, contenido, facturación.

## Tarea 3: Marco y menú mobile

- [x] `panel-shell.tsx` + sidebar nuevo (marca, secciones, pie con usuario,
      salir y modo).
- [x] Mobile: barra superior, panel lateral, cierre al navegar / Escape /
      velo; cerrado no entra en el orden de tabulación.
- [x] **Verificar**: a 390px, abrir, navegar, cerrar con teclado.

## Tarea 4: Tablas y formularios en mobile

- [x] `data-label` en las 11 tablas.
- [x] CSS de filas apiladas ≤ 640px; botonera de formulario fija abajo.
- [x] **Verificar**: a 390px, cada listado sin scroll horizontal.

---

## Cierre

- [x] `npx tsc --noEmit`
- [x] `npm run build` (con el dev bajado — ver `tasks/lessons.md`)
- [x] Probado a mano en `:3002`, escritorio y 390px, claro y oscuro
- [ ] PR mergeado a `main`
- [ ] `./scripts/worktree.ps1 borrar panel-formal -borrarRama`

## Review

**Hecho.** Tokens Grafito semánticos en `.themed`, Inter sólo en el área
admin, componentes compartidos reescritos, marco nuevo con `PanelShell` (menú
lateral en ≤ 860px que se cierra al navegar, con Escape y con el velo; el foco
entra y vuelve), las 11 tablas apiladas en ≤ 640px con `data-label`, botonera
de formulario fija en mobile. Probado con el navegador en escritorio (1440) y
390px, claro y oscuro: login, inicio, usuarios, productos, contenido,
facturación, cliente nuevo. `tsc` y `build` en verde.

**Cambió respecto del plan:**
- Facturación ya estaba mergeada cuando se abrió el worktree, así que sus tres
  tablas y su CSS entraron en el mismo pase.
- Tres arreglos que salieron recién al verlo andando: la celda de acciones
  (Editar) se va al borde derecho en la fila apilada; un `.btn` dentro de un
  `.field` ya no se estira a todo el ancho (pasaba desde antes con "Actualizar"
  de la cotización); los links sueltos en un texto tenían el azul del
  navegador y ahora toman la tinta del panel.
- `.badgeOff` pasó de rojo a gris: marca "apagado" (inactivo, archivado, sin
  publicar), no un error.

**Pendiente:**
- La base local no tiene productos, bodegas ni clientes: las tablas con más
  columnas (productos, extracto de cliente, facturación) se vieron sólo en
  estructura, no con filas reales. Mirarlas con datos antes de dar por cerrado
  el mobile de esas pantallas.
- Para probar se creó en la base local el admin `qa-panel@local.test`. Borrarlo
  desde Usuarios (o dejarlo para la próxima prueba visual).
- El "+" de acción principal en la barra superior mobile (ver Fuera de alcance).
