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

  experimental: {
    // Las imágenes del CMS se suben por una Server Action, y el límite de
    // cuerpo que trae Next por defecto es 1 MB: no entra una foto de celular.
    // El tope real de la subida lo pone `uploadMediaAction` (4 MB); acá se deja
    // un poco de aire para el resto del formulario.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
