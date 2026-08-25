import { z } from "zod";

/**
 * Fragmentos de zod que comparten los formularios del panel.
 *
 * Viven en `lib/` y no al lado de una acción porque un archivo `"use server"`
 * sólo puede exportar funciones asíncronas: cualquier constante compartida
 * entre dos `actions.ts` tiene que estar afuera.
 */

/**
 * Campo de texto que puede venir vacío.
 *
 * Se guarda `null` y nunca `""`. Si no, la base termina con dos formas de
 * decir "no hay dato" y toda lectura tiene que preguntar por las dos.
 */
export const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

export const emailOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, {
    message: "El mail no es válido.",
  })
  .transform((v) => (v === "" ? null : v));

export const sitioOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), {
    message: "El sitio tiene que empezar con http:// o https://",
  })
  .transform((v) => (v === "" ? null : v));

/**
 * Slug escrito a mano. Vacío es válido: quien llama decide si lo deriva del
 * nombre con `slugify` o si corta.
 */
export const slugOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[a-z0-9-]+$/.test(v), {
    message: "El slug sólo admite minúsculas, números y guiones.",
  });
