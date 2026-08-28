import type { Grupo, ValoresDeGrupo } from "./types";

/**
 * El registro: qué se puede editar del sitio y qué dice hoy.
 *
 * Es el único archivo que hay que tocar para sumar un campo al CMS. De acá
 * salen tres cosas a la vez: el formulario del panel (se genera recorriendo
 * los grupos), los tipos que devuelve `getContent()`, y el **texto original**
 * de cada campo.
 *
 * Que los originales vivan acá y no en un seed de la base es la decisión que
 * sostiene todo lo demás: con `content` vacío el sitio se ve exactamente como
 * se ve hoy, un deploy nuevo no arranca en blanco, y "restaurar el original"
 * es borrar una fila y no acordarse de qué decía antes.
 *
 * Convención de formato en los textos, la misma en todo el CMS:
 *   - `*texto*`   → acento dorado
 *   - `**texto**` → destacado
 *   - en los campos `parrafo`, cada salto de línea es un renglón
 * La renderiza `components/rich-text.tsx`.
 */
export const REGISTRO = {
  sitio: {
    label: "Sitio y SEO",
    help: "El título y la descripción con los que el sitio aparece en Google y al compartirlo por WhatsApp.",
    revalidate: ["/"],
    afectaTodo: true,
    campos: {
      titulo: {
        tipo: "texto",
        label: "Título del sitio",
        help: "Sale en la pestaña del navegador y como título en Google.",
        original: "Gorros Wine — Vinoteca boutique en Pilar",
      },
      descripcion: {
        tipo: "parrafo",
        label: "Descripción",
        help: "El párrafo que Google muestra debajo del título. Entre 120 y 160 caracteres.",
        original:
          "Selección curada de tintos, blancos y espumantes. Comprá online con retiro en el local o envío a domicilio en Pilar y zona.",
      },
      imagenCompartir: {
        tipo: "imagen",
        label: "Imagen al compartir",
        help: "La que se ve en la tarjeta cuando alguien pega el link en WhatsApp o Instagram. Ideal 1200×800.",
        original: {
          src: "/hero-home.webp",
          alt: "La cava de Gorros Wine",
          width: 1200,
          height: 800,
        },
      },
    },
  },

  local: {
    label: "Datos del local",
    help: "Teléfono, mail, dirección y horarios. Se usan en el footer, en los botones de WhatsApp y en las legales.",
    revalidate: ["/"],
    afectaTodo: true,
    campos: {
      whatsapp: {
        tipo: "texto",
        label: "WhatsApp",
        help: "En formato internacional, sin + ni espacios ni guiones. Ej: 5491122334455.",
        original: "5491100000000",
      },
      email: {
        tipo: "texto",
        label: "Mail de contacto",
        original: "hola@gorroswine.com",
      },
      instagram: {
        tipo: "texto",
        label: "Usuario de Instagram",
        help: "Sin la arroba.",
        original: "gorroswine",
      },
      direccion: {
        tipo: "texto",
        label: "Dirección",
        original: "Pilar, Buenos Aires",
      },
      horarios: {
        tipo: "texto",
        label: "Horarios",
        original: "Lun a Sáb · 10 a 21 hs",
      },
    },
  },

  home: {
    label: "Home",
    help: "La portada: hero, beneficios, banda del Club, eventos, quiénes somos, bodegas, reseñas y cómo comprar.",
    revalidate: ["/"],
    campos: {
      heroEyebrow: {
        tipo: "texto",
        label: "Hero · volanta",
        help: "La línea chica en mayúsculas arriba del título.",
        original: "Vinoteca · Pilar, Buenos Aires",
      },
      heroTitulo: {
        tipo: "parrafo",
        label: "Hero · título",
        help: "Cada salto de línea es un renglón. Lo que va entre *asteriscos* sale en bastardilla dorada.",
        original: "No solo vendemos vinos,\n*creamos experiencias.*",
      },
      heroCta: {
        tipo: "texto",
        label: "Hero · texto del botón",
        original: "Ver catálogo",
      },
      heroImagen: {
        tipo: "imagen",
        label: "Hero · foto",
        help: "La foto grande de la portada. Apaisada, ideal 1600 px de ancho o más.",
        original: {
          src: "/hero-home.webp",
          alt: "La cava de Gorros Wine",
          width: null,
          height: null,
        },
      },

      beneficios: {
        tipo: "lista",
        label: "Beneficios",
        help: "La fila de tres que va justo debajo del hero.",
        titulo: "label",
        min: 2,
        max: 4,
        item: {
          label: { tipo: "texto", label: "Título", original: "" },
          body: { tipo: "texto", label: "Texto", original: "" },
        },
        original: [
          {
            label: "Envíos",
            body: "Pilar y zona · coordinás día y horario",
          },
          {
            label: "Retiro en el local",
            body: "Reservás online, pagás al retirar",
          },
          { label: "Club Gorros", body: "3 etiquetas curadas por mes" },
        ],
      },

      clubEyebrow: {
        tipo: "texto",
        label: "Club · volanta",
        original: "Club Gorros",
      },
      clubTitulo: {
        tipo: "parrafo",
        label: "Club · título",
        original: "Tres etiquetas elegidas para vos, cada mes.",
      },
      clubLede: {
        tipo: "parrafo",
        label: "Club · bajada",
        original:
          "Curaduría mensual con notas de cata y maridajes, precios de socio y acceso prioritario a las catas.",
      },
      clubCta: {
        tipo: "texto",
        label: "Club · texto del botón",
        original: "Sumarme al club",
      },
      clubFondo: {
        tipo: "imagen",
        label: "Club · foto de fondo",
        help: "La foto detrás de la banda del Club. Va a sangre y con un velo oscuro encima para que se lea el texto, así que conviene una apaisada, sin letras y sin nada importante en el centro. Sin foto, queda la trama del diseño.",
        original: null,
      },

      eventosEyebrow: {
        tipo: "texto",
        label: "Eventos · volanta",
        original: "Eventos",
      },
      eventosTitulo: {
        tipo: "parrafo",
        label: "Eventos · título",
        original: "Se toma, se aprende, se comparte",
      },
      eventosLede: {
        tipo: "parrafo",
        label: "Eventos · bajada",
        original:
          "Todos los meses organizamos catas y encuentros en el local. Así se vive Gorros Wine.",
      },
      eventosGaleria: {
        tipo: "lista",
        label: "Eventos · galería",
        help: "Fotos de encuentros que ya pasaron. Sin foto cargada queda el hueco rayado del diseño.",
        titulo: "epigrafe",
        min: 0,
        max: 4,
        item: {
          imagen: { tipo: "imagen", label: "Foto", original: null },
          epigrafe: {
            tipo: "texto",
            label: "Epígrafe",
            help: "Qué evento fue y cuándo.",
            original: "",
          },
        },
        original: [
          { imagen: null, epigrafe: "Cata a ciegas de Malbecs · Junio 2026" },
          { imagen: null, epigrafe: "Espumantes & quesos · Mayo 2026" },
        ],
      },

      nosotrosEyebrow: {
        tipo: "texto",
        label: "Nosotros · volanta",
        original: "Acerca de nosotros",
      },
      nosotrosTitulo: {
        tipo: "parrafo",
        label: "Nosotros · título",
        help: "Cada salto de línea es un renglón.",
        original: "Un lugar donde el vino\nse vive y se comparte",
      },
      nosotrosBody: {
        tipo: "parrafo",
        label: "Nosotros · texto",
        original:
          "Gorros Wine nació de la pasión de Gonzalo y Agustina por el mundo del vino, y del deseo de crear un espacio donde cada cliente encuentre mucho más que una botella: encuentros, celebraciones y momentos inolvidables.",
      },
      nosotrosLink: {
        tipo: "texto",
        label: "Nosotros · texto del enlace",
        original: "Conocé nuestra historia",
      },
      nosotrosImagen: {
        tipo: "imagen",
        label: "Nosotros · foto",
        help: "Foto del local o del equipo.",
        original: null,
      },

      bodegasEyebrow: {
        tipo: "texto",
        label: "Bodegas · volanta",
        original: "Nuestras bodegas",
      },
      bodegasTitulo: {
        tipo: "parrafo",
        label: "Bodegas · título",
        help: "Cada salto de línea es un renglón.",
        original: "Las bodegas con las que trabajamos",
      },
      bodegasLede: {
        tipo: "parrafo",
        label: "Bodegas · bajada",
        help: "Qué bodegas se muestran no se elige acá: se tilda «mostrar en el home» en cada una, en Bodegas.",
        original:
          "Trabajamos con productores que elegimos uno por uno. Tocá un logo para conocer la bodega.",
      },

      resenasEyebrow: {
        tipo: "texto",
        label: "Reseñas · volanta",
        original: "Lo que dicen",
      },
      resenasTitulo: {
        tipo: "parrafo",
        label: "Reseñas · título",
        original: "Clientes de Gorros",
      },
      resenas: {
        tipo: "lista",
        label: "Reseñas",
        help: "Las tres tarjetas con comentarios de clientes.",
        titulo: "name",
        min: 1,
        max: 6,
        item: {
          quote: { tipo: "parrafo", label: "Comentario", original: "" },
          name: { tipo: "texto", label: "Nombre", original: "" },
          tag: {
            tipo: "texto",
            label: "De dónde viene",
            help: "Ej: Compra online, Socio del Club, Evento.",
            original: "",
          },
        },
        original: [
          {
            quote:
              "Me asesoraron por WhatsApp y clavé el vino perfecto para un regalo. Llegó a Pilar en el día.",
            name: "Sofía R.",
            tag: "Compra online",
          },
          {
            quote:
              "El club es un lujo: todos los meses descubro algo nuevo y siempre le pegan a mi gusto.",
            name: "Martín A.",
            tag: "Socio del Club",
          },
          {
            quote:
              "Fui a una cata y volví con tres botellas. Gente que sabe y que te lo explica sin poses.",
            name: "Lucía M.",
            tag: "Evento",
          },
        ],
      },

      comoTitulo: {
        tipo: "parrafo",
        label: "Cómo comprar · título",
        original: "Comprar es fácil",
      },
      pasos: {
        tipo: "lista",
        label: "Cómo comprar · pasos",
        help: "Los números (01, 02, 03) salen solos del orden: no hace falta escribirlos.",
        titulo: "title",
        min: 2,
        max: 4,
        item: {
          title: { tipo: "texto", label: "Título", original: "" },
          body: { tipo: "parrafo", label: "Texto", original: "" },
        },
        original: [
          {
            title: "Elegís",
            body: "Navegás el catálogo y sumás tus etiquetas al carrito.",
          },
          {
            title: "Envío o retiro",
            body: "Recibís en Pilar y zona, o reservás y retirás en el local.",
          },
          {
            title: "Pagás",
            body: "Online o al retirar. Tarjeta, transferencia o efectivo.",
          },
        ],
      },
    },
  },

  nosotros: {
    label: "Nosotros",
    help: "La página /nosotros: la historia, los valores y el cierre.",
    revalidate: ["/nosotros"],
    campos: {
      eyebrow: { tipo: "texto", label: "Volanta", original: "Nosotros" },
      titulo: {
        tipo: "parrafo",
        label: "Título",
        help: "Cada salto de línea es un renglón. Lo que va entre *asteriscos* sale en bastardilla dorada.",
        original: "El vino se vive,\nse comparte\ny se *disfruta.*",
      },
      cuerpo: {
        tipo: "parrafo",
        label: "La historia",
        help: "Una línea en blanco separa párrafos. **Así** se destaca, y *así* sale en dorado.",
        original:
          "Gorros Wine nació de la pasión de **Gonzalo y Agustina** por el mundo del vino, y del deseo de crear un espacio donde cada cliente encuentre mucho más que una botella.\n\nCon una cuidada selección de etiquetas de las principales bodegas argentinas e internacionales, buscamos acercar vinos que inspiren encuentros, celebraciones y momentos inolvidables.\n\nCreemos en el asesoramiento personalizado, en descubrir las historias detrás de cada etiqueta y en compartir la cultura del vino a través de degustaciones, experiencias exclusivas y nuestra feria *Caminos del Vino*.",
      },
      imagen: {
        tipo: "imagen",
        label: "Foto",
        help: "Foto del local, o de Gonzalo y Agustina.",
        original: null,
      },
      valores: {
        tipo: "lista",
        label: "Valores",
        help: "La fila de tres debajo de la historia.",
        titulo: "title",
        min: 2,
        max: 4,
        item: {
          title: { tipo: "texto", label: "Título", original: "" },
          body: { tipo: "parrafo", label: "Texto", original: "" },
        },
        original: [
          {
            title: "Asesoramiento",
            body: "Te acompañamos a encontrar el vino justo para cada ocasión, sin poses.",
          },
          {
            title: "Selección curada",
            body: "Etiquetas de las principales bodegas argentinas e internacionales.",
          },
          {
            title: "Experiencias",
            body: "Degustaciones, encuentros exclusivos y nuestra feria Caminos del Vino.",
          },
        ],
      },
      cierreEyebrow: {
        tipo: "texto",
        label: "Cierre · volanta",
        original: "Bienvenidos a Gorros Wine",
      },
      cierreTitulo: {
        tipo: "parrafo",
        label: "Cierre · título",
        original: "No solo vendemos vinos, *creamos experiencias.*",
      },
      cierreSub: {
        tipo: "texto",
        label: "Cierre · subtítulo",
        original: "Viví tu experiencia Gorros Wine",
      },
      cierreCta: {
        tipo: "texto",
        label: "Cierre · texto del botón",
        original: "Explorar el catálogo",
      },
      seoTitulo: {
        tipo: "texto",
        label: "SEO · título",
        help: 'Se le agrega " · Gorros Wine" al final automáticamente.',
        original: "Nosotros",
      },
      seoDescripcion: {
        tipo: "parrafo",
        label: "SEO · descripción",
        original:
          "Gorros Wine nació de la pasión de Gonzalo y Agustina por el mundo del vino. Vinoteca en Pilar, Buenos Aires.",
      },
    },
  },

  club: {
    label: "Club Gorros",
    help: "La página /club: la membresía, qué incluye y cómo funciona.",
    revalidate: ["/club"],
    campos: {
      eyebrow: { tipo: "texto", label: "Volanta", original: "Club Gorros" },
      titulo: {
        tipo: "parrafo",
        label: "Título",
        help: "Lo que va entre *asteriscos* sale en bastardilla dorada.",
        original: "Una membresía para quienes *viven* el vino.",
      },
      lede: {
        tipo: "parrafo",
        label: "Bajada",
        original:
          "Tres etiquetas seleccionadas cada mes, precios de socio y acceso prioritario a las catas. Cancelás cuando quieras, sin permanencia.",
      },
      cta: {
        tipo: "texto",
        label: "Texto del botón",
        original: "Sumarme al club",
      },
      waMensaje: {
        tipo: "texto",
        label: "Mensaje de WhatsApp",
        help: "El texto que aparece ya escrito cuando alguien toca el botón.",
        original: "Hola! Quiero sumarme al Club Gorros.",
      },
      incluye: {
        tipo: "lista",
        label: "Qué incluye",
        titulo: "title",
        min: 2,
        max: 5,
        item: {
          title: { tipo: "texto", label: "Título", original: "" },
          body: { tipo: "parrafo", label: "Texto", original: "" },
        },
        original: [
          {
            title: "Tres etiquetas por mes",
            body: "Una selección armada por nosotros, con notas de cata y maridajes para cada botella.",
          },
          {
            title: "Precios de socio",
            body: "Descuento sobre todo el catálogo, todo el año, también fuera de la caja mensual.",
          },
          {
            title: "Catas primero",
            body: "Acceso prioritario a los encuentros del local y lugares reservados antes de la venta general.",
          },
        ],
      },
      comoTitulo: {
        tipo: "parrafo",
        label: "Cómo funciona · título",
        original: "Cómo funciona",
      },
      pasos: {
        tipo: "lista",
        label: "Cómo funciona · pasos",
        help: "Los números salen solos del orden: no hace falta escribirlos.",
        titulo: "title",
        min: 2,
        max: 4,
        item: {
          title: { tipo: "texto", label: "Título", original: "" },
          body: { tipo: "parrafo", label: "Texto", original: "" },
        },
        original: [
          {
            title: "Te sumás",
            body: "Nos escribís y armamos tu perfil de gusto.",
          },
          {
            title: "Recibís",
            body: "Todos los meses preparamos tu caja: la retirás o te la llevamos.",
          },
          {
            title: "Descubrís",
            body: "Probás, nos contás, y afinamos la selección del mes siguiente.",
          },
        ],
      },
      cierreTitulo: {
        tipo: "parrafo",
        label: "Cierre · título",
        original:
          "¿Lo querés de regalo? También armamos membresías para regalar.",
      },
      cierreCta: {
        tipo: "texto",
        label: "Cierre · texto del botón",
        original: "Escribinos",
      },
      seoTitulo: {
        tipo: "texto",
        label: "SEO · título",
        original: "Club Gorros",
      },
      seoDescripcion: {
        tipo: "parrafo",
        label: "SEO · descripción",
        original:
          "Tres etiquetas seleccionadas cada mes, precios de socio y acceso prioritario a las catas. Sin permanencia.",
      },
    },
  },

  eventos: {
    label: "Eventos",
    help: "El texto y las fotos que rodean a la agenda de /eventos. Las catas en sí se cargan en la sección Eventos del panel.",
    revalidate: ["/eventos"],
    campos: {
      eyebrow: { tipo: "texto", label: "Volanta", original: "Eventos" },
      titulo: {
        tipo: "parrafo",
        label: "Título",
        original: "Catas y encuentros",
      },
      lede: {
        tipo: "parrafo",
        label: "Bajada",
        original:
          "Vení a probar, aprender y compartir. Cupos limitados — reservás online y pagás en el local.",
      },
      galeria: {
        tipo: "lista",
        label: "Galería",
        help: "Fotos de encuentros que ya pasaron. Sin foto cargada queda el hueco rayado del diseño.",
        min: 0,
        max: 6,
        item: {
          imagen: { tipo: "imagen", label: "Foto", original: null },
        },
        original: [{ imagen: null }, { imagen: null }],
      },
      sinEventos: {
        tipo: "parrafo",
        label: "Sin fechas · aviso",
        help: "Lo que se lee cuando no hay ningún evento publicado por venir. Se ve en /eventos y reemplaza a la lista.",
        original:
          "Por ahora no tenemos fechas abiertas. Escribinos y te avisamos cuando salga la próxima.",
      },
      pasadosTitulo: {
        tipo: "texto",
        label: "Pasados · título",
        help: "El encabezado de la lista de encuentros que ya ocurrieron.",
        original: "Ya pasaron",
      },
      feriaEyebrow: {
        tipo: "texto",
        label: "Feria · volanta",
        original: "Caminos del Vino",
      },
      feriaTitulo: {
        tipo: "parrafo",
        label: "Feria · título",
        original: "Nuestra feria del vino",
      },
      feriaBody: {
        tipo: "parrafo",
        label: "Feria · texto",
        original:
          "Un encuentro con bodegas invitadas, degustaciones abiertas y las historias detrás de cada etiqueta.",
      },
      feriaCta: {
        tipo: "texto",
        label: "Feria · texto del botón",
        original: "Más información",
      },
      privadaTitulo: {
        tipo: "parrafo",
        label: "Cata privada · título",
        original: "¿Armamos una cata privada?",
      },
      privadaBody: {
        tipo: "parrafo",
        label: "Cata privada · texto",
        original:
          "Cumpleaños, empresas o con amigos. La organizamos a tu medida.",
      },
      privadaCta: {
        tipo: "texto",
        label: "Cata privada · texto del botón",
        original: "Escribinos",
      },
      seoTitulo: {
        tipo: "texto",
        label: "SEO · título",
        original: "Eventos",
      },
      seoDescripcion: {
        tipo: "parrafo",
        label: "SEO · descripción",
        original:
          "Catas y encuentros en Gorros Wine, Pilar. Cupos limitados: reservás online y pagás en el local.",
      },
    },
  },

  footer: {
    label: "Pie de página",
    help: "El bloque de abajo de todo, que se repite en todas las pantallas.",
    revalidate: ["/"],
    afectaTodo: true,
    campos: {
      blurb: {
        tipo: "parrafo",
        label: "Texto bajo la marca",
        original:
          "Vinoteca en Pilar, Buenos Aires. Etiquetas de las principales bodegas argentinas e internacionales.",
      },
      tiendaTitulo: {
        tipo: "texto",
        label: "Título de la columna de tienda",
        original: "Tienda",
      },
      contactoTitulo: {
        tipo: "texto",
        label: "Título de la columna de contacto",
        original: "Contacto",
      },
      newsletterTitulo: {
        tipo: "texto",
        label: "Título de la columna de newsletter",
        original: "Newsletter",
      },
      newsletterBlurb: {
        tipo: "texto",
        label: "Texto del newsletter",
        original: "Novedades y ofertas.",
      },
      legal: {
        tipo: "parrafo",
        label: "Línea legal",
        help: "La advertencia del final. Es obligatoria: no la saques.",
        original:
          "© 2026 Gorros Wine · Beber con moderación. Prohibida su venta a menores de 18 años.",
      },
    },
  },

  edad: {
    label: "Verificación de edad",
    help: "La pantalla que ve quien entra por primera vez, antes de acceder al sitio.",
    revalidate: ["/"],
    afectaTodo: true,
    campos: {
      eyebrow: {
        tipo: "texto",
        label: "Volanta",
        original: "Verificación de edad",
      },
      titulo: {
        tipo: "parrafo",
        label: "Título",
        original:
          "La venta de bebidas alcohólicas está prohibida para menores de 18 años.",
      },
      body: {
        tipo: "parrafo",
        label: "Texto",
        original:
          "Para ingresar al sitio, confirmá que tenés la edad legal para consumir alcohol en Argentina.",
      },
      cta: {
        tipo: "texto",
        label: "Texto del botón",
        original: "Soy mayor de 18 años",
      },
      pie: {
        tipo: "texto",
        label: "Pie",
        original: "Beber con moderación",
      },
    },
  },

  legalesPrivacidad: {
    label: "Política de privacidad",
    help: "La página /privacidad. Ojo: es un texto legal — conviene que lo revise un asesor antes de publicarlo.",
    revalidate: ["/privacidad"],
    campos: {
      titulo: {
        tipo: "texto",
        label: "Título",
        original: "Política de privacidad",
      },
      actualizado: {
        tipo: "texto",
        label: "Última actualización",
        help: "Se muestra como \"Última actualización: …\". Actualizala cada vez que cambies el texto.",
        original: "julio de 2026",
      },
      aviso: {
        tipo: "parrafo",
        label: "Aviso de borrador",
        help: "El recuadro de arriba. Dejalo vacío para que no se muestre — es lo que hay que hacer cuando el texto ya esté revisado.",
        original:
          "**Borrador.** Este texto es una base genérica y todavía no fue revisado por un asesor legal. Antes de publicar el sitio hay que validarlo y completar los datos de la razón social.",
      },
      cuerpo: {
        tipo: "rico",
        label: "Texto",
        help: "`## ` para un subtítulo, `- ` para una viñeta, `**negrita**`, `[texto](destino)` para un enlace. Entre llaves se completan solos los datos del local: {direccion}, {horarios}, {email}, {instagram}, {whatsapp}.",
        original: `## Qué datos guardamos

- **Para tu pedido:** nombre, teléfono, dirección de entrega y correo electrónico.
- **Si te suscribís al newsletter:** tu correo electrónico.
- **En tu navegador:** el carrito y la confirmación de edad se guardan sólo en tu dispositivo, no en nuestros servidores.

## Para qué los usamos

Para preparar y entregar tus pedidos, responder tus consultas y —si nos diste el consentimiento— enviarte novedades. No usamos tus datos para otra cosa.

## Con quién los compartimos

Sólo con quienes necesitamos para cumplir el pedido: el servicio de entrega y el medio de pago. No vendemos ni cedemos tus datos a terceros con fines publicitarios.

## Cuánto tiempo los conservamos

Los datos de compra se conservan mientras sean necesarios para cumplir obligaciones contables e impositivas. Los del newsletter, hasta que te des de baja.

## Tus derechos

Podés pedir acceder, rectificar o suprimir tus datos escribiendo a [{email}](mailto:{email}). La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias por incumplimiento.

El titular de los datos puede solicitar el retiro o bloqueo de su nombre de nuestras bases de datos conforme al artículo 27, inciso 3 de la Ley 25.326.

## Cookies

Hoy el sitio no usa cookies de terceros ni de analítica. Si eso cambia, actualizamos esta página y te lo avisamos.`,
      },
      seoTitulo: {
        tipo: "texto",
        label: "SEO · título",
        original: "Política de privacidad",
      },
      seoDescripcion: {
        tipo: "parrafo",
        label: "SEO · descripción",
        original:
          "Cómo tratamos tus datos personales en Gorros Wine, Pilar, Buenos Aires.",
      },
    },
  },

  legalesTerminos: {
    label: "Términos y condiciones",
    help: "La página /terminos. Ojo: es un texto legal — conviene que lo revise un asesor antes de publicarlo.",
    revalidate: ["/terminos"],
    campos: {
      titulo: {
        tipo: "texto",
        label: "Título",
        original: "Términos y condiciones",
      },
      actualizado: {
        tipo: "texto",
        label: "Última actualización",
        original: "julio de 2026",
      },
      aviso: {
        tipo: "parrafo",
        label: "Aviso de borrador",
        help: "Dejalo vacío para que no se muestre.",
        original:
          "**Borrador.** Este texto es una base genérica y todavía no fue revisado por un asesor legal. Antes de publicar el sitio hay que validarlo y completar los datos de la razón social.",
      },
      cuerpo: {
        tipo: "rico",
        label: "Texto",
        help: "`## ` para un subtítulo, `- ` para una viñeta, `**negrita**`, `[texto](destino)` para un enlace. Entre llaves se completan solos los datos del local: {direccion}, {horarios}, {email}, {instagram}, {whatsapp}.",
        original: `## 1. Edad mínima

La venta de bebidas alcohólicas está prohibida a menores de 18 años. Al usar este sitio declarás tener la edad legal para consumir alcohol en la República Argentina. Podemos pedir documento al entregar o al retirar el pedido, y rechazar la entrega si no se acredita la edad.

## 2. Productos y precios

Los precios están expresados en pesos argentinos e incluyen impuestos. Pueden cambiar sin aviso previo. Las fotos y descripciones son ilustrativas: la cosecha efectivamente entregada puede diferir de la publicada según disponibilidad.

La disponibilidad está sujeta a stock. Si una etiqueta no estuviera disponible después de confirmado el pedido, te avisamos para reemplazarla o devolverte el importe.

## 3. Pedidos, envíos y retiro

- **Envío:** hacemos entregas en Pilar y zona. El día y la franja horaria se coordinan al confirmar el pedido.
- **Retiro en el local:** reservás online y retirás en {direccion}, {horarios}.
- La entrega se realiza a una persona mayor de 18 años que pueda acreditar su edad.

## 4. Cambios y devoluciones

Si el producto llega en mal estado o no corresponde con lo pedido, escribinos dentro de los 3 días de recibido y lo reponemos o te devolvemos el importe. Por tratarse de productos alimenticios, no se aceptan devoluciones de botellas abiertas, salvo defecto del producto.

Nada de esto limita los derechos que te otorga la Ley 24.240 de Defensa del Consumidor, incluido el derecho de revocación dentro de los 10 días corridos en las compras a distancia.

## 5. Club Gorros

La membresía no tiene permanencia mínima: podés darla de baja cuando quieras avisándonos antes del cierre del mes en curso. La selección mensual la definimos nosotros y puede variar según disponibilidad.

## 6. Eventos

Los cupos son limitados y la reserva se confirma con el pago. Si no podés asistir, avisanos con al menos 48 horas para reprogramar.

## 7. Contacto

Por cualquier consulta escribinos a [{email}](mailto:{email}) o por Instagram a [@{instagram}](https://instagram.com/{instagram}).`,
      },
      seoTitulo: {
        tipo: "texto",
        label: "SEO · título",
        original: "Términos y condiciones",
      },
      seoDescripcion: {
        tipo: "parrafo",
        label: "SEO · descripción",
        original:
          "Términos y condiciones de uso y compra en Gorros Wine, Pilar, Buenos Aires.",
      },
    },
  },
} satisfies Record<string, Grupo>;

export type Registro = typeof REGISTRO;
export type GrupoKey = keyof Registro;

/** Los grupos en el orden en que se muestran en el panel. */
export const GRUPOS = Object.keys(REGISTRO) as GrupoKey[];

export type ValoresDe<K extends GrupoKey> = ValoresDeGrupo<Registro[K]>;

/** ¿Es una clave de grupo válida? Para validar el `[grupo]` de la URL. */
export function esGrupo(valor: string): valor is GrupoKey {
  return Object.hasOwn(REGISTRO, valor);
}

/** `<grupo>.<campo>`, la clave con la que se guarda en la base. */
export function claveDe(grupo: GrupoKey, campo: string): string {
  return `${grupo}.${campo}`;
}
