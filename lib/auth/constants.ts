/**
 * Constantes de auth que también necesita el navegador (por ejemplo el
 * `minLength` de un input). Van en su propio módulo para que importarlas
 * desde un componente cliente no arrastre bcrypt al bundle.
 */
export const MIN_PASSWORD_LENGTH = 10;
