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
