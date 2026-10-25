// Uploads the brand logo to a private Supabase Storage bucket (created if missing).
// The app serves it at /api/brand/logo, so the image never needs to be committed to git.
//
// Run: npm run upload:logo -- path/to/logo.png
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (via .env.local) and never prints them.

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const BUCKET = 'demo-publisher-brand'; // keep in sync with pages/api/brand/logo.js
const OBJECT = 'logo';
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const MAX_BYTES = 1024 * 1024;

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run upload:logo -- path/to/logo.png');
  process.exit(2);
}
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(2);
}
const type = TYPES[extname(file).toLowerCase()];
if (!type) {
  console.error(`Unsupported file type. Use one of: ${Object.keys(TYPES).join(', ')}`);
  process.exit(2);
}
if (statSync(file).size > MAX_BYTES) {
  console.error('File is larger than 1 MB.');
  process.exit(2);
}

const base = process.env.SUPABASE_URL;
const auth = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

// 1. Private bucket (409 means it already exists)
const bucket = await fetch(`${base}/storage/v1/bucket`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
});
if (bucket.ok) console.log(`Created private bucket "${BUCKET}".`);
else if (bucket.status === 409 || /already exists/i.test(await bucket.text())) console.log(`Bucket "${BUCKET}" already exists.`);
else {
  console.error(`Could not create the bucket (HTTP ${bucket.status}).`);
  process.exit(1);
}

// 2. Upload (overwrites the previous logo)
const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${OBJECT}`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': type, 'x-upsert': 'true' },
  body: readFileSync(file),
});
if (!upload.ok) {
  console.error(`Upload failed (HTTP ${upload.status}).`);
  process.exit(1);
}
console.log(`Uploaded ${file} (${type}). Set NEXT_PUBLIC_BRAND_LOGO=/api/brand/logo to use it.`);
