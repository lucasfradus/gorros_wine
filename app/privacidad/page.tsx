import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { shop } from "@/lib/data";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo tratamos tus datos personales en Gorros Wine, Pilar, Buenos Aires.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="julio de 2026">
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <b>Para tu pedido:</b> nombre, teléfono, dirección de entrega y correo
          electrónico.
        </li>
        <li>
          <b>Si te suscribís al newsletter:</b> tu correo electrónico.
        </li>
        <li>
          <b>En tu navegador:</b> el carrito y la confirmación de edad se
          guardan sólo en tu dispositivo, no en nuestros servidores.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>
        Para preparar y entregar tus pedidos, responder tus consultas y —si nos
        diste el consentimiento— enviarte novedades. No usamos tus datos para
        otra cosa.
      </p>

      <h2>Con quién los compartimos</h2>
      <p>
        Sólo con quienes necesitamos para cumplir el pedido: el servicio de
        entrega y el medio de pago. No vendemos ni cedemos tus datos a terceros
        con fines publicitarios.
      </p>

      <h2>Cuánto tiempo los conservamos</h2>
      <p>
        Los datos de compra se conservan mientras sean necesarios para cumplir
        obligaciones contables e impositivas. Los del newsletter, hasta que te
        des de baja.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir acceder, rectificar o suprimir tus datos escribiendo a{" "}
        <a href={`mailto:${shop.email}`}>{shop.email}</a>. La Agencia de Acceso
        a la Información Pública, órgano de control de la Ley 25.326, atiende
        las denuncias por incumplimiento.
      </p>
      <p>
        El titular de los datos puede solicitar el retiro o bloqueo de su nombre
        de nuestras bases de datos conforme al artículo 27, inciso 3 de la Ley
        25.326.
      </p>

      <h2>Cookies</h2>
      <p>
        Hoy el sitio no usa cookies de terceros ni de analítica. Si eso cambia,
        actualizamos esta página y te lo avisamos.
      </p>
    </LegalPage>
  );
}
