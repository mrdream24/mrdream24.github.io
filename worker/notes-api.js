const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_LENGTH = 12000;
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const isPublic = isPublicRoute(url.pathname, request.method);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), origin, env, isPublic);
    }

    try {
      let response;

      if (url.pathname === "/health" && request.method === "GET") {
        response = json({ ok: true, service: "mrdream24-notes-api" });
      } else if (url.pathname === "/notes" && request.method === "GET") {
        response = await listNotes(url, env);
      } else if (url.pathname.startsWith("/notes/") && request.method === "GET") {
        response = await getNote(url.pathname.slice("/notes/".length), url, env);
      } else if (url.pathname.startsWith("/media/") && request.method === "GET") {
        response = await getMedia(url.pathname.slice("/media/".length), env);
      } else if (url.pathname === "/auth/login" && request.method === "GET") {
        response = await login(url, env);
      } else if (url.pathname === "/auth/callback" && request.method === "GET") {
        response = await callback(url, env);
      } else if (url.pathname === "/auth/status" && request.method === "GET") {
        response = await authStatus(request, env);
      } else if (url.pathname === "/publish" && request.method === "POST") {
        response = await publish(request, url, env);
      } else {
        response = json({ error: "Not found" }, 404);
      }

      return withCors(response, origin, env, isPublic);
    } catch (error) {
      console.error(error);
      return withCors(
        json({ error: error?.message || "Unexpected error" }, error?.status || 500),
        origin,
        env,
        isPublic
      );
    }
  }
};

function isPublicRoute(pathname, method) {
  return method === "GET" && (
    pathname === "/health" ||
    pathname === "/notes" ||
    pathname.startsWith("/notes/") ||
    pathname.startsWith("/media/")
  );
}

