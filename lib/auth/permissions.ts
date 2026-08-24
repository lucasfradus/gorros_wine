import type { PublicUser, UserRole } from "@/lib/db/schema";

export const ROLES: UserRole[] = ["owner", "admin", "editor"];

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  editor: "Editor",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  owner: "Acceso total, incluido nombrar a otros dueños.",
  admin: "Gestiona contenido y usuarios, pero no toca a los dueños.",
  editor: "Sólo contenido: catálogo, precios y eventos. No ve usuarios.",
};

/** ¿Ve la sección Usuarios? */
export function canManageUsers(actor: PublicUser): boolean {
  return actor.role === "owner" || actor.role === "admin";
}

/**
 * ¿Puede tocar a este usuario en particular?
 *
 * La regla que importa: un `admin` no puede editar ni desactivar a un
 * `owner`. Si no, cualquier administrador podría degradar al dueño y quedarse
 * con el sistema.
 */
export function canEditUser(
  actor: PublicUser,
  target: { role: UserRole },
): boolean {
  if (!canManageUsers(actor)) return false;
  if (actor.role === "owner") return true;
  return target.role !== "owner";
}

/** Sólo un dueño nombra a otro dueño. */
export function canAssignRole(actor: PublicUser, role: UserRole): boolean {
  if (!canManageUsers(actor)) return false;
  if (role === "owner") return actor.role === "owner";
  return true;
}

/** Los roles que este usuario puede elegir en un formulario. */
export function assignableRoles(actor: PublicUser): UserRole[] {
  return ROLES.filter((r) => canAssignRole(actor, r));
}
