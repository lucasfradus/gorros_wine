/**
 * Lo que corre el servicio cron de Railway una vez por día: le pega a
 * `POST /api/cron/diario` de la app y sale con error si algo falló, para que
 * Railway lo marque en rojo.
 *
 *   APP_URL=https://... CRON_SECRET=... node scripts/cron-diario.mjs
 *
 * `APP_URL` cae a `NEXT_PUBLIC_SITE_URL` si no está.
 */
const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!base || !secret) {
  console.error("Faltan APP_URL (o NEXT_PUBLIC_SITE_URL) y CRON_SECRET.");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/api/cron/diario`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    // El sync de 7 días más la reconciliación pueden tardar: margen holgado.
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  const cuerpo = await res.text();
  console.log(`HTTP ${res.status}`, cuerpo);
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error("No se pudo llamar al cron:", e);
  process.exit(1);
}
