import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const siteOrigin = "https://astrology-pro.vercel.app";
const htmlFiles = ["index.html", "privacy.html", "disclaimer.html", "learn.html", "methodology.html"];

for (const file of htmlFiles) {
  assert.ok(existsSync(file), `${file} should exist`);
  const html = readFileSync(file, "utf8");
  assert.match(html, /<meta charset="UTF-8"/u, `${file} should declare UTF-8`);
  assert.match(html, new RegExp(`<link rel="canonical" href="${siteOrigin.replaceAll(".", "\\.")}/`), `${file} should have a canonical URL`);
  assertLocalReferencesExist(file, html);
}

const sitemap = readFileSync("sitemap.xml", "utf8");
for (const file of htmlFiles) {
  const path = file === "index.html" ? "/" : `/${file}`;
  assert.ok(sitemap.includes(`<loc>${siteOrigin}${path}</loc>`), `sitemap should include ${path}`);
}

for (const loc of [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1])) {
  const url = new URL(loc);
  assert.equal(url.origin, siteOrigin, `sitemap URL should stay on ${siteOrigin}`);
  const file = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  assert.ok(existsSync(file), `sitemap target should exist: ${file}`);
}

console.log(JSON.stringify({ ok: true, checked: { htmlFiles: htmlFiles.length, sitemap: true } }, null, 2));

function assertLocalReferencesExist(file, html) {
  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/gu)].map((match) => match[1]);
  for (const reference of references) {
    const local = localReferencePath(reference);
    if (!local) continue;
    assert.ok(existsSync(local), `${file} references missing file: ${reference}`);
  }
}

function localReferencePath(reference) {
  if (
    reference.startsWith("#") ||
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("mailto:")
  ) {
    return "";
  }
  const withoutFragment = reference.split("#")[0].split("?")[0];
  const normalized = withoutFragment.replace(/^\.\//u, "").replace(/^\//u, "");
  if (!normalized) return "index.html";
  if (!extname(normalized) && !existsSync(normalized)) return `${normalized}.html`;
  return normalized;
}
