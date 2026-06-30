/**
 * Импорт book.txt → books/<category>/<id>/book.json
 * node scripts/import-book.js <category> <id> <path-to-book.txt>
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function parseBookTxt(text) {
  const pages = [];
  let current = null;
  let buf = [];

  function flush() {
    if (!current) return;
    const paras = buf
      .map((s) => s.trim())
      .filter((s) => s && !/^_{3,}/.test(s) && !/^[\s_]+$/.test(s));
    if (paras.length || current) pages.push({ n: current, paragraphs: paras });
    buf = [];
  }

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^Стр\.\s*(\d+)\s*$/);
    if (m) {
      flush();
      current = Number(m[1]);
      continue;
    }
    if (line.trim() === "[рамка]" || line.includes("декоративная")) {
      continue;
    }
    if (current != null) buf.push(line);
  }
  flush();
  return pages;
}

async function main() {
  const category = process.argv[2];
  const id = process.argv[3];
  const txtPath = process.argv[4];
  if (!category || !id || !txtPath) {
    process.stderr.write("import-book.js <category> <id> <book.txt>\n");
    process.exit(1);
  }

  const outDir = path.join(ROOT, "books", category, id);
  await fsp.mkdir(outDir, { recursive: true });

  const text = await fsp.readFile(txtPath, "utf8");
  const pages = parseBookTxt(text);

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

  const book = {
    ...meta,
    pageCount: pages.length,
    pages,
    files: meta.files || {},
  };

  await fsp.writeFile(path.join(outDir, "book.json"), JSON.stringify(book, null, 2), "utf8");
  process.stdout.write(`OK ${outDir} (${pages.length} стр.)\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.stack}\n`);
  process.exit(1);
});
