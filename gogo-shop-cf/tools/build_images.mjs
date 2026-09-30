// 依 tools/image_map.json 產生商品圖與營養標示圖，輸出到 public/images/p/，並寫 public/images/manifest.json。
// 用法（在 gogo-shop-cf 資料夾內）：node tools/build_images.mjs "<經銷商圖檔資料夾>"
//
// image_map.json 格式：{ "品名|規格"（去空白）: { "main": 來源, "nutri": 來源 } }
// 來源可以是：
//   "src:相對於圖檔資料夾的路徑"
//   "official:搜尋關鍵字|頁面必須包含的字"   → 到 gogonuts.best 搜尋，抓商品頁的 og:image
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// 在 gogo-shop-cf 資料夾內執行（deploy.sh 會先 cd 進去）
const root = process.cwd();
const srcRoot = process.argv[2];
if (!srcRoot || !fs.existsSync(srcRoot)) {
  console.error("找不到圖檔資料夾：" + srcRoot);
  process.exit(1);
}
const map = JSON.parse(fs.readFileSync(path.join(root, "tools/image_map.json"), "utf8"));
const outDir = path.join(root, "public/images/p");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gogo-img-"));

const OFFICIAL = "https://www.gogonuts.best";
async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.text();
}
async function resolveOfficial(spec) {
  const [query, mustInclude] = spec.split("|");
  const html = await fetchText(OFFICIAL + "/products?query=" + encodeURIComponent(query));
  const links = [...new Set(html.match(/\/products\/[a-z0-9\-]+/gi) || [])];
  for (const link of links.slice(0, 8)) {
    const page = await fetchText(OFFICIAL + link);
    const title = (page.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
    if (mustInclude && !title.includes(mustInclude)) continue;
    const img = (page.match(/<meta property="og:image" content="([^"?]*)/) || [])[1];
    if (img) return { url: img, page: OFFICIAL + link, title };
  }
  throw new Error("官網找不到：" + spec);
}
async function download(url, dst) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(res.status + " " + url);
  fs.writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
}
function toJpeg(src, dst) {
  execFileSync("sips", ["-Z", "1400", "-s", "format", "jpeg", "-s", "formatOptions", "82", src, "--out", dst], { stdio: "ignore" });
}

const done = {}; // 來源 → 輸出網址（同一張圖只處理一次）
const report = { ok: 0, missing: [], official: [] };
async function build(source) {
  if (!source) return null;
  if (done[source] !== undefined) return done[source];
  const name = crypto.createHash("sha1").update(source).digest("hex").slice(0, 12) + ".jpg";
  const dst = path.join(outDir, name);
  try {
    if (source.startsWith("src:")) {
      const file = path.join(srcRoot, source.slice(4));
      if (!fs.existsSync(file)) throw new Error("檔案不存在：" + source.slice(4));
      toJpeg(file, dst);
    } else if (source.startsWith("img:")) {
      // 經銷網站上已核對品名的商品主圖，直接下載
      const imgUrl = source.slice(4);
      const tmp = path.join(tmpDir, name + (path.extname(imgUrl.split("?")[0]) || ".jpg"));
      await download(encodeURI(decodeURI(imgUrl)), tmp);
      toJpeg(tmp, dst);
      report.official.push("經銷網站 " + imgUrl);
    } else if (source.startsWith("url:")) {
      // 已人工核對過的官網商品頁，直接抓 og:image
      const page = await fetchText(source.slice(4));
      const img = (page.match(/<meta[^>]+property="og:image"[^>]+content="([^"?]+)/) ||
                   page.match(/<meta[^>]+content="([^"?]+)"[^>]+property="og:image"/) || [])[1];
      if (!img) throw new Error("頁面沒有商品圖：" + source.slice(4));
      const tmp = path.join(tmpDir, name + (path.extname(img) || ".jpg"));
      await download(img, tmp);
      toJpeg(tmp, dst);
      report.official.push(source.slice(4) + " → " + img);
    } else if (source.startsWith("official:")) {
      const found = await resolveOfficial(source.slice(9));
      const tmp = path.join(tmpDir, name + path.extname(found.url).split("?")[0]);
      await download(found.url, tmp);
      toJpeg(tmp, dst);
      report.official.push(source.slice(9) + " → " + found.title + " " + found.page);
    } else {
      throw new Error("看不懂的來源：" + source);
    }
    done[source] = "/images/p/" + name;
  } catch (err) {
    report.missing.push(String(err.message || err));
    done[source] = null;
  }
  return done[source];
}

const manifest = {};
for (const [key, entry] of Object.entries(map)) {
  const main = await build(entry.main);
  const nutri = await build(entry.nutri);
  if (main || nutri) {
    manifest[key] = {};
    if (main) manifest[key].main = main;
    if (nutri) manifest[key].nutri = nutri;
    report.ok++;
  }
}
fs.writeFileSync(path.join(root, "public/images/manifest.json"), JSON.stringify(manifest, null, 1));
fs.rmSync(tmpDir, { recursive: true, force: true });

const lines = [
  "有圖的商品：" + report.ok + " / " + Object.keys(map).length,
  "從官網抓的圖：",
  ...report.official.map((s) => "  " + s),
  "失敗：",
  ...report.missing.map((s) => "  " + s),
];
fs.writeFileSync(path.join(root, "tools/build_images_報告.txt"), lines.join("\n"));
console.log(lines.join("\n"));
