import type { Moneda, TipoVino } from "@/lib/db/schema";

/**
 * Constantes del catálogo: lo que el panel ofrece para elegir.
 *
 * Las listas se escriben acá como literales y no se derivan de
 * `tipoVino.enumValues`, por la misma razón que `ROLES` en
 * `lib/auth/permissions.ts`: estos módulos los importa un componente
 * `"use client"`, y traer el schema de Drizzle al bundle del navegador por una
 * lista de cuatro palabras no vale la pena. Sólo viajan los tipos, que se
 * borran al compilar.
 */

export const TIPOS: TipoVino[] = ["Tinto", "Blanco", "Espumante", "Rosado"];

export const MONEDAS: Moneda[] = ["ARS", "USD"];

export const MONEDA_LABEL: Record<Moneda, string> = {
  ARS: "Pesos",
  USD: "Dólares",
};

/**
 * Los varietales **no** están acá: viven en la tabla `varietales`, con su ABM
 * en `/admin/varietales`. La lista fija que había en este archivo se sembró en
 * la migración `0003`. Sigue siendo una lista cerrada —no se tipean a mano—,
 * pero ahora la cierra la base y la edita el dueño.
 */

/**
 * Maridajes sugeridos. Salen de los que ya usan las fichas de `lib/data.ts`:
 * la idea es que al migrar los nueve vinos a la base no haya que inventar
 * ninguno nuevo.
 */
export const MARIDAJES: string[] = [
  "Aperitivo",
  "Asado",
  "Carnes rojas",
  "Cerdo",
  "Ceviche",
  "Comida picante",
  "Cordero",
  "Ensaladas",
  "Empanadas",
  "Hongos",
  "Mariscos",
  "Pastas",
  "Pastas con crema",
  "Pescados",
  "Picadas",
  "Pollo",
  "Postres",
  "Quesos blandos",
  "Quesos duros",
  "Quesos estacionados",
  "Salmón",
  "Sushi",
];

/**
 * Nombre → slug para la URL. "Malbec Reserva 2021" ⇒ "malbec-reserva-2021".
 *
 * El `normalize("NFD")` parte cada letra acentuada en letra + tilde suelta, y
 * el reemplazo siguiente se lleva esas tildes. Sin ese paso "Torrontés" no
 * quedaría "torrontes" sino "torronte-s", porque el filtro `[^a-z0-9]` de más
 * abajo convierte la tilde suelta en un guion.
 *
 * Ojo al editar: el rango de ese `replace` son los diacríticos combinantes
 * U+0300–U+036F, y en pantalla no se ven — son marcas que se dibujan sobre el
 * corchete. No hay nada roto ahí.
 */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
