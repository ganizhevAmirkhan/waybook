/**
 * Обновить книгу из Word (.doc / .docx): PDF + картинки для читалки
 * node scripts/sync-from-word.js [путь-к-файлу]
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BOOK_DIR = path.join(ROOT, "books", "skazki", "ashik-kerib");
const DEFAULT_DOC = path.join(
  process.env.USERPROFILE || "",
  "Desktop",
  "Ашик-Кериб-инг-книга.doc"
);

const docPath = path.resolve(process.argv[2] || DEFAULT_DOC);
if (!fs.existsSync(docPath)) {
  process.stderr.write(`Файл не найден: ${docPath}\n`);
  process.exit(1);
}

const pdfPath = path.join(BOOK_DIR, "ashik-kerib.pdf");
const outDoc = path.join(BOOK_DIR, "ashik-kerib.doc");

const ps = `
$docPath = ${JSON.stringify(docPath)}
$pdfPath = ${JSON.stringify(pdfPath)}
$outDoc = ${JSON.stringify(outDoc)}
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open($docPath)
$doc.ExportAsFixedFormat($pdfPath, 17)
$doc.SaveAs2($outDoc, 0)
$doc.Close($false)
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Output "Word OK"
`;

execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
execFileSync("node", [path.join(__dirname, "attach-reader-images.js")], {
  cwd: ROOT,
  stdio: "inherit",
});
process.stdout.write(`\nГотово: ${outDoc}\n       ${pdfPath}\n`);
