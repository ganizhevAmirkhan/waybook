const TOKEN_KEY = "waybook_admin_token";

function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(t) {
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, { ...options, headers });
  let data = {};
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Сервер без API. Закройте старое окно и запустите start-web.bat");
    }
    throw new Error(data.error || res.statusText || "Ошибка");
  }
  return data;
}

function showMsg(el, text, ok) {
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("ok", !!ok);
  el.classList.toggle("err", !ok);
}

function showPanel(loggedIn) {
  document.getElementById("login-panel").hidden = loggedIn;
  document.getElementById("admin-panel").hidden = !loggedIn;
}

async function loadCatalog() {
  const catalog = await api("/api/admin/catalog");
  const sel = document.getElementById("category");
  sel.innerHTML = catalog.categories
    .map((c) => `<option value="${c.id}">${c.title}</option>`)
    .join("");

  const list = document.getElementById("book-list");
  if (!catalog.books.length) {
    list.innerHTML = "<li class='empty'>Пока нет книг</li>";
    return;
  }
  list.innerHTML = catalog.books
    .map(
      (b) => `
    <li class="admin-book-item">
      <div>
        <strong>${escapeHtml(b.title)}</strong>
        <span class="meta">${escapeHtml(b.category)} / ${escapeHtml(b.id)}</span>
      </div>
      <button type="button" class="admin-btn danger" data-cat="${escapeHtml(b.category)}" data-id="${escapeHtml(b.id)}">Удалить</button>
    </li>`
    )
    .join("");

  list.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Удалить «${btn.dataset.id}»?`)) return;
      try {
        await api(`/api/admin/books/${btn.dataset.cat}/${btn.dataset.id}`, { method: "DELETE" });
        await loadCatalog();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("login-msg");
  try {
    const { token: t } = await api("/api/admin/login", {
      method: "POST",
      body: { password: document.getElementById("password").value },
    });
    setToken(t);
    showPanel(true);
    await loadCatalog();
    msg.hidden = true;
  } catch (err) {
    showMsg(msg, err.message || "Ошибка входа", false);
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  setToken(null);
  showPanel(false);
});

document.getElementById("upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("upload-msg");
  const btn = document.getElementById("btn-upload");
  btn.disabled = true;
  msg.hidden = true;

  const form = e.target;
  const fd = new FormData(form);

  try {
    await api("/api/admin/books", { method: "POST", body: fd });
    showMsg(msg, "Книга загружена!", true);
    form.reset();
    await loadCatalog();
  } catch (err) {
    showMsg(msg, err.message || "Ошибка загрузки", false);
  } finally {
    btn.disabled = false;
  }
});

async function init() {
  try {
    const h = await fetch("/api/health");
    if (!h.ok) throw new Error("no api");
    const info = await h.json();
    if (info.app !== "waybook-server") throw new Error("wrong server");
  } catch {
    showMsg(
      document.getElementById("login-msg"),
      "Запустите start-web.bat (не npx serve). Закройте старое чёрное окно и откройте заново.",
      false
    );
    showPanel(false);
    return;
  }

  if (!token()) {
    showPanel(false);
    return;
  }
  try {
    await api("/api/admin/me");
    showPanel(true);
    await loadCatalog();
  } catch {
    setToken(null);
    showPanel(false);
  }
}

init();
