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
    // Las imágenes del panel se suben por una Server Action, y el límite de
    // cuerpo que trae Next por defecto es 1 MB: no entra una foto de celular.
    // El tope real de la subida está en `lib/content/limites.ts` (10 MB de
    // entrada, que después se comprimen); acá se deja aire para el resto del
    // formulario. Este número tiene que quedar por encima de aquél: pasado
    // este límite la action no corre, y su mensaje de error no se ve.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
