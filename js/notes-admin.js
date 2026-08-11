(() => {
  const CONFIG = window.NOTES_CONFIG || {};
  const DRAFT_KEY = "mrdream24-note-drafts-v2";
  const SESSION_KEY = "mrdream24-notes-session";
  const $ = selector => document.querySelector(selector);
  const editId = new URLSearchParams(location.search).get("edit") || "";
  let images = [];
  let existingImages = [];
  let originalDate = "";
  let authenticated = false;

  const apiReady = () => CONFIG.apiBase && !CONFIG.apiBase.includes("YOUR-");
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const session = () => sessionStorage.getItem(SESSION_KEY) || "";

  function setStatus(text, type = "") {
    const node = $("#composerStatus");
    node.textContent = text;
    node.dataset.type = type;
  }

  function captureSession() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const value = hash.get("session");
    if (!value) return;
    sessionStorage.setItem(SESSION_KEY, value);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (session()) headers.Authorization = `Bearer ${session()}`;
    const response = await fetch(`${CONFIG.apiBase}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`);
    return data;
  }

  async function refreshAuth() {
    const login = $("#loginButton");
    const publish = $("#publishButton");
    if (!apiReady()) {
      login.textContent = "尚未配置发布服务";
      login.disabled = true;
      publish.disabled = true;
      $("#setupNotice").hidden = false;
      return;
    }
    try {
      const result = await api("/auth/status", { method: "GET", headers: {} });
      authenticated = result.authenticated === true;
      login.textContent = authenticated ? `已登录：${result.login}` : "使用 GitHub 登录";
      login.dataset.authenticated = String(authenticated);
      publish.disabled = !authenticated;
      $("#setupNotice").hidden = true;
    } catch (error) {
      authenticated = false;
      login.textContent = "使用 GitHub 登录";
      publish.disabled = true;
      setStatus(error.message, "error");
    }
  }

  function payload() {
    return {
      id: editId || `note-${Date.now()}`,
      date: originalDate || new Date().toISOString(),
      title: $("#noteTitle").value.trim(),
      body: $("#noteBody").value.trim(),
      tags: $("#noteTags").value.split(/[,，]/).map(x => x.trim()).filter(Boolean).slice(0, 8),
      existingImages,
      images
    };
  }

  function reset() {
    images = [];
    existingImages = [];
    originalDate = "";
    $("#noteTitle").value = "";
    $("#noteBody").value = "";
    $("#noteTags").value = "";
    $("#noteTitle").classList.remove("is-visible");
    renderImages();
  }

  function renderImages() {
    const existing = existingImages.map((src, index) => `
      <figure>
        <img src="${escapeHtml(src)}" alt="现有图片 ${index + 1}">
        <button type="button" data-remove-existing="${index}" aria-label="删除图片">×</button>
      </figure>`).join("");
    const added = images.map((src, index) => `
      <figure>
        <img src="${src}" alt="新图片 ${index + 1}">
        <button type="button" data-remove-new="${index}" aria-label="删除图片">×</button>
      </figure>`).join("");
    $("#imagePreview").innerHTML = existing + added;
    document.querySelectorAll("[data-remove-existing]").forEach(button => {
      button.onclick = () => { existingImages.splice(Number(button.dataset.removeExisting), 1); renderImages(); };
    });
    document.querySelectorAll("[data-remove-new]").forEach(button => {
      button.onclick = () => { images.splice(Number(button.dataset.removeNew), 1); renderImages(); };
    });
  }

  async function compress(file) {
    if (!file.type.startsWith("image/")) throw new Error("只能上传图片");
    const url = URL.createObjectURL(file);
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const max = 1920;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/webp", 0.82);
  }

  function renderDrafts() {
    const drafts = read(DRAFT_KEY);
    $("#draftList").innerHTML = drafts.length ? drafts.map((item, index) => `
      <div class="draft-item">
        <span>${escapeHtml(item.title || item.body?.slice(0, 30) || "图片随记")}</span>
        <span><button data-load="${index}">继续写</button><button data-delete="${index}">删除</button></span>
      </div>`).join("") : '<p class="composer-status">暂无草稿</p>';
    document.querySelectorAll("[data-load]").forEach(button => button.onclick = () => loadDraft(Number(button.dataset.load)));
    document.querySelectorAll("[data-delete]").forEach(button => button.onclick = () => deleteDraft(Number(button.dataset.delete)));
  }

  function loadDraft(index) {
    if (editId) return;
    const drafts = read(DRAFT_KEY);
    const item = drafts.splice(index, 1)[0];
    write(DRAFT_KEY, drafts);
    $("#noteTitle").value = item.title || "";
    $("#noteBody").value = item.body || "";
    $("#noteTags").value = (item.tags || []).join("，");
    images = item.images || [];
    if (item.title) $("#noteTitle").classList.add("is-visible");
    renderImages();
    renderDrafts();
    scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteDraft(index) {
    const drafts = read(DRAFT_KEY);
    drafts.splice(index, 1);
    write(DRAFT_KEY, drafts);
    renderDrafts();
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadEditNote() {
    if (!editId || !apiReady()) return;
    setStatus("正在载入 Note……");
    try {
      const result = await api(`/notes/${encodeURIComponent(editId)}`, { method: "GET", headers: {} });
      const note = result.note;
      originalDate = note.date;
      existingImages = Array.isArray(note.images) ? note.images.slice(0, 6) : [];
      $("#noteTitle").value = note.title || "";
      $("#noteBody").value = note.body || "";
      $("#noteTags").value = (note.tags || []).join("，");
      if (note.title) $("#noteTitle").classList.add("is-visible");
      $("#publishButton").textContent = "保存修改";
      $("#draftButton").hidden = true;
      renderImages();
      setStatus("正在编辑已发布的 Note。保存后前台会立即更新。", "success");
    } catch (error) {
      setStatus(`无法载入 Note：${error.message}`, "error");
      $("#publishButton").disabled = true;
    }
  }

  $("#loginButton").onclick = async () => {
    if (authenticated) {
      sessionStorage.removeItem(SESSION_KEY);
      authenticated = false;
      await refreshAuth();
      return;
    }
    const returnTo = `${location.origin}${location.pathname}${location.search}`;
    location.href = `${CONFIG.apiBase}/auth/login?return=${encodeURIComponent(returnTo)}`;
  };

  $("#imageButton").onclick = () => $("#imageInput").click();
  $("#imageInput").onchange = async event => {
    setStatus("正在压缩图片……");
    const room = 6 - existingImages.length - images.length;
    const selected = [...event.target.files].slice(0, Math.max(0, room));
    for (const file of selected) {
      try { images.push(await compress(file)); }
      catch { setStatus(`无法处理图片：${file.name}`, "error"); }
    }
    renderImages();
    setStatus(`当前共 ${existingImages.length + images.length} 张图片`);
    event.target.value = "";
  };

  $("#titleButton").onclick = () => {
    $("#noteTitle").classList.toggle("is-visible");
    if ($("#noteTitle").classList.contains("is-visible")) $("#noteTitle").focus();
  };

  $("#draftButton").onclick = () => {
    if (editId) return;
    const item = payload();
    if (!item.body && !item.images.length) return setStatus("没有可保存的内容", "error");
    const drafts = read(DRAFT_KEY);
    drafts.unshift(item);
    write(DRAFT_KEY, drafts.slice(0, 30));
    reset();
    renderDrafts();
    setStatus("草稿已保存在当前设备");
  };

  $("#publishButton").onclick = async () => {
    const item = payload();
    if (!item.body && !item.images.length && !item.existingImages.length) return setStatus("至少写一句话或添加一张图片", "error");
    const button = $("#publishButton");
    button.disabled = true;
    button.textContent = editId ? "保存中……" : "发布中……";
    setStatus(editId ? "正在保存修改并同步归档……" : "正在保存文字、上传图片并归档，请不要关闭页面。");
    try {
      const path = editId ? `/notes/${encodeURIComponent(editId)}` : "/publish";
      const method = editId ? "PATCH" : "POST";
      const result = await api(path, { method, body: JSON.stringify(item) });
      if (!editId) reset();
      if (result.warning) {
        setStatus(`${editId ? "内容已更新" : "内容已立即发布"}；部分归档或媒体清理失败：${result.warning}`, "error");
      } else {
        setStatus(editId ? "修改已保存。" : "发布成功，前台现在即可看到。", "success");
      }
      setTimeout(() => location.href = `../notes.html#${encodeURIComponent(result.note.id)}`, 700);
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.textContent = editId ? "保存修改" : "发布";
      button.disabled = !authenticated;
    }
  };

  captureSession();
  renderDrafts();
  Promise.all([refreshAuth(), loadEditNote()]);
})();
