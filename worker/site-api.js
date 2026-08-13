import notesApi from './notes-api.js';

const PHOTO_PREFIX = '/photography';
const MAX_CAPTION = 500;
const MAX_NOTE = 4000;
const MAX_LOCATION = 120;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(PHOTO_PREFIX)) return notesApi.fetch(request, env);

    const origin = request.headers.get('Origin') || '';
    const isPublic = request.method === 'GET' && (url.pathname === '/photography/photos' || url.pathname.startsWith('/photography/photos/'));
    if (request.method === 'OPTIONS') return photoCors(new Response(null, { status: 204 }), origin, env, isPublic);

    try {
      let response;
      if (url.pathname === '/photography/photos' && request.method === 'GET') response = await listPhotos(url, env);
      else if (url.pathname.startsWith('/photography/photos/') && request.method === 'GET') response = await getPhoto(url.pathname.slice('/photography/photos/'.length), env);
      else if (url.pathname === '/photography/upload-signature' && request.method === 'POST') response = await uploadSignature(request, env);
      else if (url.pathname === '/photography/photos' && request.method === 'POST') response = await createPhoto(request, env);
      else if (url.pathname.startsWith('/photography/photos/') && request.method === 'PATCH') response = await updatePhoto(request, url.pathname.slice('/photography/photos/'.length), env);
      else if (url.pathname.startsWith('/photography/photos/') && request.method === 'DELETE') response = await deletePhoto(request, url.pathname.slice('/photography/photos/'.length), env);
      else response = json({ error: 'Not found' }, 404);
      return photoCors(response, origin, env, isPublic);
    } catch (error) {
      console.error('photography-api', error);
      return photoCors(json({ error: error?.message || 'Unexpected error' }, error?.status || 500), origin, env, isPublic);
    }
  }
};

