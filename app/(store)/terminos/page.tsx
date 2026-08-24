import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { shop } from "@/lib/data";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de uso y compra en Gorros Wine, Pilar, Buenos Aires.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="julio de 2026">
      <h2>1. Edad mínima</h2>
      <p>
        La venta de bebidas alcohólicas está prohibida a menores de 18 años. Al
        usar este sitio declarás tener la edad legal para consumir alcohol en la
        República Argentina. Podemos pedir documento al entregar o al retirar el
        pedido, y rechazar la entrega si no se acredita la edad.
      </p>

      <h2>2. Productos y precios</h2>
      <p>
        Los precios están expresados en pesos argentinos e incluyen impuestos.
        Pueden cambiar sin aviso previo. Las fotos y descripciones son
        ilustrativas: la cosecha efectivamente entregada puede diferir de la
        publicada según disponibilidad.
      </p>
      <p>
        La disponibilidad está sujeta a stock. Si una etiqueta no estuviera
        disponible después de confirmado el pedido, te avisamos para reemplazarla
        o devolverte el importe.
      </p>

      <h2>3. Pedidos, envíos y retiro</h2>
      <ul>
        <li>
          <b>Envío:</b> hacemos entregas en Pilar y zona. El día y la franja
          horaria se coordinan al confirmar el pedido.
        </li>
        <li>
          <b>Retiro en el local:</b> reservás online y retirás en{" "}
          {shop.address}, {shop.hours}.
        </li>
        <li>
          La entrega se realiza a una persona mayor de 18 años que pueda
          acreditar su edad.
        </li>
      </ul>

      <h2>4. Cambios y devoluciones</h2>
      <p>
        Si el producto llega en mal estado o no corresponde con lo pedido,
        escribinos dentro de los 3 días de recibido y lo reponemos o te
        devolvemos el importe. Por tratarse de productos alimenticios, no se
        aceptan devoluciones de botellas abiertas, salvo defecto del producto.
      </p>
      <p>
        Nada de esto limita los derechos que te otorga la Ley 24.240 de Defensa
        del Consumidor, incluido el derecho de revocación dentro de los 10 días
        corridos en las compras a distancia.
      </p>

      <h2>5. Club Gorros</h2>
      <p>
        La membresía no tiene permanencia mínima: podés darla de baja cuando
        quieras avisándonos antes del cierre del mes en curso. La selección
        mensual la definimos nosotros y puede variar según disponibilidad.
      </p>

      <h2>6. Eventos</h2>
      <p>
        Los cupos son limitados y la reserva se confirma con el pago. Si no
        podés asistir, avisanos con al menos 48 horas para reprogramar.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Por cualquier consulta escribinos a{" "}
        <a href={`mailto:${shop.email}`}>{shop.email}</a> o por Instagram a{" "}
        <a
          href={`https://instagram.com/${shop.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{shop.instagram}
        </a>
        .
      </p>
    </LegalPage>
  );
}
