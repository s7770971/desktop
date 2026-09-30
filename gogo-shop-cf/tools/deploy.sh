#!/bin/bash
# 果果快選所：下載新版 → 備份舊版 → 產生商品圖 → 部署到 Cloudflare Pages
set -e
SHOP="/Users/mo/我的雲端硬碟 (mohuangoole@gmail.com)/Mo-Agent/gogo-shop-cf"
IMGSRC="$HOME/Downloads/果果-給經銷商圖檔-2"
RAW="https://raw.githubusercontent.com/s7770971/desktop/${REF:-claude/code-visibility-7er6rv}/gogo-shop-cf"

cd "$SHOP"
stamp=$(date +%Y%m%d_%H%M)
mkdir -p backups tools
if [ "$ONLY" != "deploy" ]; then
echo "1/4 備份舊版 index.html → backups/index_$stamp.html"
cp public/index.html "backups/index_$stamp.html"

echo "2/4 下載新版檔案"
curl -fsSL "$RAW/public/index.html" -o public/index.html.new
curl -fsSL "$RAW/tools/build_images.mjs" -o tools/build_images.mjs
curl -fsSL "$RAW/tools/image_map.json" -o tools/image_map.json
grep -q "imageManifest" public/index.html.new && mv public/index.html.new public/index.html

if [ "$ONLY" = "page" ]; then
  echo "3/4 只更新網頁，沿用現有圖片"
else
  echo "3/4 產生商品圖（約 1 到 3 分鐘）"
  node tools/build_images.mjs "$IMGSRC"
fi
fi
if [ "$ONLY" = "build" ]; then echo "只產生圖片，還沒部署。"; exit 0; fi

if [ "$CLEAN_OLD" = "1" ]; then
  # 舊圖（用編號命名的商品圖、舊營養標示、舊分類介紹圖、蛋白怎麼挑）已經沒有使用，移到備份資料夾，不直接刪
  old="backups/舊圖_$stamp"
  mkdir -p "$old"
  for d in content nutrition; do [ -d "public/images/$d" ] && mv "public/images/$d" "$old/"; done
  find public/images -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -exec mv {} "$old/" \;
  echo "舊圖已移到 $old（$(find "$old" -type f | wc -l | tr -d ' ') 個檔案）"
fi

echo "4/4 部署到 Cloudflare Pages"
project=$(npx --yes wrangler pages project list 2>/dev/null | grep "gogo-shop-1aw" | awk -F'│' '{gsub(/ /,"",$2); print $2}' | head -1)
project=${project:-gogo-shop}
echo "專案名稱：$project"
npx --yes wrangler pages deploy public --project-name "$project" --branch main --commit-dirty=true
echo "完成。報告在 tools/build_images_報告.txt"
