"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CADA_MS = 5_000;
/** Pasado esto, lo que siga en proceso no se va a resolver solo en la próxima
 *  vuelta: la pantalla ya ofrece consultar o revisar a mano. */
const TOPE_MS = 2 * 60 * 1000;

/** Vuelve a pedir la página mientras haya algo emitiéndose. */
export function AutoRefresh({ activo }: { activo: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!activo) return;
    const desde = Date.now();
    const t = setInterval(() => {
      if (Date.now() - desde > TOPE_MS) clearInterval(t);
      else router.refresh();
    }, CADA_MS);
    return () => clearInterval(t);
  }, [activo, router]);

  return null;
}
