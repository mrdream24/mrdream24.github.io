const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_LENGTH = 12000;
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const publicRoute = isPublicRoute(url.pathname, request.method);
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin, env, publicRoute);

    try {
      let response;
      if (url.pathname === '/health' && request.method === 'GET') response = json({ ok: true, service: 'mrdream24-notes-api' });
      else if (url.pathname === '/notes' && request.method === 'GET') response = await listNotes(url, env);
      else if (url.pathname.startsWith('/notes/') && request.method === 'GET') response = await getNote(url.pathname.slice(7), url, env);
      else if (url.pathname.startsWith('/notes/') && request.method === 'PATCH') response = await updateNote(request, url.pathname.slice(7), url, env);
      else if (url.pathname.startsWith('/notes/') && request.method === 'DELETE') response = await deleteNote(request, url.pathname.slice(7), env);
      else if (url.pathname.startsWith('/media/') && request.method === 'GET') response = await getMedia(url.pathname.slice(7), env);
      else if (url.pathname === '/auth/login' && request.method === 'GET') response = await login(url, env);
      else if (url.pathname === '/auth/callback' && request.method === 'GET') response = await callback(url, env);
      else if (url.pathname === '/auth/status' && request.method === 'GET') response = await authStatus(request, env);
      else if (url.pathname === '/debug/github' && request.method === 'GET') response = await githubDebug(request, env);
      else if (url.pathname === '/publish' && request.method === 'POST') response = await publish(request, url, env);
      else response = json({ error: 'Not found' }, 404);
      return withCors(response, origin, env, publicRoute);
    } catch (error) {
      console.error(error);
      return withCors(json({ error: error?.message || 'Unexpected error' }, error?.status || 500), origin, env, publicRoute);
    }
  }
};

function isPublicRoute(pathname, method) {
  return method === 'GET' && (pathname === '/health' || pathname === '/notes' || pathname.startsWith('/notes/') || pathname.startsWith('/media/'));
}

