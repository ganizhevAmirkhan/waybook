let catalog = null;
let activeCategory = "all";

async function loadCatalog() {
  const res = await fetch("./data/catalog.json");
  catalog = await res.json();
}

function renderCategories() {
  const el = document.getElementById("categories");
  const items = [
    { id: "all", title: "Все", icon: "🏠" },
    ...catalog.categories,
  ];
  el.innerHTML = items
    .map(
      (c) => `
    <button type="button" class="cat-btn${activeCategory === c.id ? " active" : ""}" data-cat="${c.id}">
      <span class="icon">${c.icon}</span>
      <span class="label">${c.title}</span>
    </button>`
    )
    .join("");

  el.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderBooks();
    });
  });
}

function renderBooks() {
  const list = document.getElementById("book-list");
  const title = document.getElementById("section-title");
  const books =
    activeCategory === "all"
      ? catalog.books
      : catalog.books.filter((b) => b.category === activeCategory);

  const catTitle =
    activeCategory === "all"
      ? "Все книги"
      : catalog.categories.find((c) => c.id === activeCategory)?.title || "";

  title.textContent = catTitle;

  if (!books.length) {
    list.innerHTML = '<p class="empty">В этом разделе пока нет книг</p>';
    return;
  }

  list.innerHTML = books
    .map(
      (b) => `
    <article class="book-card" data-id="${b.id}" data-cat="${b.category}">
      <div class="book-cover">${escapeHtml(b.titleIng || b.title)}</div>
      <div class="book-info">
        <h3>${escapeHtml(b.title)}</h3>
        <div class="meta">${escapeHtml(b.authorRu || "")}${b.translator ? " · пер. " + escapeHtml(b.translator) : ""}</div>
        <div class="desc">${escapeHtml(b.description || "")}</div>
      </div>
    </article>`
    )
    .join("");

  list.querySelectorAll(".book-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const cat = card.dataset.cat;
      location.href = `reader.html?category=${encodeURIComponent(cat)}&id=${encodeURIComponent(id)}`;
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

async function init() {
  await loadCatalog();
  renderCategories();
  renderBooks();

  const hint = document.getElementById("install-hint");
  if (window.matchMedia("(display-mode: standalone)").matches) {
    hint.hidden = true;
  } else {
    hint.hidden = false;
  }
}

init().catch((e) => {
  document.getElementById("book-list").innerHTML =
    '<p class="empty">Ошибка загрузки каталога</p>';
  console.error(e);
});
