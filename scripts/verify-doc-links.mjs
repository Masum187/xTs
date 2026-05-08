import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const markdownFiles = [];
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const missing = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".md")) {
      markdownFiles.push(full);
    }
  }
}

function normalizeLink(raw) {
  const trimmed = raw.trim();
  const withoutTitle = trimmed.split(/\s+(?=(?:"|'))/)[0] ?? trimmed;
  return withoutTitle.replace(/^<|>$/g, "");
}

walk(root);

for (const file of markdownFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = linkPattern.exec(content))) {
    const target = normalizeLink(match[1]);
    if (!target || target.startsWith("#")) continue;
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith("mailto:")) continue;

    const cleanTarget = target.split("#")[0].split(":").slice(0, -1).join(":") || target.split("#")[0];
    if (!cleanTarget) continue;

    const resolved = path.isAbsolute(cleanTarget)
      ? cleanTarget
      : path.resolve(path.dirname(file), cleanTarget);

    if (!fs.existsSync(resolved)) {
      missing.push(`${path.relative(root, file)} -> ${target}`);
    }
  }
}

if (missing.length) {
  console.error("Missing markdown link targets:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} markdown files.`);

