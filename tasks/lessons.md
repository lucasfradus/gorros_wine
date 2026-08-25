# Lecciones

Cada corrección del usuario se convierte acá en una regla. El formato es siempre
el mismo, y se lee al empezar una sesión.

```markdown
## Título corto de la regla

**Regla**: qué hacer (o no hacer), en imperativo y en una frase.

**Por qué**: qué pasó que hizo falta escribir esto. El caso concreto, con fecha.
Sin el porqué, la regla se discute de nuevo dentro de tres meses.

**Cómo aplicar**: los pasos concretos. Qué archivo, qué helper, qué chequear
antes de decidir.
```

Reglas para escribir una lección:

- Una regla por corrección. Si la corrección tocó dos temas, son dos lecciones.
- Se escribe **para el futuro**, no como crónica: "usar X" y no "me equivoqué con Y".
- Si la lección deja de valer porque el código cambió, se borra. Un archivo con
  reglas muertas no lo lee nadie.

---

## Nunca correr `npm run build` con el `dev` levantado

**Regla**: `next build` y `next dev` comparten la carpeta `.next` del worktree.
Antes de buildear, bajar el dev; y si ya pasó, borrar `.next` y volver a
levantarlo. Verificar el build en la misma carpeta donde hay un dev corriendo
rompe el dev, no el build.

**Por qué**: el 2026-08-25, al cerrar la iteración del catálogo se corrió
`npm run build` para verificar, con `npm run dev -- -p 3002` corriendo. El build
reescribió `.next` y el dev quedó sirviendo HTML que apuntaba a chunks que ya no
existían: `/_next/static/css/app/layout.css` daba **404** y el panel se veía sin
un solo estilo. Parecía un CSS roto y no lo era — el módulo compilaba perfecto.
El usuario lo vio como "desaparecieron los estilos".

**Cómo aplicar**: si hay un dev corriendo en el worktree, bajarlo antes de
buildear. El síntoma que identifica este caso, y lo distingue de un error de
CSS: la página trae el `<link rel="stylesheet">` correcto pero ese archivo
responde 404. Se arregla bajando el dev, `rm -rf .next` y levantándolo de nuevo
— nunca tocando el CSS. Ojo también con bajarlo: matar el `npm run` puede dejar
vivo el `node` hijo y el puerto ocupado; se confirma con
`Get-NetTCPConnection -LocalPort <puerto>`.

## Antes de planificar, mirar qué están haciendo los otros worktrees

**Regla**: al escribir el plan de una iteración, correr `git worktree list` y
revisar el `tasks/todo.md` y el `git status` de cada worktree vivo. Lo que otra
rama ya está construyendo no se vuelve a construir: se espera, o se levanta a
`main` primero.

**Por qué**: el 2026-08-25, el plan de `feat/admin-catalogo` incluía crear un
bucket de Railway, un cliente de S3, una ruta que sirviera las imágenes y un
campo de subida. Recién al aplicar la migración se vio que la base tenía tablas
`content` y `media` que no estaban en el schema de la rama: `feat/cms-contenido`
ya tenía todo eso resuelto y sin commitear, y mejor —`aws4fetch` de 6 KB en vez
del SDK de AWS, y la key como hash del contenido, que hace correcto el caché
inmutable—. Hubo que frenar y replanificar con el usuario a mitad de la
iteración. La pista estaba a la vista desde el principio: la base es compartida.

**Cómo aplicar**: en la fase de investigación del plan, además de leer el código
de `main`, correr `git worktree list` y para cada hermano mirar `tasks/todo.md`
(dice qué está en curso) y `git status --short` (dice qué hay sin commitear, que
no aparece en ningún diff). Si algo se pisa, es una pregunta para el usuario
antes de escribir el plan, no un descubrimiento a mitad de camino. Ojo especial
con lo transversal: storage, subida de archivos, autenticación, tokens de estilo
y `nav-links.tsx`.

## El fondo de un icono se decide por destino, no de una vez

**Regla**: al generar iconos de marca, elegir el fondo archivo por archivo. El
favicon (`app/icon.svg`, `app/favicon.ico`) va **calado**; el apple-touch-icon y
los iconos de la PWA van **opacos**. No hay un fondo "del set".

**Por qué**: el 2026-08-24, al meter el isologo real, se generaron los seis
iconos con tile negro. En una pestaña clara eso se lee como un bloque oscuro y
no como la marca, y el usuario lo marcó. El tile venía heredado del `icon.svg`
anterior — que era un gorro inventado, es decir, justamente lo que se estaba
tirando. Se arrastró una decisión del placeholder que se venía a reemplazar.

**Cómo aplicar**: antes de fijar el fondo, preguntarse quién compone la imagen.
La pestaña ya tiene fondo propio y cambia con el tema del sistema: ahí el icono
va calado. iOS compone el apple-touch-icon sobre negro y un launcher con la
marca calada queda roto: ahí va opaco. Y con el fondo cambia el aire — calado
conviene grande (no hay tile que dé presencia), sobre tile conviene chico.
En `scripts/_isotipo.mjs` eso es el parámetro `fondo` de `icono()`.
Al reemplazar un placeholder, revisar qué de lo suyo se está copiando sin mirar.
