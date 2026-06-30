const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const sharp = require(path.join(
    "C:",
    "Users",
    "admin",
    "Desktop",
    "РАЗГОВОВОРНИК",
    "ingush-phrasebook-main",
    "language-api",
    "node_modules",
    "sharp"
  ));
  const svg = fs.readFileSync(path.join(__dirname, "..", "icons", "icon.svg"));
  for (const size of [192, 512]) {
    await sharp(svg).resize(size, size).png().toFile(path.join(__dirname, "..", "icons", `icon-${size}.png`));
  }
  process.stdout.write("icons OK\n");
}

main().catch((e) => {
  process.stderr.write(e.stack + "\n");
  process.exit(1);
});