function photoCors(response, origin, env, isPublic) {
  const headers = new Headers(response.headers);
  if (isPublic) headers.set('Access-Control-Allow-Origin', '*');
  else if (origin && origin === env.SITE_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

async function requirePhotoSession(request, env) {
  const authUrl = new URL('/auth/status', request.url);
  const authRequest = new Request(authUrl, {
    method: 'GET',
    headers: { Authorization: request.headers.get('Authorization') || '' }
  });
  const response = await notesApi.fetch(authRequest, env);
  const data = await response.json().catch(() => ({}));
  if (!data.authenticated) throw httpError('请先登录 GitHub', 401);
  if (data.login !== env.ALLOWED_GITHUB_LOGIN) throw httpError('此账号没有发布权限', 403);
  return data;
}

async function uploadSignature(request, env) {
  await requirePhotoSession(request, env);
  requireCloudinary(env);
  const input = await request.json().catch(() => ({}));
  const date = normalizeDay(input.date);
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `daily-photo/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}-${crypto.randomUUID().slice(0, 8)}`;
  const params = { overwrite: 'false', public_id: publicId, timestamp: String(timestamp) };
  const signature = await cloudinarySignature(params, env.CLOUDINARY_API_SECRET);
  return json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`,
    timestamp,
    publicId,
    overwrite: false,
    signature
  }, 200, { 'Cache-Control': 'no-store' });
}

async function listPhotos(url, env) {
  const limit = clamp(Number(url.searchParams.get('limit') || 120), 1, 500);
  const year = String(url.searchParams.get('year') || '').trim();
  let sql = `SELECT * FROM photography_photos WHERE published=1`;
  const values = [];
  if (/^\d{4}$/.test(year)) { sql += ` AND substr(date,1,4)=?`; values.push(year); }
  sql += ` ORDER BY date DESC, created_at DESC LIMIT ?`;
  values.push(limit);
  const result = await env.DB.prepare(sql).bind(...values).all();
  return json({ photos: (result.results || []).map(serializePhoto) }, 200, { 'Cache-Control': 'no-store' });
}

async function getPhoto(encodedId, env) {
  const id = validatePhotoId(decodeURIComponent(encodedId));
  const row = await env.DB.prepare(`SELECT * FROM photography_photos WHERE id=? AND published=1 LIMIT 1`).bind(id).first();
  if (!row) return json({ error: 'Photo not found' }, 404);
  return json({ photo: serializePhoto(row) }, 200, { 'Cache-Control': 'no-store' });
}

async function createPhoto(request, env) {
  await requirePhotoSession(request, env);
  const input = normalizePhoto(await request.json());
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO photography_photos
    (id,date,caption,note,location,public_id,asset_id,version,width,height,format,bytes,exif_json,published,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
    .bind(input.id, input.date, input.caption, input.note, input.location, input.publicId, input.assetId, input.version, input.width, input.height, input.format, input.bytes, JSON.stringify(input.exif), now, now).run();
  const row = await env.DB.prepare(`SELECT * FROM photography_photos WHERE id=?`).bind(input.id).first();
  return json({ ok: true, photo: serializePhoto(row) }, 201);
}

async function updatePhoto(request, encodedId, env) {
  await requirePhotoSession(request, env);
  const id = validatePhotoId(decodeURIComponent(encodedId));
  const current = await env.DB.prepare(`SELECT * FROM photography_photos WHERE id=? LIMIT 1`).bind(id).first();
  if (!current) throw httpError('照片不存在', 404);
  const input = await request.json().catch(() => ({}));
  const caption = String(input.caption ?? current.caption ?? '').trim().slice(0, MAX_CAPTION);
  const note = String(input.note ?? current.note ?? '').trim().slice(0, MAX_NOTE);
  const location = String(input.location ?? current.location ?? '').trim().slice(0, MAX_LOCATION);
  const date = input.date ? normalizeDay(input.date) : current.date;
  const exif = input.exif && typeof input.exif === 'object' ? input.exif : parseJson(current.exif_json, {});
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(`UPDATE photography_photos SET date=?,caption=?,note=?,location=?,exif_json=?,updated_at=? WHERE id=?`)
    .bind(date, caption, note, location, JSON.stringify(exif), updatedAt, id).run();
  const row = await env.DB.prepare(`SELECT * FROM photography_photos WHERE id=?`).bind(id).first();
  return json({ ok: true, photo: serializePhoto(row) });
}

async function deletePhoto(request, encodedId, env) {
  await requirePhotoSession(request, env);
  requireCloudinary(env);
  const id = validatePhotoId(decodeURIComponent(encodedId));
  const row = await env.DB.prepare(`SELECT * FROM photography_photos WHERE id=? LIMIT 1`).bind(id).first();
  if (!row) throw httpError('照片不存在', 404);

  const warning = await destroyCloudinary(row.public_id, env).catch(error => `Cloudinary 删除失败：${error.message}`);
  await env.DB.prepare(`DELETE FROM photography_photos WHERE id=?`).bind(id).run();
  return json({ ok: true, id, warning: typeof warning === 'string' ? warning : null });
}

function normalizePhoto(input) {
  if (!input) throw new Error('缺少照片信息');
  const date = normalizeDay(input.date);
  const publicId = String(input.publicId || '').trim();
  if (!/^daily-photo\/[A-Za-z0-9_./-]{1,220}$/.test(publicId)) throw new Error('Cloudinary public_id 不合法');
  const assetId = String(input.assetId || '').trim().slice(0, 100);
  const version = Number(input.version || 0);
  const width = Math.max(0, Number(input.width || 0));
  const height = Math.max(0, Number(input.height || 0));
  const bytes = Math.max(0, Number(input.bytes || 0));
  const format = String(input.format || 'jpg').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'jpg';
  const caption = String(input.caption || '').trim().slice(0, MAX_CAPTION);
  const note = String(input.note || '').trim().slice(0, MAX_NOTE);
  const location = String(input.location || '').trim().slice(0, MAX_LOCATION);
  const exif = input.exif && typeof input.exif === 'object' ? sanitizeExif(input.exif) : {};
  const id = input.id ? validatePhotoId(String(input.id)) : `photo-${date}-${crypto.randomUUID().slice(0, 8)}`;
  return { id, date, publicId, assetId, version, width, height, bytes, format, caption, note, location, exif };
}

function sanitizeExif(value) {
  const allowed = ['camera','make','model','lens','focalLength','focalLength35mm','aperture','shutter','iso','takenAt'];
  const out = {};
  for (const key of allowed) if (value[key] != null) out[key] = String(value[key]).slice(0, 160);
  return out;
}

function serializePhoto(row) {
  return {
    id: row.id,
    date: row.date,
    caption: row.caption || '',
    note: row.note || '',
    location: row.location || '',
    cloudinary: {
      cloudName: 'cx0hlijl',
      publicId: row.public_id,
      assetId: row.asset_id || '',
      version: Number(row.version || 0),
      width: Number(row.width || 0),
      height: Number(row.height || 0),
      format: row.format || 'jpg',
      bytes: Number(row.bytes || 0)
    },
    exif: parseJson(row.exif_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function destroyCloudinary(publicId, env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp: String(timestamp) };
  const signature = await cloudinarySignature(params, env.CLOUDINARY_API_SECRET);
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), invalidate: 'true', api_key: env.CLOUDINARY_API_KEY, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/destroy`, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.result !== 'ok' && data.result !== 'not found')) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data;
}

async function cloudinarySignature(params, secret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const bytes = new TextEncoder().encode(serialized + secret);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function requireCloudinary(env) {
  for (const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) if (!env[key]) throw new Error(`缺少 Cloudflare 配置：${key}`);
}
function normalizeDay(value) { const text = String(value || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('拍摄日期必须是 YYYY-MM-DD'); return text; }
function validatePhotoId(value) { if (!/^[A-Za-z0-9._-]{1,120}$/.test(value)) throw new Error('照片 ID 不合法'); return value; }
function parseJson(value, fallback) { try { return JSON.parse(value || '') || fallback; } catch { return fallback; } }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function httpError(message, status) { const error = new Error(message); error.status = status; return error; }
function json(value, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } }); }
