const params = new URLSearchParams(location.search);
const category = params.get("category") || "skazki";
const bookId = params.get("id") || "ashik-kerib";

let book = null;
let pageIndex = 0;
let fontSize = 1.05;

async function loadBook() {
  const res = await fetch(`./books/${category}/${bookId}/book.json`);
  if (!res.ok) throw new Error("Книга не найдена");
  book = await res.json();
}

function renderToolbar() {
  const tb = document.getElementById("toolbar");
  const files = book.files || {};
  const base = `./books/${category}/${bookId}/`;
  let html = "";

  if (files.doc) {
    html += `<a class="btn" href="${base}${files.doc}" download>📄 Word</a>`;
  }
  if (files.pdf) {
    html += `<a class="btn" href="${base}${files.pdf}" download>📕 PDF</a>`;
  }
  html += `<button type="button" id="btn-smaller">А−</button>`;
  html += `<button type="button" id="btn-bigger">А+</button>`;

  tb.innerHTML = html;

  document.getElementById("btn-smaller")?.addEventListener("click", () => {
    fontSize = Math.max(0.85, fontSize - 0.1);
    document.getElementById("page-body").style.fontSize = fontSize + "rem";
  });
  document.getElementById("btn-bigger")?.addEventListener("click", () => {
    fontSize = Math.min(1.5, fontSize + 0.1);
    document.getElementById("page-body").style.fontSize = fontSize + "rem";
  });
  layoutReaderTop();
}

function renderPage() {
  const pages = book.pages || [];
  const p = pages[pageIndex];
  if (!p) return;

  document.getElementById("book-title").textContent = book.title || bookId;
  document.getElementById("page-label").textContent = `Стр. ${p.n}`;
  document.getElementById("page-num").textContent = `${pageIndex + 1} / ${pages.length}`;

  const body = document.getElementById("page-body");
  const base = `./books/${category}/${bookId}/`;
  let html = "";

  if (p.image) {
    html += `<figure class="page-figure"><img src="${base}${encodeURI(p.image)}" alt=""></figure>`;
  }

  if (p.paragraphs?.length) {
    html += p.paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join("");
  } else if (!p.image) {
    html += "<p><i>Декоративная страница</i></p>";
  }

  body.innerHTML = html;
  body.classList.remove("page-view");
  body.style.fontSize = fontSize + "rem";

  document.getElementById("btn-prev").disabled = pageIndex <= 0;
  document.getElementById("btn-next").disabled = pageIndex >= pages.length - 1;
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function layoutReaderTop() {
  const top = document.getElementById("reader-top");
  if (!top) return;
  const h = top.offsetHeight;
  document.documentElement.style.setProperty("--reader-top-h", h + "px");
}

window.addEventListener("resize", layoutReaderTop);

document.getElementById("btn-back").addEventListener("click", () => {
  location.href = "./index.html";
});

document.getElementById("btn-prev").addEventListener("click", () => {
  if (pageIndex > 0) {
    pageIndex -= 1;
    renderPage();
    window.scrollTo(0, 0);
  }
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (book && pageIndex < book.pages.length - 1) {
    pageIndex += 1;
    renderPage();
    window.scrollTo(0, 0);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") document.getElementById("btn-prev").click();
  if (e.key === "ArrowRight") document.getElementById("btn-next").click();
});

loadBook()
  .then(() => {
    layoutReaderTop();
    renderToolbar();
    renderPage();
  })
  .catch(() => {
    document.getElementById("page-body").innerHTML =
      "<p>Не удалось загрузить книгу. Проверьте файл book.json</p>";
  });
