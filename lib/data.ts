export type WineType = "Tinto" | "Blanco" | "Espumante" | "Rosado";

export interface Wine {
  id: number;
  name: string;
  winery: string;
  type: WineType;
  region: string;
  /** Ya formateado en pesos argentinos, tal como viene del diseño. */
  price: string;
}

export interface Category {
  name: string;
  count: string;
  href: string;
}

export const featuredWines: Wine[] = [
  {
    id: 1,
    name: "Malbec Reserva",
    winery: "Bodega Andina",
    type: "Tinto",
    region: "Valle de Uco · Mendoza",
    price: "$14.900",
  },
  {
    id: 2,
    name: "Cabernet Franc",
    winery: "Finca del Portezuelo",
    type: "Tinto",
    region: "Agrelo · Mendoza",
    price: "$18.500",
  },
  {
    id: 3,
    name: "Extra Brut Nature",
    winery: "Casa Espumante",
    type: "Espumante",
    region: "Tupungato",
    price: "$12.300",
  },
  {
    id: 4,
    name: "Chardonnay de Altura",
    winery: "Viña Alta",
    type: "Blanco",
    region: "Gualtallary",
    price: "$16.200",
  },
];

export const categories: Category[] = [
  { name: "Tintos", count: "80+ etiquetas", href: "/catalogo/tintos" },
  { name: "Blancos", count: "40+ etiquetas", href: "/catalogo/blancos" },
  { name: "Espumantes", count: "25+ etiquetas", href: "/catalogo/espumantes" },
  { name: "Ediciones", count: "Colección", href: "/catalogo/ediciones" },
];

export const navLinks = [
  { label: "Catálogo", href: "/catalogo" },
  { label: "Club", href: "/club" },
  { label: "Eventos", href: "/eventos" },
  { label: "Nosotros", href: "/nosotros" },
];
