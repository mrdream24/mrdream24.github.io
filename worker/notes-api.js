const encoder = new TextEncoder();
const decoder = new TextDecoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.SITE_ORIGIN;
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin, allowedOrigin);
    try {
      let response;
      if (url.pathname === "/auth/login") response = await login(url, env);
      else if (url.pathname === "/auth/callback") response = await callback(url, env);
      else if (url.pathname === "/auth/status") response = await status(request, env);
      else if (url.pathname === "/auth/logout") response = logout();
      else if (url.pathname === "/publish" && request.method === "POST") response = await publish(request, env);
      else response = json({ error: "Not found" }, 404);
      return cors(response, origin, allowedOrigin);
    } catch (error) {
      return cors(json({ error: error.message || "Unexpected error" }, 500), origin, allowedOrigin);
    }
  }
};

function cors(response, origin, allowed) {
  const h = new Headers(response.headers);
  if (origin && origin === allowed) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  h.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers: h });
}

async function login(url, env) {
  const returnTo = safeReturn(url.searchParams.get("return"), env.SITE_ORIGIN);
  const state = await seal(JSON.stringify({ returnTo, exp: Date.now() + 10 * 60_000 }), env.COOKIE_SECRET);
  const target = new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  target.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
  target.searchParams.set("scope", "repo");
  target.searchParams.set("state", state);
  return Response.redirect(target, 302);
}

async function callback(url, env) {
  const payload = JSON.parse(await open(url.searchParams.get("state") || "", env.COOKIE_SECRET));
  if (!payload.exp || payload.exp < Date.now()) throw new Error("登录状态已过期");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get("code")
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error(tokenData.error_description || "GitHub 登录失败");
  const cookie = await seal(tokenData.access_token, env.COOKIE_SECRET);
  const headers = new Headers({ Location: payload.returnTo });
  headers.append("Set-Cookie", `notes_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000`);
  return new Response(null, { status: 302, headers });
}

async function status(request, env) {
  const token = await session(request, env);
  if (!token) return json({ authenticated: false });
  const user = await github("/user", token);
  return json({ authenticated: user.login === env.ALLOWED_GITHUB_LOGIN, login: user.login });
}

function logout() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "notes_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0"
    }
  });
}

async function publish(request, env) {
  const token = await session(request, env);
  if (!token) return json({ error: "请先登录 GitHub" }, 401);
  const user = await github("/user", token);
  if (user.login !== env.ALLOWED_GITHUB_LOGIN) return json({ error: "此账号没有发布权限" }, 403);
  const input = await request.json();
  validate(input);
  const owner = env.REPO_OWNER;
  const repo = env.REPO_NAME;
  const branch = env.REPO_BRANCH || "master";
  const id = input.id || `note-${Date.now()}`;
  const uploaded = [];
  for (let i = 0; i < (input.images || []).length; i += 1) {
    const image = input.images[i];
    const match = /^data:image\/(webp|jpeg|png);base64,(.+)$/.exec(image);
    if (!match) throw new Error("图片格式不受支持");
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const path = `img/notes/${id}/${String(i + 1).padStart(2, "0")}.${ext}`;
    await putFile(owner, repo, path, match[2], `Add image for ${id}`, branch, token);
    uploaded.push(`/${path}`);
  }
  const dataPath = "data/notes.json";
  const current = await getFile(owner, repo, dataPath, branch, token);
  const store = JSON.parse(atobUnicode(current.content));
  const note = {
    id,
    date: input.date || new Date().toISOString(),
    title: String(input.title || "").trim(),
    body: String(input.body || "").trim(),
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 8) : [],
    images: uploaded
  };
  store.version = 1;
  store.updatedAt = new Date().toISOString();
  store.notes = [note, ...(store.notes || []).filter(item => item.id !== id)].slice(0, 500);
  await putFile(owner, repo, dataPath, btoaUnicode(JSON.stringify(store, null, 2) + "\n"), `Publish ${id}`, branch, token, current.sha);
  return json({ ok: true, note });
}

function validate(input) {
  if (!input || (String(input.body || "").trim().length === 0 && !(input.images || []).length)) throw new Error("至少写一句话或添加一张图片");
  if (String(input.body || "").length > 12000) throw new Error("正文过长");
  if ((input.images || []).length > 6) throw new Error("最多上传 6 张图片");
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
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `GitHub API ${response.status}`);
  return data;
}

async function getFile(owner, repo, path, branch, token) {
  return github(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, token);
}

async function putFile(owner, repo, path, content, message, branch, token, sha) {
  return github(`/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) })
  });
}

async function session(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const value = cookie.split(/;\s*/).find(x => x.startsWith("notes_session="))?.split("=").slice(1).join("=");
  if (!value) return null;
  try { return await open(value, env.COOKIE_SECRET); } catch { return null; }
}

function safeReturn(value, origin) {
  try {
    const u = new URL(value || origin, origin);
    return u.origin === origin ? u.toString() : origin;
  } catch { return origin; }
}

async function key(secret, usage) {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usage);
}

async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret, ["encrypt"]), encoder.encode(value)));
  return base64url(new Uint8Array([...iv, ...encrypted]));
}

async function open(value, secret) {
  const bytes = unbase64url(value);
  const iv = bytes.slice(0, 12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(secret, ["decrypt"]), bytes.slice(12));
  return decoder.decode(decrypted);
}

function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function unbase64url(value) { const s = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function btoaUnicode(value) { return btoa(unescape(encodeURIComponent(value))); }
function atobUnicode(value) { return decodeURIComponent(escape(atob(value.replace(/\n/g, "")))); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
