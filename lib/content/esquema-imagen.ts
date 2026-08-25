import { z } from "zod";

/**
 * La ruta de una imagen tiene que ser del propio sitio. Sin esto, alguien con
 * acceso al panel podría dejar apuntando las fotos a un dominio ajeno.
 */
const rutaDeImagen = z
  .string()
  .min(1, "Falta la imagen.")
  .refine(
    (s) => s.startsWith("/") && !s.startsWith("//"),
    "La imagen tiene que ser una ruta de este sitio.",
  );

/**
 * Lo que se acepta como referencia a una imagen subida.
 *
 * Vive en su propio archivo —y no adentro de la action del CMS, que es donde
 * nació— porque ya lo validan dos secciones: el contenido del sitio y la
 * agenda de eventos. La regla del `src` es una defensa, y una defensa
 * duplicada es una defensa que un día se endurece en un solo lado.
 */
export const esquemaImagen = z
  .object({
    src: rutaDeImagen,
    alt: z.string().max(300, "El texto alternativo es muy largo."),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  })
  .nullable();
