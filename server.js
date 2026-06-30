const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const express = require("express");
const multer = require("multer");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3088;
const ADMIN_PASSWORD = process.env.WAYBOOK_ADMIN_PASSWORD || "123456789";
const CATALOG_PATH = path.join(ROOT, "data", "catalog.json");

fs.mkdirSync(path.join(ROOT, "data", "uploads"), { recursive: true });

const sessions = new Map();
const upload = multer({ dest: path.join(ROOT, "data", "uploads") });

const app = express();
app.use(express.json({ limit: "2mb" }));

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    return res.status(401).json({ error: "Требуется вход" });
  }
  next();
}

function slug(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

async function readCatalog() {
  return JSON.parse(await fsp.readFile(CATALOG_PATH, "utf8"));
}

async function writeCatalog(catalog) {
  await fsp.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");
}

function defaultCoverSvg(title) {
  const t = (title || "Книга").slice(0, 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="144" viewBox="0 0 112 144">
  <rect width="112" height="144" rx="6" fill="#e8f0ea" stroke="#c8bdb0"/>
  <text x="56" y="78" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#2d5a3d">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
</svg>`;
}

async function saveUploaded(file, destPath) {
  if (!file) return false;
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await fsp.rename(file.path, destPath);
  return true;
}

async function processBookUpload(body, files) {
  const category = slug(body.category);
  const id = slug(body.id);
  if (!category || !id) throw new Error("Укажите раздел и id книги");
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("id: только латиница, цифры и дефис");

  const bookDir = path.join(ROOT, "books", category, id);
  await fsp.mkdir(bookDir, { recursive: true });

  const meta = {
    id,
    category,
    title: body.title || id,
    titleIng: body.titleIng || body.title || id,
    authorRu: body.authorRu || "",
    translator: body.translator || "",
    editor: body.editor || "",
    description: body.description || "",
    language: body.language || "ing",
    files: {},
  };

  const content = files.content?.[0];
  const pdfFile = files.pdf?.[0];
  const docDownload = files.doc?.[0];
  const coverFile = files.cover?.[0];

  let imported = false;

  if (content) {
    const ext = path.extname(content.originalname || "").toLowerCase();
    if (ext === ".doc") {
      const dest = path.join(bookDir, `${id}.doc`);
      await saveUploaded(content, dest);
      meta.files.doc = `${id}.doc`;
      execFileSync("node", ["scripts/import-from-doc.js", category, id, dest], {
        cwd: ROOT,
        stdio: "pipe",
      });
    } else {
      const dest = path.join(bookDir, "book.txt");
      await saveUploaded(content, dest);
      await fsp.writeFile(path.join(bookDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
      execFileSync("node", ["scripts/import-book.js", category, id, dest], {
        cwd: ROOT,
        stdio: "pipe",
      });
    }
    imported = true;
  }

  if (!imported && docDownload) {
    const dest = path.join(bookDir, `${id}.doc`);
    await saveUploaded(docDownload, dest);
    meta.files.doc = `${id}.doc`;
    execFileSync("node", ["scripts/import-from-doc.js", category, id, dest], {
      cwd: ROOT,
      stdio: "pipe",
    });
    imported = true;
  }

  if (!imported) throw new Error("Загрузите book.txt или .doc с текстом");

  if (docDownload && !meta.files.doc) {
    const dest = path.join(bookDir, `${id}.doc`);
    await saveUploaded(docDownload, dest);
    meta.files.doc = `${id}.doc`;
  } else if (docDownload && content && path.extname(content.originalname || "").toLowerCase() !== ".doc") {
    const dest = path.join(bookDir, `${id}.doc`);
    await fsp.copyFile(docDownload.path, dest).catch(async () => {
      await saveUploaded(docDownload, dest);
    });
    meta.files.doc = `${id}.doc`;
  }

  if (pdfFile) {
    const dest = path.join(bookDir, `${id}.pdf`);
    await saveUploaded(pdfFile, dest);
    meta.files.pdf = `${id}.pdf`;
    execFileSync("node", ["scripts/attach-reader-images.js", category, id], {
      cwd: ROOT,
      stdio: "pipe",
    });
  }

  const coverDest = path.join(bookDir, "cover.svg");
  if (coverFile) {
    const ext = path.extname(coverFile.originalname || "").toLowerCase();
    const coverName = ext === ".svg" ? "cover.svg" : `cover${ext || ".png"}`;
    await saveUploaded(coverFile, path.join(bookDir, coverName));
  } else if (!fs.existsSync(coverDest)) {
    await fsp.writeFile(coverDest, defaultCoverSvg(meta.title), "utf8");
  }

  await fsp.writeFile(path.join(bookDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  const bookJsonPath = path.join(bookDir, "book.json");
  if (fs.existsSync(bookJsonPath)) {
    const book = JSON.parse(await fsp.readFile(bookJsonPath, "utf8"));
    Object.assign(book, meta, { files: { ...book.files, ...meta.files } });
    await fsp.writeFile(bookJsonPath, JSON.stringify(book, null, 2), "utf8");
  }

  const catalog = await readCatalog();
  const coverPath = `books/${category}/${id}/${fs.existsSync(path.join(bookDir, "cover.svg")) ? "cover.svg" : "cover.png"}`;
  const entry = {
    id,
    category,
    title: meta.title,
    titleIng: meta.titleIng,
    authorRu: meta.authorRu,
    translator: meta.translator,
    editor: meta.editor,
    description: meta.description,
    language: meta.language,
    path: `books/${category}/${id}`,
    cover: coverPath,
    files: {
      ...(meta.files.doc ? { doc: `books/${category}/${id}/${meta.files.doc}` } : {}),
      ...(meta.files.pdf ? { pdf: `books/${category}/${id}/${meta.files.pdf}` } : {}),
    },
  };

  const idx = catalog.books.findIndex((b) => b.id === id && b.category === category);
  if (idx >= 0) catalog.books[idx] = entry;
  else catalog.books.push(entry);
  await writeCatalog(catalog);

  return { id, category, path: entry.path };
}

app.get("/api/health", (req, res) => {
  res.json({ app: "waybook-server", admin: true });
});

app.post("/api/admin/login", (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Неверный пароль" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  res.json({ token });
});

app.get("/api/admin/me", auth, (req, res) => {
  res.json({ ok: true });
});

app.get("/api/admin/catalog", auth, async (req, res) => {
  try {
    res.json(await readCatalog());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(
  "/api/admin/books",
  auth,
  upload.fields([
    { name: "content", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
    { name: "doc", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const result = await processBookUpload(req.body, req.files || {});
      res.json({ ok: true, book: result });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  }
);

app.delete("/api/admin/books/:category/:id", auth, async (req, res) => {
  try {
    const category = slug(req.params.category);
    const id = slug(req.params.id);
    const bookDir = path.join(ROOT, "books", category, id);
    if (fs.existsSync(bookDir)) {
      await fsp.rm(bookDir, { recursive: true, force: true });
    }
    const catalog = await readCatalog();
    catalog.books = catalog.books.filter((b) => !(b.id === id && b.category === category));
    await writeCatalog(catalog);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(ROOT));

app.listen(PORT, () => {
  process.stdout.write(`WayBook: http://localhost:${PORT}\nАдмин: http://localhost:${PORT}/admin.html\n`);
});
