(() => {
  const CONFIG = window.NOTES_CONFIG || {};
  const defaults = [
    { id: "welcome-short", date: "2026-08-05T22:04:00+08:00", title: "", body: "有时候，阅读一本书只是为了确认自己仍然能够长时间地注视同一个问题。", tags: ["阅读"], images: [] },
    { id: "welcome-medium", date: "2026-08-03T18:22:00+08:00", title: "", body: "最近重新玩了一遍《逆转裁判》。\n\n以前我更在意谜题能不能骗过我，现在却开始注意人物如何在一套高度程式化的类型结构里获得感情。类型小说真正困难的地方，也许不是制造意外，而是在规则内部仍然保留人的重量。", tags: ["产品"], images: [] },
    { id: "welcome-long", date: "2026-07-29T20:15:00+08:00", title: "为什么我仍然需要一个自己的博客", body: "社交平台让表达变得容易，却也让每一句话迅速沉入时间线。一个自己的博客并不是为了恢复某种庄严的写作姿态，而是为了让零散的念头有一个不会被算法重新排序的位置。\n\n它可以只是一句话，也可以是一篇没有写完的长文。重要的不是篇幅，而是这些文字仍然属于同一条可以回望的个人时间。", tags: ["生活"], images: [] }
  ];

  let notes = defaults;
  let activeFilter = "all";

  function apiReady() {
    return Boolean(CONFIG.apiBase && !CONFIG.apiBase.includes("YOUR-"));
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replaceAll("/", ".");
  }

  function render() {
    const root = document.querySelector("#notesList");
    const list = notes.filter(note => activeFilter === "all" || (note.tags || []).includes(activeFilter));
    document.querySelector("#emptyState").hidden = Boolean(list.length);

    root.innerHTML = list.map(note => {
      const length = (note.body || "").replace(/\s/g, "").length;
      const mode = length <= 40 ? "is-short" : length <= 200 ? "is-medium" : "is-long";
      const images = (note.images || []).slice(0, 4);
      const imageHtml = images.length
        ? `<div class="note-images count-${images.length}">${images.map((src, index) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(note.title || "随笔图片")} ${index + 1}" loading="lazy">`).join("")}</div>`
        : "";
      const collapsible = length > 600;
      const body = collapsible ? `${escapeHtml(note.body.slice(0, 420))}…` : escapeHtml(note.body || "");

      return `<article class="note ${mode}" id="${escapeHtml(note.id)}">
        <div class="note-meta"><time>${formatDate(note.date)}</time>${(note.tags || []).map(tag => `<span class="note-tag">#${escapeHtml(tag)}</span>`).join("")}</div>
        ${note.title ? `<h2 class="note-title">${escapeHtml(note.title)}</h2>` : ""}
        ${imageHtml}
        <div class="note-body" data-full="${encodeURIComponent(note.body || "")}">${body}</div>
        ${collapsible ? '<button class="note-more" type="button" data-expand>展开全文</button>' : ""}
      </article>`;
    }).join("");

    root.querySelectorAll("[data-expand]").forEach(button => {
      button.onclick = () => {
        const body = button.previousElementSibling;
        body.textContent = decodeURIComponent(body.dataset.full);
        button.remove();
      };
    });
  }

  async function load() {
    if (!apiReady()) {
      notes = defaults;
      render();
      return;
    }

    try {
      const response = await fetch(`${CONFIG.apiBase}/notes?limit=100`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      notes = Array.isArray(data.notes) && data.notes.length ? data.notes : defaults;
    } catch (error) {
      console.warn("Notes API unavailable, using local samples", error);
      notes = defaults;
    }
    render();
  }

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll("[data-filter]").forEach(item => item.classList.remove("is-active"));
      button.classList.add("is-active");
      activeFilter = button.dataset.filter;
      render();
    };
  });

  load();
})();