function withCors(response, origin, env, publicRoute) {
  const headers = new Headers(response.headers);
  if (publicRoute) headers.set('Access-Control-Allow-Origin', '*');
  else if (origin && origin === env.SITE_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

async function listNotes(url, env) {
  const limit = clamp(Number(url.searchParams.get('limit') || 50), 1, 100);
  const before = url.searchParams.get('before');
  const tag = String(url.searchParams.get('tag') || '').trim();
  let sql = `SELECT id,date,title,body,tags_json,images_json,archive_status FROM notes WHERE published=1`;
  const bindings = [];
  if (before) { sql += ' AND date < ?'; bindings.push(before); }
  if (tag) { sql += ' AND EXISTS (SELECT 1 FROM json_each(notes.tags_json) WHERE json_each.value = ?)'; bindings.push(tag); }
  sql += ' ORDER BY date DESC LIMIT ?';
  bindings.push(limit + 1);
  const result = await env.DB.prepare(sql).bind(...bindings).all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit).map(row => serializeNote(row, url.origin));
  return json({ notes: visible, nextCursor: hasMore ? visible.at(-1)?.date || null : null }, 200, { 'Cache-Control': 'no-store' });
}

async function getNote(id, url, env) {
  const cleanId = validateId(decodeURIComponent(id));
  const row = await env.DB.prepare(`SELECT id,date,title,body,tags_json,images_json,archive_status FROM notes WHERE id=? AND published=1 LIMIT 1`).bind(cleanId).first();
  if (!row) return json({ error: 'Note not found' }, 404);
  return json({ note: serializeNote(row, url.origin) }, 200, { 'Cache-Control': 'no-store' });
}

async function updateNote(request, encodedId, url, env) {
  const session = await requireSession(request, env);
  const id = validateId(decodeURIComponent(encodedId));
  const row = await env.DB.prepare(`SELECT id,date,title,body,tags_json,images_json,archive_path,archive_status,created_at,updated_at FROM notes WHERE id=? AND published=1 LIMIT 1`).bind(id).first();
  if (!row) throw httpError('Note 不存在', 404);

  const input = await request.json();
  const body = String(input?.body || '').trim();
  const title = String(input?.title || '').trim().slice(0, 120);
  const tags = Array.isArray(input?.tags) ? input.tags.map(tag => String(tag).trim().slice(0, 30)).filter(Boolean).slice(0, 8) : [];
  const newImages = Array.isArray(input?.images) ? input.images : [];
  const oldKeys = parseJsonArray(row.images_json);
  const keepKeys = Array.isArray(input?.existingImages)
    ? [...new Set(input.existingImages.map(value => mediaKeyFromUrl(value, url.origin)).filter(key => key && oldKeys.includes(key)))]
    : oldKeys.slice();

  if (body.length > MAX_BODY_LENGTH) throw new Error('正文过长');
  if (newImages.length > MAX_IMAGES || keepKeys.length + newImages.length > MAX_IMAGES) throw new Error('最多保留 6 张图片');
  if (!body && keepKeys.length === 0 && newImages.length === 0) throw new Error('至少写一句话或保留一张图片');

  const uploadedKeys = [];
  try {
    for (let index = 0; index < newImages.length; index += 1) {
      const image = decodeDataImage(newImages[index]);
      const key = `notes/${id}/edit-${Date.now()}-${String(index + 1).padStart(2, '0')}.${image.ext}`;
      await b2Request(env, 'PUT', key, image.bytes, image.contentType);
      uploadedKeys.push(key);
    }

    const finalKeys = [...keepKeys, ...uploadedKeys];
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(`UPDATE notes SET title=?,body=?,tags_json=?,images_json=?,archive_status='pending',updated_at=? WHERE id=?`)
      .bind(title, body, JSON.stringify(tags), JSON.stringify(finalKeys), updatedAt, id).run();

    const note = { id, date: row.date, title, body, tags, imageKeys: finalKeys, origin: url.origin };
    let archiveStatus = 'archived';
    let archivePath = row.archive_path || null;
    let warning = null;

    try {
      const archive = await archiveToGitHub(note, session.token, env, archivePath);
      archivePath = archive.path;
      await env.DB.prepare(`UPDATE notes SET archive_path=?,archive_status='archived',updated_at=? WHERE id=?`)
        .bind(archivePath, new Date().toISOString(), id).run();
    } catch (error) {
      archiveStatus = 'failed';
      warning = `GitHub Markdown 归档更新失败：${error?.message || 'unknown error'}`;
      await env.DB.prepare(`UPDATE notes SET archive_status='failed',updated_at=? WHERE id=?`)
        .bind(new Date().toISOString(), id).run();
      console.error('Archive update failed', error);
    }

    const removedKeys = oldKeys.filter(key => !keepKeys.includes(key));
    const cleanupWarning = await cleanupB2Keys(removedKeys, env);
    if (cleanupWarning) warning = [warning, cleanupWarning].filter(Boolean).join('；');

    return json({
      ok: true,
      note: {
        id,
        date: row.date,
        title,
        body,
        tags,
        images: finalKeys.map(key => mediaUrl(url.origin, key)),
        archiveStatus,
        archivePath
      },
      warning
    });
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map(key => b2Request(env, 'DELETE', key)));
    throw error;
  }
}

async function deleteNote(request, encodedId, env) {
  const session = await requireSession(request, env);
  const id = validateId(decodeURIComponent(encodedId));
  const row = await env.DB.prepare(`SELECT id,images_json,archive_path FROM notes WHERE id=? AND published=1 LIMIT 1`).bind(id).first();
  if (!row) throw httpError('Note 不存在', 404);

  await env.DB.prepare(`DELETE FROM notes WHERE id=?`).bind(id).run();

  const warnings = [];
  const mediaWarning = await cleanupB2Keys(parseJsonArray(row.images_json), env);
  if (mediaWarning) warnings.push(mediaWarning);

  if (row.archive_path) {
    try {
      await deleteGitHubArchive(row.archive_path, id, session.token, env);
    } catch (error) {
      warnings.push(`GitHub Markdown 清理失败：${error?.message || 'unknown error'}`);
      console.error('Archive delete failed', error);
    }
  }

  return json({ ok: true, id, warning: warnings.length ? warnings.join('；') : null });
}

