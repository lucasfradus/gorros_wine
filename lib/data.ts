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

export interface Category {
  name: string;
  count: string;
  href: string;
}

export const categories: Category[] = [
  { name: "Tintos", count: "80+ etiquetas", href: "/catalogo?tipo=Tinto" },
  { name: "Blancos", count: "40+ etiquetas", href: "/catalogo?tipo=Blanco" },
  {
    name: "Espumantes",
    count: "25+ etiquetas",
    href: "/catalogo?tipo=Espumante",
  },
  { name: "Ediciones", count: "Colección", href: "/catalogo" },
];

export const navLinks = [
  { label: "Catálogo", href: "/catalogo" },
  { label: "Club", href: "/club" },
  { label: "Eventos", href: "/eventos" },
  { label: "Nosotros", href: "/nosotros" },
];
