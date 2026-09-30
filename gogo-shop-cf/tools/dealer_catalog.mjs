// 抓經銷網站 sell.gogonuts.best 的商品清單（品名、網址、主圖、圖庫、各規格的圖），存成 JSON 給 Claude 核對配圖
// 用法：node dealer_catalog.mjs "<輸出 JSON 路徑>"
import fs from "node:fs";

const OUT = process.argv[2] || "經銷網站商品清單.json";
const BASE = "https://sell.gogonuts.best";
const UA = { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15" } };

async function get(url) {
  const res = await fetch(url, UA);
  return { status: res.status, url: res.url, html: res.status === 200 ? await res.text() : "" };
}
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&#8211;/g, "-").replace(/<[^>]+>/g, "").trim();

// 1. 翻商品列表頁，收集商品網址
const links = new Map();
for (let page = 1; page <= 40; page++) {
  const url = page === 1 ? BASE + "/shop/" : BASE + "/shop/page/" + page + "/";
  const r = await get(url);
  if (r.status !== 200) { console.log("列表第 " + page + " 頁：" + r.status + "（結束）"); break; }
  if (/my-account|wp-login/.test(r.url)) { console.log("⚠️ 被導到登入頁：" + r.url); break; }
  const before = links.size;
  for (const m of r.html.matchAll(/<a[^>]+href="(https:\/\/sell\.gogonuts\.best\/product\/[^"#?]+)"/g)) links.set(m[1], true);
  console.log("列表第 " + page + " 頁，累計 " + links.size + " 個商品");
  if (links.size === before) break;
}

// 2. 逐一讀商品頁
const items = [];
let n = 0;
for (const url of links.keys()) {
  n++;
  try {
    const r = await get(url);
    const h = r.html;
    const title = decode((h.match(/<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/) || h.match(/<title>([^<]*)/) || [])[1]);
    const og = (h.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || "";
    const gallery = [...h.matchAll(/data-large_image="([^"]+)"/g)].map((m) => m[1]);
    let variations = [];
    const vj = (h.match(/data-product_variations="([^"]+)"/) || [])[1];
    if (vj && vj !== "false") {
      try {
        variations = JSON.parse(vj.replace(/&quot;/g, '"').replace(/&amp;/g, "&")).map((v) => ({
          attrs: Object.values(v.attributes || {}).map(decodeURIComponent).join(" / "),
          image: (v.image && (v.image.full_src || v.image.src)) || "",
          inStock: !!v.is_in_stock,
        }));
      } catch (e) { variations = [{ error: "規格資料解析失敗" }]; }
    }
    items.push({ title, url, status: r.status, og, gallery: [...new Set(gallery)], variations });
  } catch (e) {
    items.push({ url, error: String(e.message || e) });
  }
  if (n % 20 === 0) console.log("商品頁 " + n + " / " + links.size);
}
fs.writeFileSync(OUT, JSON.stringify(items, null, 1));
console.log("完成，共 " + items.length + " 個商品：" + OUT);
