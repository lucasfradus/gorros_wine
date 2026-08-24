/** @type {import('next').NextConfig} */
const nextConfig = {
  // `pg` usa binarios y `require` dinámico: se deja fuera del bundle para que
  // Next lo cargue como módulo de Node en tiempo de ejecución.
  serverExternalPackages: ["pg"],

  // El indicador de desarrollo vive abajo a la izquierda, justo encima del
  // selector de modo del panel. Sólo se ve en `npm run dev`, pero tapaba un
  // botón que hay que poder apretar.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
