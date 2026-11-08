import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
async function walk(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...(await walk(name)));
    else if (!name.endsWith(".map")) result.push(name);
  }
  return result;
}
const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
const staticFiles = (await walk(".next/static")).map(
  (file) =>
    "/_next/static/" +
    path.relative(".next/static", file).split(path.sep).join("/"),
);
const assets = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  ...staticFiles,
].sort();
const template = await readFile("scripts/sw-template.js", "utf8");
await writeFile(
  "public/sw.js",
  template
    .replace("__CACHE_NAME__", JSON.stringify(`structure-planner-${buildId}`))
    .replace("__PRECACHE_ASSETS__", JSON.stringify(assets)),
);
console.log(
  `Offline shell: ${assets.length} public resources precached; API/auth excluded.`,
);
