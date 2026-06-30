/**
 * Импорт Word HTML (.doc) → books/<category>/<id>/book.json
 * node scripts/import-from-doc.js <category> <id> <path-to.doc>
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDecorative(text) {
  if (!text) return true;
  if (/^_{3,}/.test(text)) return true;
  if (/^[\s_]+$/.test(text)) return true;
  return false;
}

function parseWordHtmlDoc(raw) {
  const pages = [];
  const markerRe = /<p class=pagenum[^>]*>\s*Стр\.\s*(\d+)\s*<\/p>/gi;
  const markers = [];
  let m;
  while ((m = markerRe.exec(raw)) !== null) {
    markers.push({ n: Number(m[1]), index: m.index, end: m.index + m[0].length });
  }

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].end;
    const end = i + 1 < markers.length ? markers[i + 1].index : raw.indexOf("</body>");
    const chunk = raw.slice(start, end);
    const paras = [];
    const bodyRe = /<p class=body[^>]*>([\s\S]*?)<\/p>/gi;
    let b;
    while ((b = bodyRe.exec(chunk)) !== null) {
      const text = htmlToText(b[1]);
      if (!isDecorative(text)) paras.push(text);
    }
    pages.push({ n: markers[i].n, paragraphs: paras });
  }
  return pages;
}

async function readDocText(docPath) {
  const buf = await fsp.readFile(docPath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.swap16().toString("utf16le");
  }
  return buf.toString("utf8");
}
async function main() {
  const category = process.argv[2];
  const id = process.argv[3];
  const docPath = process.argv[4];
  if (!category || !id || !docPath) {
    process.stderr.write("import-from-doc.js <category> <id> <file.doc>\n");
    process.exit(1);
  }

  const outDir = path.join(ROOT, "books", category, id);
  await fsp.mkdir(outDir, { recursive: true });

  const raw = await readDocText(docPath);
  const pages = parseWordHtmlDoc(raw);

  const metaPath = path.join(outDir, "meta.json");
  let meta = {
    id,
    category,
    title: id,
    titleIng: id,
    authorRu: "",
    translator: "",
    editor: "",
    language: "ing",
  };
  if (fs.existsSync(metaPath)) {
    meta = { ...meta, ...JSON.parse(await fsp.readFile(metaPath, "utf8")) };
  }

  const destDoc = path.join(outDir, `${id}.doc`);
  if (path.resolve(docPath) !== path.resolve(destDoc)) {
    await fsp.copyFile(docPath, destDoc);
  }

  const book = {
    ...meta,
    pageCount: pages.length,
    pages,
    files: { ...(meta.files || {}), doc: `${id}.doc` },
  };

  await fsp.writeFile(path.join(outDir, "book.json"), JSON.stringify(book, null, 2), "utf8");
  process.stdout.write(`OK ${outDir} (${pages.length} стр.)\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`);
  process.exit(1);
});
