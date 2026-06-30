/**
 * Картинки для читалки из ashik-kerib.pdf (экспорт Word) → images/ + book.json
 * node scripts/attach-reader-images.js
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pdf } = require("pdf-to-img");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const category = process.argv[2] || "skazki";
const bookId = process.argv[3] || "ashik-kerib";
const BOOK_DIR = path.join(ROOT, "books", category, bookId);
const PDF_PATH = path.join(BOOK_DIR, `${bookId}.pdf`);

async function main() {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF не найден: ${PDF_PATH}`);

  const bookJson = JSON.parse(await fsp.readFile(path.join(BOOK_DIR, "book.json"), "utf8"));
  const pages = bookJson.pages || [];
  const imgDir = path.join(BOOK_DIR, "images");
  await fsp.mkdir(imgDir, { recursive: true });

  const pdfPages = [];
  const doc = await pdf(PDF_PATH, { scale: 2 });
  for await (const img of doc) pdfPages.push(img);

  // PDF: стр. 1 — обложка, далее 1:1 с book.json
  const offset = pdfPages.length > pages.length ? 1 : 0;

  for (const page of pages) {
    const pdfIdx = page.n - 1 + offset;
    const buf = pdfPages[pdfIdx];
    if (!buf) continue;

    const name = `page-${String(page.n).padStart(2, "0")}.jpg`;
    const jpg = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
    await fsp.writeFile(path.join(imgDir, name), jpg);
    page.image = `images/${name}`;
    process.stdout.write(`  стр. ${page.n} ← PDF ${pdfIdx + 1}\n`);
  }

  await fsp.writeFile(path.join(BOOK_DIR, "book.json"), JSON.stringify(bookJson, null, 2), "utf8");
  process.stdout.write(`OK: ${pages.length} стр.\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`);
  process.exit(1);
});
