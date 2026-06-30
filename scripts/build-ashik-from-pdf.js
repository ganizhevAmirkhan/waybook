/**
 * Картинки из PDF → images/ + book.json + ashik-kerib.doc (base64, работает без .files)
 * node scripts/build-ashik-from-pdf.js
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BOOK_DIR = path.join(ROOT, "books", "skazki", "ashik-kerib");
const PDF =
  process.env.ASHIK_PDF ||
  "c:\\Users\\admin\\Documents\\ОСР\\Г1алг1ай  лекции\\Ашик-Кериб (Лермонтов).pdf";
const { pdf } = require("pdf-to-img");
const sharp = require("sharp");

function esc(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mapBookToPdf(bookPage) {
  const pdfPage = Math.max(2, Math.floor((bookPage + 4) / 2));
  const side = bookPage % 2 === 0 ? "left" : "right";
  return { pdfPage, side };
}

async function splitHalf(buf, side) {
  const meta = await sharp(buf).metadata();
  const halfW = Math.floor(meta.width / 2);
  const extract =
    side === "left"
      ? { left: 0, top: 0, width: halfW, height: meta.height }
      : { left: halfW, top: 0, width: meta.width - halfW, height: meta.height };
  return sharp(buf).extract(extract).jpeg({ quality: 88 }).toBuffer();
}

async function loadPdfPages(scale, fromPdf, toPdf) {
  const cache = new Map();
  const doc = await pdf(PDF, { scale });
  let n = 0;
  for await (const img of doc) {
    n += 1;
    if (n >= fromPdf && n <= toPdf) cache.set(n, img);
    if (n > toPdf) break;
  }
  return cache;
}

function toUtf16Doc(html) {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(html, "utf16le")]);
}

async function main() {
  if (!fs.existsSync(PDF)) throw new Error(`PDF не найден: ${PDF}`);

  const bookJson = JSON.parse(await fsp.readFile(path.join(BOOK_DIR, "book.json"), "utf8"));
  const pages = bookJson.pages || [];
  const imgDir = path.join(BOOK_DIR, "images");
  await fsp.mkdir(imgDir, { recursive: true });

  const pdfNeeded = new Set();
  for (const p of pages) pdfNeeded.add(mapBookToPdf(p.n).pdfPage);
  const minPdf = Math.min(...pdfNeeded, 2);
  const maxPdf = Math.max(...pdfNeeded, 18);

  process.stdout.write(`PDF ${minPdf}–${maxPdf}…\n`);
  const pdfCache = await loadPdfPages(3, minPdf, maxPdf);
  const halfCache = new Map();

  for (const pdfPage of pdfNeeded) {
    const buf = pdfCache.get(pdfPage);
    if (!buf) continue;
    for (const side of ["left", "right"]) {
      halfCache.set(`${pdfPage}-${side}`, await splitHalf(buf, side));
    }
  }

  const docBlocks = [];
  for (const page of pages) {
    const { pdfPage, side } = mapBookToPdf(page.n);
    const half = halfCache.get(`${pdfPage}-${side}`);
    let imageFile = null;
    let imageB64 = null;

    if (half) {
      const name = `page-${String(page.n).padStart(2, "0")}.jpg`;
      await fsp.writeFile(path.join(imgDir, name), half);
      imageFile = `images/${name}`;
      imageB64 = half.toString("base64");
      page.image = imageFile;
      process.stdout.write(`  стр. ${page.n}: ${name}\n`);
    }

    const paras = (page.paragraphs || [])
      .map((t) => `<p class=body>${esc(t)}</p>`)
      .join("\n");
    const imgHtml = imageB64
      ? `<p class=body align=center><img width="100%" src="data:image/jpeg;base64,${imageB64}"></p>`
      : "";

    docBlocks.push(`
<p class=pagenum align=center>Стр. ${page.n}</p>
${imgHtml}
${paras}`);
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset=utf-8>
<meta name=ProgId content=Word.Document>
<title>Ашик-Кериб</title>
<style>
p.body { font-family: Georgia, serif; font-size: 12pt; text-align: justify; margin: 0 0 9pt 0; line-height: 1.55; }
p.pagenum { text-align: center; font-size: 10pt; color: #666; margin: 0 0 14pt 0; }
p.titlemain { font-family: Georgia, serif; font-size: 22pt; text-align: center; }
p.titlesub { font-family: Georgia, serif; font-size: 13pt; text-align: center; color: #333; }
p.credit { text-align: center; font-size: 11pt; color: #444; }
</style>
</head>
<body lang=RU>
<p class=titlemain>АШИК-КЕРИБ</p>
<p class=titlesub>Ингушский перевод повести М.&nbsp;Ю.&nbsp;Лермонтов</p>
<p class=credit>Перевод: <b>С.&nbsp;Озиев</b></p>
<p class=credit>Доработано: <b>Ганижев&nbsp;А.&nbsp;А.</b></p>
<hr>
${docBlocks.join("\n<hr>\n")}
</body>
</html>`;

  await fsp.writeFile(path.join(BOOK_DIR, "ashik-kerib.doc"), toUtf16Doc(html));
  bookJson.files = { ...(bookJson.files || {}), doc: "ashik-kerib.doc" };
  await fsp.writeFile(path.join(BOOK_DIR, "book.json"), JSON.stringify(bookJson, null, 2), "utf8");

  process.stdout.write(`OK: ${pages.length} стр., doc с встроенными картинками\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`);
  process.exit(1);
});
