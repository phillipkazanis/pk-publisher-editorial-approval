// Serves the brand logo from a private Supabase Storage bucket, so the image is never committed to git.
// Upload it once with `npm run upload:logo -- <file>`; point NEXT_PUBLIC_BRAND_LOGO at /api/brand/logo.
const BUCKET = 'demo-publisher-brand'; // keep in sync with scripts/upload-logo.mjs
const OBJECT = 'logo';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return res.status(404).end();

  try {
    const upstream = await fetch(`${base}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!upstream.ok) return res.status(404).end();
    const type = upstream.headers.get('content-type') || '';
    if (!/^image\/(png|jpeg|webp)$/.test(type)) return res.status(404).end();

    res.setHeader('Content-Type', type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(404).end();
  }
}