async function cleanupB2Keys(keys, env) {
  const failures = [];
  for (const key of keys) {
    try {
      const response = await b2Request(env, 'DELETE', key);
      if (!response.ok && response.status !== 404) failures.push(`${key} (${response.status})`);
    } catch (error) {
      failures.push(`${key} (${error?.message || 'failed'})`);
    }
  }
  return failures.length ? `B2 图片清理失败：${failures.join(', ')}` : null;
}

async function getMedia(encodedKey, env) {
  const key = decodePath(encodedKey);
  if (!key || key.includes('..')) return json({ error: 'Invalid media key' }, 400);
  const response = await b2Request(env, 'GET', key);
  if (response.status === 404) return json({ error: 'Media not found' }, 404);
  if (!response.ok) throw new Error(`B2 download failed: ${response.status}`);
  const headers = new Headers();
  headers.set('Content-Type', response.headers.get('Content-Type') || contentTypeFromKey(key));
  const etag = response.headers.get('ETag');
  if (etag) headers.set('ETag', etag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(response.body, { status: 200, headers });
}

async function login(url, env) {
  const returnTo = safeReturn(url.searchParams.get('return'), env.SITE_ORIGIN);
  const state = await seal(JSON.stringify({ returnTo, exp: Date.now() + 10 * 60 * 1000 }), env.COOKIE_SECRET);
  const target = new URL('https://github.com/login/oauth/authorize');
  target.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  target.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  target.searchParams.set('scope', 'repo');
  target.searchParams.set('state', state);
  return Response.redirect(target, 302);
}

async function callback(url, env) {
  const state = JSON.parse(await open(url.searchParams.get('state') || '', env.COOKIE_SECRET));
  if (!state.exp || state.exp < Date.now()) throw new Error('登录状态已过期');
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code') })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error(tokenData.error_description || 'GitHub 登录失败');
  const user = await github('/user', tokenData.access_token);
  if (user.login !== env.ALLOWED_GITHUB_LOGIN) throw httpError('此 GitHub 账号没有发布权限', 403);
  const session = await seal(JSON.stringify({ token: tokenData.access_token, login: user.login, exp: Date.now() + SESSION_TTL_MS }), env.COOKIE_SECRET);
  const target = new URL(state.returnTo);
  target.hash = `session=${encodeURIComponent(session)}`;
  return Response.redirect(target, 302);
}

async function authStatus(request, env) {
  const session = await readSession(request, env);
  return session ? json({ authenticated: true, login: session.login, expiresAt: session.exp }) : json({ authenticated: false });
}

async function githubDebug(request, env) {
  const session = await requireSession(request, env);
  const userResult = await githubRequest('/user', session.token);
  if (!userResult.response.ok) throw new Error(`GitHub API ${userResult.response.status}: ${userResult.data.message || 'Unable to read user'}`);

  const repoResult = await githubRequest(`/repos/${env.REPO_OWNER}/${env.REPO_NAME}`, session.token);
  if (!repoResult.response.ok) throw new Error(`GitHub API ${repoResult.response.status}: ${repoResult.data.message || 'Unable to read repository'}`);

  const latest = await env.DB.prepare(`SELECT id,date,archive_path,archive_status,updated_at FROM notes ORDER BY created_at DESC LIMIT 1`).first();
  let archiveLookup = null;
  if (latest?.archive_path) {
    const ref = encodeURIComponent(env.REPO_BRANCH || 'master');
    const archiveResult = await githubRequest(`${repoPath(env, latest.archive_path)}?ref=${ref}`, session.token);
    archiveLookup = {
      status: archiveResult.response.status,
      found: archiveResult.response.ok,
      path: latest.archive_path,
      sha: archiveResult.data?.sha || null,
      htmlUrl: archiveResult.data?.html_url || null,
      message: archiveResult.response.ok ? null : (archiveResult.data?.message || 'Unknown error')
    };
  }

  return json({
    ok: true,
    tokenScopes: (userResult.response.headers.get('x-oauth-scopes') || '').split(',').map(value => value.trim()).filter(Boolean),
    login: userResult.data.login,
    configured: {
      repoOwner: env.REPO_OWNER,
      repoName: env.REPO_NAME,
      repoBranch: env.REPO_BRANCH || 'master'
    },
    repository: {
      fullName: repoResult.data.full_name,
      defaultBranch: repoResult.data.default_branch,
      permissions: repoResult.data.permissions || null
    },
    latestNote: latest || null,
    archiveLookup
  }, 200, { 'Cache-Control': 'no-store' });
}

async function publish(request, url, env) {
  const session = await requireSession(request, env);
  const note = normalizeInput(await request.json());
  const mediaKeys = [];

  try {
    for (let index = 0; index < note.images.length; index += 1) {
      const image = decodeDataImage(note.images[index]);
      const key = `notes/${note.id}/${String(index + 1).padStart(2, '0')}.${image.ext}`;
      await b2Request(env, 'PUT', key, image.bytes, image.contentType);
      mediaKeys.push(key);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO notes (id,date,title,body,tags_json,images_json,archive_path,archive_status,published,created_at,updated_at) VALUES (?,?,?,?,?,?,NULL,'pending',1,?,?)`)
      .bind(note.id, note.date, note.title, note.body, JSON.stringify(note.tags), JSON.stringify(mediaKeys), now, now).run();

    let archiveStatus = 'archived';
    let archivePath = null;
    let archiveGitHub = null;
    let warning = null;
    try {
      const archive = await archiveToGitHub({ ...note, imageKeys: mediaKeys, origin: url.origin }, session.token, env);
      archivePath = archive.path;
      archiveGitHub = {
        commitSha: archive.commitSha,
        contentSha: archive.contentSha,
        contentUrl: archive.contentUrl
      };
      await env.DB.prepare(`UPDATE notes SET archive_path=?,archive_status='archived',updated_at=? WHERE id=?`).bind(archivePath, new Date().toISOString(), note.id).run();
    } catch (error) {
      archiveStatus = 'failed';
      warning = `内容已发布，但 GitHub Markdown 归档失败：${error?.message || 'unknown error'}`;
      await env.DB.prepare(`UPDATE notes SET archive_status='failed',updated_at=? WHERE id=?`).bind(new Date().toISOString(), note.id).run();
      console.error('Archive failed', error);
    }

    return json({
      ok: true,
      note: { id: note.id, date: note.date, title: note.title, body: note.body, tags: note.tags, images: mediaKeys.map(key => mediaUrl(url.origin, key)), archiveStatus, archivePath },
      archiveGitHub,
      warning
    });
  } catch (error) {
    await Promise.allSettled(mediaKeys.map(key => b2Request(env, 'DELETE', key)));
    throw error;
  }
}

function normalizeInput(input) {
  if (!input) throw new Error('缺少发布内容');
  const body = String(input.body || '').trim();
  const title = String(input.title || '').trim().slice(0, 120);
  const images = Array.isArray(input.images) ? input.images : [];
  const tags = Array.isArray(input.tags) ? input.tags.map(tag => String(tag).trim().slice(0, 30)).filter(Boolean).slice(0, 8) : [];
  if (!body && images.length === 0) throw new Error('至少写一句话或添加一张图片');
  if (body.length > MAX_BODY_LENGTH) throw new Error('正文过长');
  if (images.length > MAX_IMAGES) throw new Error('最多上传 6 张图片');
  return { id: input.id ? validateId(String(input.id)) : makeId(), date: normalizeDate(input.date), title, body, tags, images: images.slice(0, MAX_IMAGES) };
}

function decodeDataImage(value) {
  const match = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
  if (!match) throw new Error('图片格式不受支持');
  const binary = atob(match[2]);
  if (binary.length > MAX_IMAGE_BYTES) throw new Error('单张图片压缩后不能超过 4MB');
  const type = match[1];
  return { bytes: Uint8Array.from(binary, c => c.charCodeAt(0)), ext: type === 'jpeg' ? 'jpg' : type, contentType: type === 'jpeg' ? 'image/jpeg' : `image/${type}` };
}

async function archiveToGitHub(note, token, env, existingPath = null) {
  const date = new Date(note.date);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const stamp = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}${String(date.getUTCSeconds()).padStart(2, '0')}`;
  const path = existingPath || `content/notes/${year}/${month}/${year}-${month}-${day}-${stamp}-${note.id}.md`;
  const imageUrls = note.imageKeys.map(key => mediaUrl(note.origin, key));
  const markdown = [
    '---',
    `id: ${yamlString(note.id)}`,
    `date: ${yamlString(note.date)}`,
    `title: ${yamlString(note.title)}`,
    `tags: ${JSON.stringify(note.tags)}`,
    `images: ${JSON.stringify(imageUrls)}`,
    'storage: backblaze-b2',
    '---',
    '',
    note.body,
    ''
  ].join('\n');

  const branch = env.REPO_BRANCH || 'master';
  let sha = null;
  if (existingPath) {
    const current = await githubRequest(`${repoPath(env, path)}?ref=${encodeURIComponent(branch)}`, token);
    if (current.response.ok) sha = current.data?.sha || null;
    else if (current.response.status !== 404) throw new Error(`GitHub API ${current.response.status}: ${current.data?.message || 'Unable to read archive'}`);
  }

  const body = { message: `${existingPath ? 'Update' : 'Archive'} ${note.id}`, content: toBase64(markdown), branch };
  if (sha) body.sha = sha;
  const result = await github(repoPath(env, path), token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return {
    path,
    commitSha: result.commit?.sha || null,
    contentSha: result.content?.sha || null,
    contentUrl: result.content?.html_url || null
  };
}

async function deleteGitHubArchive(path, noteId, token, env) {
  const branch = env.REPO_BRANCH || 'master';
  const current = await githubRequest(`${repoPath(env, path)}?ref=${encodeURIComponent(branch)}`, token);
  if (current.response.status === 404) return;
  if (!current.response.ok) throw new Error(`GitHub API ${current.response.status}: ${current.data?.message || 'Unable to read archive'}`);
  await github(repoPath(env, path), token, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Delete archive ${noteId}`, sha: current.data.sha, branch })
  });
}

function serializeNote(row, origin) {
  return {
    id: row.id,
    date: row.date,
    title: row.title || '',
    body: row.body || '',
    tags: parseJsonArray(row.tags_json),
    images: parseJsonArray(row.images_json).map(key => mediaUrl(origin, key)),
    archiveStatus: row.archive_status || 'pending'
  };
}

function mediaKeyFromUrl(value, origin) {
  try {
    const url = new URL(String(value || ''));
    if (url.origin !== origin || !url.pathname.startsWith('/media/')) return null;
    const key = decodePath(url.pathname.slice(7));
    return key && !key.includes('..') ? key : null;
  } catch {
    return null;
  }
}

async function b2Request(env, method, key, body = null, contentType = '') {
  requireB2Config(env);
  const endpoint = String(env.B2_ENDPOINT || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const region = String(env.B2_REGION || endpoint.split('.')[1] || '').trim();
  const bucket = String(env.B2_BUCKET || '').trim();
  const accessKeyId = String(env.B2_KEY_ID || '').trim();
  const applicationKey = String(env.B2_APPLICATION_KEY || '').trim();
  const canonicalUri = `/${encodeSegment(bucket)}/${key.split('/').map(encodeSegment).join('/')}`;
  const url = `https://${endpoint}${canonicalUri}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = body == null
    ? new Uint8Array()
    : body instanceof Uint8Array
      ? body
      : body instanceof ArrayBuffer
        ? new Uint8Array(body)
        : ArrayBuffer.isView(body)
          ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
          : encoder.encode(String(body));
  const payloadHash = await sha256Hex(payload);
  const headersForSigning = { host: endpoint, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headersForSigning['content-type'] = contentType;
  const signedHeaderNames = Object.keys(headersForSigning).sort();
  const canonicalHeaders = signedHeaderNames.map(name => `${name}:${headersForSigning[name].trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(encoder.encode(canonicalRequest))].join('\n');
  const signingKey = await getSignatureKey(applicationKey, dateStamp, region, 's3');
  const signature = bytesToHex(await hmac(signingKey, encoder.encode(stringToSign)));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers = new Headers({ Authorization: authorization, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate });
  if (contentType) headers.set('Content-Type', contentType);
  const requestBody = method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : payload;
  const response = await fetch(url, { method, headers, body: requestBody });
  if (!response.ok && method !== 'GET' && method !== 'DELETE') {
    const text = await response.text().catch(() => '');
    throw new Error(`B2 ${method} failed (${response.status}) [payloadBytes=${payload.byteLength}]${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
  return response;
}

function requireB2Config(env) {
  for (const name of ['B2_BUCKET', 'B2_ENDPOINT', 'B2_KEY_ID', 'B2_APPLICATION_KEY']) if (!env[name]) throw new Error(`缺少 Cloudflare 配置：${name}`);
}

async function getSignatureKey(secret, dateStamp, region, service) {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), encoder.encode(dateStamp));
  const kRegion = await hmac(kDate, encoder.encode(region));
  const kService = await hmac(kRegion, encoder.encode(service));
  return hmac(kService, encoder.encode('aws4_request'));
}

async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function bytesToHex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''); }
function encodeSegment(value) { return encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
function decodePath(value) { return value.split('/').map(part => decodeURIComponent(part)).join('/'); }
function mediaUrl(origin, key) { return `${origin}/media/${key.split('/').map(encodeSegment).join('/')}`; }
function contentTypeFromKey(key) { return key.endsWith('.webp') ? 'image/webp' : key.endsWith('.png') ? 'image/png' : 'image/jpeg'; }
function parseJsonArray(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function makeId() { return `note-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`; }
function validateId(value) { if (!/^[A-Za-z0-9._-]{1,100}$/.test(value)) throw new Error('内容 ID 不合法'); return value; }
function normalizeDate(value) { const date = value ? new Date(value) : new Date(); if (Number.isNaN(date.getTime())) throw new Error('发布时间不合法'); return date.toISOString(); }
function yamlString(value) { return JSON.stringify(String(value || '')); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function safeReturn(value, origin) { try { const u = new URL(value || origin, origin); return u.origin === origin ? u.toString() : origin; } catch { return origin; } }
function httpError(message, status) { const error = new Error(message); error.status = status; return error; }

async function requireSession(request, env) {
  const session = await readSession(request, env);
  if (!session) throw httpError('请先登录 GitHub', 401);
  if (session.login !== env.ALLOWED_GITHUB_LOGIN) throw httpError('此账号没有发布权限', 403);
  return session;
}

async function readSession(request, env) {
  const value = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!value) return null;
  try {
    const session = JSON.parse(await open(value, env.COOKIE_SECRET));
    if (!session.token || !session.login || !session.exp || session.exp < Date.now()) return null;
    return session;
  } catch { return null; }
}

async function githubRequest(path, token, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'mrdream24-notes', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function github(path, token, init = {}) {
  const { response, data } = await githubRequest(path, token, init);
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${data.message || 'Unknown error'}`);
  return data;
}

function repoPath(env, path) { return `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}`; }
async function aesKey(secret, usages) { const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret)); return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, usages); }
async function seal(value, secret) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret, ['encrypt']), encoder.encode(value))); return base64url(new Uint8Array([...iv, ...encrypted])); }
async function open(value, secret) { const bytes = unbase64url(value); const iv = bytes.slice(0, 12); const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(secret, ['decrypt']), bytes.slice(12)); return decoder.decode(decrypted); }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function unbase64url(value) { const s = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function toBase64(value) { const bytes = encoder.encode(value); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function json(value, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } }); }
