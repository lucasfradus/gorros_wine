/** @type {import('next').NextConfig} */
const nextConfig = {
  // `pg` usa binarios y `require` dinámico: se deja fuera del bundle para que
  // Next lo cargue como módulo de Node en tiempo de ejecución.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
