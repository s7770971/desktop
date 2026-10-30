// 抓經銷網站 sell.gogonuts.best 的商品清單：品名、網址、價格、庫存狀態、各規格（口味）的庫存與價格、主圖
// 存成 JSON 給 Claude 跟賣場商品清單比對
// 用法：node dealer_catalog.mjs "<輸出 JSON 路徑>"
import fs from "node:fs";

const OUT = process.argv[2] || "經銷網站商品清單.json";
const BASE = "https://sell.gogonuts.best";
// 有登入跟沒登入看到的價格不同：要看登入後的經銷價，執行時帶 COOKIE="$(pbpaste)"（先從瀏覽器複製登入後的 cookie）
const COOKIE = (process.env.COOKIE || "").replace(/^cookie:\s*/i, "").trim();
const UA = { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15", ...(COOKIE ? { cookie: COOKIE } : {}) } };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, UA);
      return { status: res.status, url: res.url, html: res.status === 200 ? await res.text() : "" };
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;/g, '"')
  .replace(/&#8211;/g, "-").replace(/&nbsp;/g, " ").replace(/&#36;|&#x24;/g, "$").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 1. 翻商品列表頁，收集商品網址
const links = new Map();
let loginWall = false, loggedIn = false;
for (let page = 1; page <= 60; page++) {
  const url = page === 1 ? BASE + "/shop/" : BASE + "/shop/page/" + page + "/";
  const r = await get(url);
  if (r.status !== 200) { console.log("列表第 " + page + " 頁：" + r.status + "（結束）"); break; }
  if (/my-account|wp-login/.test(r.url)) { console.log("⚠️ 被導到登入頁：" + r.url); loginWall = true; break; }
  if (page === 1) {
    loggedIn = /<body[^>]+class="[^"]*\blogged-in\b/.test(r.html);
    console.log(loggedIn ? "✅ 已用登入身分讀取（看到的是登入後的價格）" : COOKIE ? "⚠️ 有帶 cookie 但網站沒認出登入，可能 cookie 複製不完整或已過期" : "目前是「沒登入」身分（看到的是沒登入的價格）");
  }
  const before = links.size;
  for (const m of r.html.matchAll(/<a[^>]+href="(https:\/\/sell\.gogonuts\.best\/product\/[^"#?]+)"/g)) links.set(m[1], true);
  console.log("列表第 " + page + " 頁，累計 " + links.size + " 個商品");
  if (links.size === before) break;
}

// 2. 逐一讀商品頁（同時 4 個）
async function readProduct(url) {
  const r = await get(url);
  const h = r.html;
  if (!h) return { url, status: r.status, error: "讀不到頁面" };
  const title = decode((h.match(/<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/) || h.match(/<title>([^<]*)/) || [])[1]);
  // 商品主區塊的 class 會寫 instock / outofstock / onbackorder
  const mainCls = (h.match(/<div[^>]+id="product-\d+"[^>]+class="([^"]+)"/) || h.match(/<div[^>]+class="([^"]*\btype-product\b[^"]*)"/) || [])[1] || "";
  const stockClass = /\boutofstock\b/.test(mainCls) ? "缺貨" : /\bonbackorder\b/.test(mainCls) ? "預購" : /\binstock\b/.test(mainCls) ? "有貨" : "看不出來";
  const stockText = decode((h.match(/<p[^>]+class="stock[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1]);
  const price = decode((h.match(/<p[^>]+class="price[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1]);
  const cats = [...(h.match(/<span class="posted_in">([\s\S]*?)<\/span>/) || ["", ""])[1].matchAll(/>([^<]+)<\/a>/g)].map((m) => decode(m[1]));
  const og = (h.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || "";
  let variations = null, variationNote = "";
  const vj = (h.match(/data-product_variations="([^"]*)"/) || [])[1];
  if (vj === "false") variationNote = "規格太多，頁面沒有直接列出各規格庫存（要點選才看得到）";
  else if (vj) {
    try {
      variations = JSON.parse(vj.replace(/&quot;/g, '"').replace(/&amp;/g, "&")).map((v) => ({
        attrs: Object.values(v.attributes || {}).map((a) => { try { return decodeURIComponent(a); } catch { return a; } }).join(" / "),
        inStock: !!v.is_in_stock,
        purchasable: v.is_purchasable !== false,
        maxQty: v.max_qty === "" ? null : v.max_qty,
        price: v.display_price,
        regular: v.display_regular_price,
        availability: decode(v.availability_html),
        image: (v.image && (v.image.full_src || v.image.src)) || "",
      }));
    } catch (e) { variationNote = "規格資料解析失敗"; }
  }
  // 規格下拉選單的選項文字（對照用）
  const options = [...h.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => decode(m[2])).filter((t) => !/選擇|Choose/.test(t));
  return { title, url, status: r.status, stockClass, stockText, price, cats, og, options: [...new Set(options)], variations, variationNote };
}

const urls = [...links.keys()];
const items = [];
let done = 0;
async function worker() {
  while (urls.length) {
    const url = urls.shift();
    try { items.push(await readProduct(url)); } catch (e) { items.push({ url, error: String(e.message || e) }); }
    if (++done % 20 === 0) console.log("商品頁 " + done + " / " + links.size);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
items.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-Hant"));
fs.writeFileSync(OUT, JSON.stringify({ scannedAt: new Date().toISOString(), loggedIn, loginWall, count: items.length, items }, null, 1));
const out = items.filter((i) => i.stockClass === "缺貨").length;
const vOut = items.reduce((n, i) => n + (i.variations || []).filter((v) => !v.inStock).length, 0);
console.log("完成：共 " + items.length + " 個商品，整個缺貨 " + out + " 個，另有 " + vOut + " 個口味／規格缺貨。檔案：" + OUT);
