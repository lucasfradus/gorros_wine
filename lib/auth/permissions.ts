import type { PublicUser, UserRole } from "@/lib/db/schema";

export const ROLES: UserRole[] = ["admin", "editor"];

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  editor: "Editor",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: "Todo: catálogo, precios, pedidos y usuarios. Puede nombrar otros admin.",
  editor: "Sólo contenido: catálogo, precios y eventos. No ve la sección Usuarios.",
};

/**
 * ¿Ve la sección Usuarios?
 *
 * Con dos roles éste es el único permiso que hace falta calcular: un admin
 * puede todo, un editor no toca usuarios. Lo que antes decidían
 * `canEditUser` y `canAssignRole` —qué admin puede tocar a qué otro— dejó de
 * existir junto con el nivel intermedio.
 *
 * Lo que sí sigue habiendo son tres reglas, y viven en
 * `usuarios/actions.ts` porque necesitan consultar la base: nadie se cambia
 * el rol a sí mismo, nadie se desactiva a sí mismo, y no se puede degradar ni
 * desactivar al último admin activo.
 */
export function canManageUsers(actor: PublicUser): boolean {
  return actor.role === "admin";
}

/**
 * ¿Puede editar los textos y las fotos del sitio?
 *
 * Hoy, cualquiera del panel: el rol `editor` existe exactamente para esto y
 * hasta ahora no tenía ninguna pantalla propia.
 *
 * Queda como función y no como un `true` suelto en la UI por el mismo motivo
 * que el resto de este archivo: el día que haya que afinarlo —por ejemplo, que
 * las legales las toque sólo un admin— se cambia acá y no en cada pantalla que
 * pregunta.
 */
export function canEditContent(_actor: PublicUser): boolean {
  return true;
}

/**
 * ¿Puede cargar y publicar eventos?
 *
 * Los dos roles, y no es una concesión: el `ROLE_DESCRIPTION` de arriba ya le
 * promete al editor "catálogo, precios y eventos". Si esto devolviera sólo
 * `admin`, lo que estaría mal sería la descripción que lee la persona al
 * asignar el rol.
 *
 * Queda como función por lo mismo que las de arriba: el día que publicar exija
 * ser admin —y editar el borrador no— se cambia acá, y no en cada pantalla que
 * pregunta.
 */
export function canEditEvents(_actor: PublicUser): boolean {
  return true;
}
