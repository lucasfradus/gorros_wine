import type { Metadata } from "next";

/**
 * Marco del área de administración. No monta nada de la tienda: ni nav, ni
 * footer, ni age gate, ni carrito.
 *
 * `robots: noindex` aplica a todo lo que cuelga de acá — el panel nunca
 * debe aparecer en Google, ni siquiera la pantalla de ingreso.
 */
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Gorros Wine" },
  robots: { index: false, follow: false },
};

export default function AdminAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
