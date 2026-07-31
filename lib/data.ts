/**
 * Datos del local. El número de WhatsApp es de ejemplo — reemplazar por el
 * real antes de publicar (formato internacional, sin + ni espacios).
 */
export const shop = {
  whatsapp: "5491100000000",
  email: "hola@gorroswine.com",
  instagram: "gorroswine",
  address: "Pilar, Buenos Aires",
  hours: "Lun a Sáb · 10 a 21 hs",
};

export type WineType = "Tinto" | "Blanco" | "Espumante" | "Rosado";

export interface Wine {
  id: number;
  name: string;
  winery: string;
  type: WineType;
  /** Cepa(s). Los blends listan más de una, separadas por " / ". */
  grape: string;
  region: string;
  /** En pesos, como número: la UI formatea con formatPrice(). */
  priceARS: number;
  vintage: string;
  aging: string;
  pairings: string[];
}

/**
 * Formatea en pesos sin depender de Intl: el separador de miles queda igual
 * en servidor y en cliente, así no hay desajuste de hidratación.
 */
export function formatPrice(ars: number): string {
  return "$" + ars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Texto de ficha. El diseño usa la misma descripción para todas las
 * etiquetas; es copy de relleno, a reemplazar por las notas de cata reales.
 */
export const placeholderDescription =
  "Un vino de trago largo y taninos redondos, con fruta madura, un paso por roble bien medido y un final especiado. Ideal para acompañar una buena mesa o disfrutar solo.";

export const wines: Wine[] = [
  {
    id: 1,
    name: "Malbec Reserva",
    winery: "Bodega Andina",
    type: "Tinto",
    grape: "Malbec",
    region: "Valle de Uco · Mendoza",
    priceARS: 14900,
    vintage: "2021",
    aging: "Listo para beber",
    pairings: ["Carnes rojas", "Pastas", "Quesos duros", "Asado"],
  },
  {
    id: 2,
    name: "Cabernet Franc",
    winery: "Finca del Portezuelo",
    type: "Tinto",
    grape: "Cabernet Franc",
    region: "Agrelo · Mendoza",
    priceARS: 18500,
    vintage: "2021",
    aging: "Guarda 5 años",
    pairings: ["Carnes rojas", "Cordero", "Quesos duros"],
  },
  {
    id: 3,
    name: "Extra Brut Nature",
    winery: "Casa Espumante",
    type: "Espumante",
    grape: "Chardonnay / Pinot",
    region: "Tupungato",
    priceARS: 12300,
    vintage: "2022",
    aging: "Listo para beber",
    pairings: ["Aperitivo", "Mariscos", "Quesos blandos", "Sushi"],
  },
  {
    id: 4,
    name: "Chardonnay de Altura",
    winery: "Viña Alta",
    type: "Blanco",
    grape: "Chardonnay",
    region: "Gualtallary",
    priceARS: 16200,
    vintage: "2022",
    aging: "Listo para beber",
    pairings: ["Pescados", "Pollo", "Pastas con crema"],
  },
  {
    id: 5,
    name: "Pinot Noir",
    winery: "Estancia Sur",
    type: "Tinto",
    grape: "Pinot Noir",
    region: "Río Negro · Patagonia",
    priceARS: 21400,
    vintage: "2020",
    aging: "Guarda 4 años",
    pairings: ["Salmón", "Cerdo", "Hongos", "Quesos blandos"],
  },
  {
    id: 6,
    name: "Blend de Guarda",
    winery: "Bodega Andina",
    type: "Tinto",
    grape: "Malbec / Cabernet",
    region: "Valle de Uco · Mendoza",
    priceARS: 27900,
    vintage: "2019",
    aging: "Guarda 8 años",
    pairings: ["Carnes rojas", "Asado", "Quesos estacionados"],
  },
  {
    id: 7,
    name: "Torrontés",
    winery: "Finca del Norte",
    type: "Blanco",
    grape: "Torrontés",
    region: "Cafayate · Salta",
    priceARS: 11800,
    vintage: "2023",
    aging: "Listo para beber",
    pairings: ["Comida picante", "Empanadas", "Ceviche"],
  },
  {
    id: 8,
    name: "Rosado de Malbec",
    winery: "Viña Alta",
    type: "Rosado",
    grape: "Malbec",
    region: "Agrelo · Mendoza",
    priceARS: 10900,
    vintage: "2023",
    aging: "Listo para beber",
    pairings: ["Picadas", "Ensaladas", "Pescados"],
  },
  {
    id: 9,
    name: "Champagne Millésimé",
    winery: "Maison Sur",
    type: "Espumante",
    grape: "Chardonnay / Pinot",
    region: "Método tradicional",
    priceARS: 34500,
    vintage: "2018",
    aging: "Guarda 10 años",
    pairings: ["Celebración", "Mariscos", "Postres"],
  },
];

export const featuredWines: Wine[] = wines.slice(0, 4);

export function getWine(id: number): Wine | undefined {
  return wines.find((w) => w.id === id);
}

/** Vinos parecidos para "También te puede gustar". */
export function relatedWines(wine: Wine, limit = 4): Wine[] {
  const sameType = wines.filter((w) => w.id !== wine.id && w.type === wine.type);
  const rest = wines.filter((w) => w.id !== wine.id && w.type !== wine.type);
  return [...sameType, ...rest].slice(0, limit);
}

// ---------- filtros del catálogo ----------

export const wineTypes: WineType[] = ["Tinto", "Blanco", "Espumante", "Rosado"];

/** Se filtra por subcadena, así "Malbec" también alcanza a "Malbec / Cabernet". */
export const grapeFilters = [
  "Malbec",
  "Cabernet",
  "Pinot",
  "Chardonnay",
  "Torrontés",
];

/** Derivadas de los datos, no fijas: si se agrega una bodega, aparece sola. */
export const wineries: string[] = [...new Set(wines.map((w) => w.winery))].sort(
  (a, b) => a.localeCompare(b, "es"),
);

export const priceBounds = {
  min: Math.min(...wines.map((w) => w.priceARS)),
  max: Math.max(...wines.map((w) => w.priceARS)),
};

export const sortOptions = [
  { value: "recomendados", label: "Recomendados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre A–Z" },
] as const;

export type SortValue = (typeof sortOptions)[number]["value"];

// ---------- navegación y home ----------

// En v2 "Club" no es una página: es un ancla a la banda del club en la home.
export const navLinks = [
  { label: "Catálogo", href: "/catalogo" },
  { label: "Eventos", href: "/eventos" },
  { label: "Club", href: "/#club" },
  { label: "Nosotros", href: "/nosotros" },
];

// ---------- contenido de la home v2 ----------

export interface Benefit {
  label: string;
  body: string;
}

export const benefits: Benefit[] = [
  { label: "Envíos", body: "Pilar y zona · coordinás día y horario" },
  { label: "Retiro en el local", body: "Reservás online, pagás al retirar" },
  { label: "Club Gorros", body: "3 etiquetas curadas por mes" },
];

export interface Review {
  quote: string;
  name: string;
  tag: string;
}

export const reviews: Review[] = [
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
];

export interface Step {
  n: string;
  title: string;
  body: string;
}

export const steps: Step[] = [
  {
    n: "01",
    title: "Elegís",
    body: "Navegás el catálogo y sumás tus etiquetas al carrito.",
  },
  {
    n: "02",
    title: "Envío o retiro",
    body: "Recibís en Pilar y zona, o reservás y retirás en el local.",
  },
  {
    n: "03",
    title: "Pagás",
    body: "Online o al retirar. Tarjeta, transferencia o efectivo.",
  },
];

export interface Value {
  title: string;
  body: string;
}

export const values: Value[] = [
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
];

// ---------- eventos ----------

export interface WineEvent {
  day: string;
  month: string;
  title: string;
  meta: string;
  price: string;
}

export const events: WineEvent[] = [
  {
    day: "18",
    month: "Jul",
    title: "Cata de Malbecs de altura",
    meta: "19:30 hs · Local Pilar · 8 etiquetas a ciegas",
    price: "$9.000",
  },
  {
    day: "02",
    month: "Ago",
    title: "Espumantes & quesos",
    meta: "20:00 hs · con sommelier invitada",
    price: "$11.000",
  },
  {
    day: "16",
    month: "Ago",
    title: "Iniciación al vino",
    meta: "19:00 hs · para arrancar sin vueltas",
    price: "$7.500",
  },
  {
    day: "30",
    month: "Ago",
    title: "Noche de Patagonia",
    meta: "20:30 hs · Pinot y Merlot del sur",
    price: "$10.500",
  },
];

/** Los dos próximos, que se muestran en la home. */
export const upcomingEvents = events.slice(0, 2);

/** Galería de eventos pasados. Sin foto todavía: quedan como hueco. */
export const pastEvents = [
  { id: "evento-1", caption: "Cata a ciegas de Malbecs · Junio 2026" },
  { id: "evento-2", caption: "Espumantes & quesos · Mayo 2026" },
];