function withCors(response, origin, env, isPublic) {
  const headers = new Headers(response.headers);
  if (isPublic) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (origin && origin === env.SITE_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

async function listNotes(url, env) {
  const limit = clamp(Number(url.searchParams.get("limit") || 50), 1, 100);
  const before = url.searchParams.get("before");
  const tag = String(url.searchParams.get("tag") || "").trim();

  let sql = `SELECT id, date, title, body, tags_json, images_json, archive_status
             FROM notes
             WHERE published = 1`;
  const bindings = [];

  if (before) {
    sql += " AND date < ?";
    bindings.push(before);
  }
  if (tag) {
    sql += " AND EXISTS (SELECT 1 FROM json_each(notes.tags_json) WHERE json_each.value = ?)";
    bindings.push(tag);
  }
  sql += " ORDER BY date DESC LIMIT ?";
  bindings.push(limit + 1);

  const result = await env.DB.prepare(sql).bind(...bindings).all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit).map(row => serializeNote(row, url.origin));

  return json({
    notes: visible,
    nextCursor: hasMore ? visible[visible.length - 1]?.date || null : null
  }, 200, { "Cache-Control": "no-store" });
}

async function getNote(id, url, env) {
  const cleanId = validateId(decodeURIComponent(id));
  const row = await env.DB.prepare(
    `SELECT id, date, title, body, tags_json, images_json, archive_status
     FROM notes WHERE id = ? AND published = 1 LIMIT 1`
  ).bind(cleanId).first();

  if (!row) return json({ error: "Note not found" }, 404);
  return json({ note: serializeNote(row, url.origin) }, 200, { "Cache-Control": "no-store" });
}

async function getMedia(encodedKey, env) {
  const key = decodeURIComponent(encodedKey);
  if (!key || key.includes("..")) return json({ error: "Invalid media key" }, 400);

  const object = await env.MEDIA.get(key);
  if (!object) return json({ error: "Media not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function login(url, env) {
  const returnTo = safeReturn(url.searchParams.get("return"), env.SITE_ORIGIN);
  const state = await seal(JSON.stringify({
    returnTo,
    exp: Date.now() + 10 * 60 * 1000
  }), env.COOKIE_SECRET);

  const target = new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  target.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
  target.searchParams.set("scope", "public_repo");
  target.searchParams.set("state", state);
  return Response.redirect(target, 302);
}

async function callback(url, env) {
  const stateValue = url.searchParams.get("state") || "";
  const state = JSON.parse(await open(stateValue, env.COOKIE_SECRET));
  if (!state.exp || state.exp < Date.now()) throw new Error("登录状态已过期");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get("code")
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || "GitHub 登录失败");
  }

  const user = await github("/user", tokenData.access_token);
  if (user.login !== env.ALLOWED_GITHUB_LOGIN) {
    const error = new Error("此 GitHub 账号没有发布权限");
    error.status = 403;
    throw error;
  }

  const session = await seal(JSON.stringify({
    token: tokenData.access_token,
    login: user.login,
    exp: Date.now() + SESSION_TTL_MS
  }), env.COOKIE_SECRET);

  const target = new URL(state.returnTo);
  target.hash = `session=${encodeURIComponent(session)}`;
  return Response.redirect(target, 302);
}

async function authStatus(request, env) {
  const session = await readSession(request, env);
  if (!session) return json({ authenticated: false });
  return json({ authenticated: true, login: session.login, expiresAt: session.exp });
}

async function publish(request, url, env) {
  const session = await requireSession(request, env);
  const input = await request.json();
  const note = normalizeInput(input);
  const mediaKeys = [];

  try {
    for (let index = 0; index < note.images.length; index += 1) {
      const image = decodeDataImage(note.images[index]);
      const key = `notes/${note.id}/${String(index + 1).padStart(2, "0")}.${image.ext}`;
      await env.MEDIA.put(key, image.bytes, {
        httpMetadata: {
          contentType: image.contentType,
          cacheControl: "public, max-age=31536000, immutable"
        },
        customMetadata: {
          noteId: note.id,
          uploadedBy: session.login
        }
      });
      mediaKeys.push(key);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO notes (
        id, date, title, body, tags_json, images_json,
        archive_path, archive_status, published, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', 1, ?, ?)`
    ).bind(
      note.id,
      note.date,
      note.title,
      note.body,
      JSON.stringify(note.tags),
      JSON.stringify(mediaKeys),
      now,
      now
    ).run();

    let archiveStatus = "archived";
    let archivePath = null;
    let archiveWarning = null;

    try {
      archivePath = await archiveToGitHub({ ...note, imageKeys: mediaKeys }, session.token, env);
      await env.DB.prepare(
        "UPDATE notes SET archive_path = ?, archive_status = 'archived', updated_at = ? WHERE id = ?"
      ).bind(archivePath, new Date().toISOString(), note.id).run();
    } catch (error) {
      archiveStatus = "failed";
      archiveWarning = error?.message || "GitHub 归档失败";
      await env.DB.prepare(
        "UPDATE notes SET archive_status = 'failed', updated_at = ? WHERE id = ?"
      ).bind(new Date().toISOString(), note.id).run();
      console.error("Archive failed", error);
    }

    return json({
      ok: true,
      note: {
        id: note.id,
        date: note.date,
        title: note.title,
        body: note.body,
        tags: note.tags,
        images: mediaKeys.map(key => mediaUrl(url.origin, key)),
        archiveStatus,
        archivePath
      },
      warning: archiveWarning
    });
  } catch (error) {
    if (mediaKeys.length) {
      await Promise.allSettled(mediaKeys.map(key => env.MEDIA.delete(key)));
    }
    throw error;
  }
}

function normalizeInput(input) {
  if (!input) throw new Error("缺少发布内容");

  const body = String(input.body || "").trim();
  const title = String(input.title || "").trim().slice(0, 120);
  const images = Array.isArray(input.images) ? input.images.slice(0, MAX_IMAGES) : [];
  const tags = Array.isArray(input.tags)
    ? input.tags.map(tag => String(tag).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
    : [];

  if (!body && images.length === 0) throw new Error("至少写一句话或添加一张图片");
  if (body.length > MAX_BODY_LENGTH) throw new Error("正文过长");
  if (Array.isArray(input.images) && input.images.length > MAX_IMAGES) throw new Error("最多上传 6 张图片");

  return {
    id: input.id ? validateId(String(input.id)) : makeId(),
    date: normalizeDate(input.date),
    title,
    body,
    tags,
    images
  };
}

function decodeDataImage(value) {
  const match = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ""));
  if (!match) throw new Error("图片格式不受支持");

  const type = match[1];
  const binary = atob(match[2]);
  if (binary.length > MAX_IMAGE_BYTES) throw new Error("单张图片压缩后不能超过 4MB");

  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return {
    bytes,
    ext: type === "jpeg" ? "jpg" : type,
    contentType: type === "jpeg" ? "image/jpeg" : `image/${type}`
  };
}

async function archiveToGitHub(note, token, env) {
  const date = new Date(note.date);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const path = `content/notes/${year}/${month}/${year}-${month}-${day}-${hours}${minutes}${seconds}-${note.id}.md`;

  const markdown = [
    "---",
    `id: ${yamlString(note.id)}`,
    `date: ${yamlString(note.date)}`,
    `title: ${yamlString(note.title)}`,
    `tags: ${JSON.stringify(note.tags)}`,
    `images: ${JSON.stringify(note.imageKeys)}`,
    "storage: r2",
    "---",
    "",
    note.body,
    ""
  ].join("\n");

  await github(repoPath(env, path), token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Archive ${note.id}`,
      content: toBase64(markdown),
      branch: env.REPO_BRANCH || "master"
    })
  });

  return path;
}

function serializeNote(row, origin) {
  const imageKeys = parseJsonArray(row.images_json);
  return {
    id: row.id,
    date: row.date,
    title: row.title || "",
    body: row.body || "",
    tags: parseJsonArray(row.tags_json),
    images: imageKeys.map(key => mediaUrl(origin, key)),
    archiveStatus: row.archive_status || "pending"
  };
}

function mediaUrl(origin, key) {
  return `${origin}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function makeId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = crypto.randomUUID().slice(0, 8);
  return `note-${stamp}-${suffix}`;
}

function validateId(value) {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(value)) throw new Error("内容 ID 不合法");
  return value;
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("发布时间不合法");
  return date.toISOString();
}

async function requireSession(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    const error = new Error("请先登录 GitHub");
    error.status = 401;
    throw error;
  }
  if (session.login !== env.ALLOWED_GITHUB_LOGIN) {
    const error = new Error("此账号没有发布权限");
    error.status = 403;
    throw error;
  }
  return session;
}

async function readSession(request, env) {
  const value = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!value) return null;

  try {
    const payload = JSON.parse(await open(value, env.COOKIE_SECRET));
    if (!payload.token || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function github(path, token, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "mrdream24-notes",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub API ${response.status}`);
  return data;
}

function repoPath(env, path) {
  return `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}`;
}

function safeReturn(value, origin) {
  try {
    const url = new URL(value || origin, origin);
    return url.origin === origin ? url.toString() : origin;
  } catch {
    return origin;
  }
}

async function cryptoKey(secret, usages) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, usages);
}

async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(secret, ["encrypt"]),
    encoder.encode(value)
  ));
  return toBase64Url(new Uint8Array([...iv, ...ciphertext]));
}

async function open(value, secret) {
  const bytes = fromBase64Url(value);
  const iv = bytes.slice(0, 12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(secret, ["decrypt"]),
    bytes.slice(12)
  );
  return decoder.decode(plaintext);
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function toBase64(value) {
  const bytes = encoder.encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
