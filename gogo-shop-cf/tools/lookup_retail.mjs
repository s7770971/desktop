// 到果果官網 gogonuts.best 查「原價」，輸出報告給 Claude 核對（不會自動寫進試算表）
// 用法：node lookup_retail.mjs "<輸出 CSV 路徑>"
import fs from "node:fs";

const OUT = process.argv[2] || "官網原價查詢.csv";
const SITE = "https://www.gogonuts.best";
// [編號, 試算表品名, 搜尋關鍵字]
const ITEMS = [
  [121, "植物蛋白-印度拉茶 盒裝", "植物蛋白 印度拉茶"], [122, "植物蛋白-太妃糖湖鹽 盒裝", "植物蛋白 太妃糖湖鹽"],
  [123, "植物蛋白-日式抹茶 盒裝", "植物蛋白 日式抹茶"], [124, "植物蛋白-榛實核桃 盒裝", "植物蛋白 榛實核桃"],
  [125, "植物蛋白-研磨芝麻 盒裝", "植物蛋白 研磨芝麻"], [126, "植物蛋白-純粹可可 盒裝", "植物蛋白 純粹可可"],
  [127, "植物蛋白-花生可可 盒裝", "植物蛋白 花生可可"], [128, "植物蛋白-莊園瑪黛 盒裝", "植物蛋白 莊園瑪黛"],
  [129, "植物蛋白-蔬服綠拿鐵 盒裝", "植物蛋白 蔬服綠拿鐵"], [130, "植物蛋白-醇厚米漿 盒裝", "植物蛋白 醇厚米漿"],
  [131, "植物蛋白-金沙芝麻 盒裝", "植物蛋白 金沙芝麻"],
  [147, "PRO EAAs-梅子綠茶", "EAAs 梅子綠茶"], [148, "PRO EAAs-莓果爆擊", "EAAs 莓果爆擊"], [149, "PRO EAAs-蜜桃鐵觀音", "EAAs 蜜桃鐵觀音"],
  [161, "輔酵素 Q10", "Q10"], [162, "麩醯胺酸+維生素D3", "麩醯胺酸"],
  [163, "無調味綜合堅果 30g", "無調味綜合堅果"],
  [164, "燕麥脆片-伯爵厚奶", "燕麥脆片 伯爵厚奶"], [165, "燕麥脆片-纖脆可可", "燕麥脆片 纖脆可可"],
  [166, "燕麥脆片-酥烤海苔", "燕麥脆片 酥烤海苔"], [167, "燕麥脆片-醇黑芝麻", "燕麥脆片 醇黑芝麻"],
  [168, "燕麥脆片-金沙鹹蛋", "燕麥脆片 金沙鹹蛋"],
  [172, "蛋白香酥脆-朱雀辛咖哩", "朱雀辛咖"],
  [175, "麥脆朵朵-濃布朗尼", "麥脆朵朵 濃布朗尼"], [176, "麥脆朵朵-黑糖肉桂", "麥脆朵朵 黑糖肉桂"],
  [183, "燕麥脆片 50包", "燕麥脆片 50"], [188, "麥脆朵朵 50包", "麥脆朵朵 50"],
  [190, "Blender Bottle 316 不鏽鋼彈簧球", "彈簧球"],
  [195, "Blender Bottle Sleek 冷杉拿鐵", "Sleek"], [200, "Blender Bottle Classic 層白雲", "Classic"],
  [203, "Blender Bottle Pro 太空灰", "Blender Pro"], [208, "Hyper Nutro 電動攪拌杯", "Hyper Nutro"],
];

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.text();
}
function clean(s) { return String(s || "").replace(/\s+/g, " ").replace(/"/g, "'").trim(); }
function prices(html) {
  const found = [];
  const add = (label, re) => { for (const m of html.matchAll(re)) found.push(label + ":" + m[1].replace(/,/g, "")); };
  add("meta", /product:price:amount" content="([\d.,]+)/g);
  add("jsonld", /"price"\s*:\s*"?([\d.,]+)/g);
  add("原價欄", /(?:original|regular|compare|price-crossed|price-regular)[^>]*>\s*(?:NT\$|\$)\s*([\d,]+)/gi);
  add("NT$", /NT\$\s*([\d,]+)/g);
  return [...new Set(found)].slice(0, 12).join(" ");
}

const lines = ["編號,試算表品名,搜尋關鍵字,官網頁面標題,官網網址,頁面上的價格"];
for (const [id, name, q] of ITEMS) {
  try {
    const search = await get(SITE + "/products?query=" + encodeURIComponent(q));
    const links = [...new Set(search.match(/\/products\/[a-z0-9\-]+/gi) || [])].slice(0, 4);
    if (!links.length) { lines.push([id, name, q, "搜尋沒有結果", "", ""].join(",")); continue; }
    for (const link of links) {
      const page = await get(SITE + link);
      const title = clean((page.match(/<title>([^<]*)<\/title>/i) || [])[1]);
      lines.push([id, name, q, '"' + title + '"', SITE + link, '"' + prices(page) + '"'].join(","));
    }
  } catch (e) {
    lines.push([id, name, q, "錯誤：" + clean(e.message), "", ""].join(","));
  }
  console.log("查完", id, name);
}
fs.writeFileSync(OUT, "﻿" + lines.join("\n"));
console.log("報告：" + OUT);
