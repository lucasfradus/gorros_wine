# Plan actual

> Este archivo tiene **el** plan en curso, no la lista de todo lo que existe.
> Al cerrar una iteración, su plan se archiva en `docs/planes/` y esto se vacía.
>
> Antes de tocar código: leer `AGENTS.md` (este Next.js y este Drizzle no son
> los del training data) y `tasks/lessons.md`.

**Logo y "mostrar en home" en Bodegas.**
Iteración chica: dos campos en un ABM que ya existe. Sin plan en `docs/planes/`.

Worktree `../Gorros-bodega-home` · rama `feat/bodega-home` · puerto `:3005`

- [x] **Schema** — `bodegas.logo` (`jsonb`) y `bodegas.mostrar_en_home`.
- [x] **Migraciones** — `0006` agrega las dos columnas, `0007` borra el viejo
      `logo_key`. Van separadas porque `drizzle-kit` pide un prompt interactivo
      si en el mismo diff se agrega una columna y se borra otra: no sabe si es
      un renombre, y sin TTY aborta.
- [x] **Action** — `esquemaImagen` para el logo, booleano para la bandera.
- [x] **Formulario** — `ImageField` compartido + el checkbox.
- [x] **Listado** — miniatura del logo y marca "en home".
- [x] **Verificación** — `tsc`, `build` y la subida real probada de punta a
      punta contra el bucket. Detalle abajo.
- [ ] **Cierre** — PR a `main` y `./scripts/worktree.ps1 borrar bodega-home
      -borrarRama`.

## Decisiones

- **El logo es `jsonb` con `ImagenValor`, no una key de texto.** Es la forma que
  ya usan el CMS y la agenda de eventos, y la única que trae el alto y el ancho:
  sin ellos `next/image` no puede reservar la caja y la maqueta salta al cargar.
  El `logo_key` que existía era anterior al gateway de imágenes y nunca se llegó
  a usar, así que se borró en vez de migrarlo.
- **`mostrar_en_home` está separado de `is_active`** porque es una decisión
  editorial: una bodega puede seguir activa —se le compra, tiene vinos
  publicados— sin ser una de las que van en la portada.
- **La franja de la home no se construye acá.** El campo se carga desde ahora
  para que el día que exista no arranque vacía. El formulario lo dice con todas
  las letras, para que nadie lo tilde esperando ver algo.

## Cómo se verificó

Con sesión real en `:3005`, por el camino sin JavaScript de las Server Actions:

- Subida real de una foto por `uploadMediaAction`: quedó
  `/media/img/a9b99b9c825da0d9.webp` (1200×800, 65 KB), con su fila en `media`,
  y la ruta la sirve con 200.
- El alta guarda el `jsonb` completo y la bandera.
- **Editar otro campo no borra el logo**: el formulario de edición trae el JSON
  en su input oculto y la bandera tildada.
- Un `src` a un dominio ajeno se rechaza: *"La imagen tiene que ser una ruta de
  este sitio"*.
- El listado muestra la miniatura y la marca "en home".

## Pendiente

- **`productos.imagen_key` sigue con la forma vieja** (texto con la key, sin
  usar). Cuando el catálogo sume su foto, conviene pasarlo a `jsonb` igual que
  éste, en vez de dejar dos formas conviviendo.

## Review

_(Al terminar: qué se hizo, qué quedó afuera, qué habría que mirar después.)_
