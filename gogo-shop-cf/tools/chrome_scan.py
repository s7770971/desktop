# 用「已經登入的 Chrome 分頁」掃經銷網站登入後的價格與庫存
# 做法：終端機叫 Chrome 在經銷網站的分頁裡執行一小段程式，逐頁讀商品頁，結果存成 JSON。不讀、不碰任何登入資料。
# 事前：Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」打勾
# 用法：python3 chrome_scan.py <未登入掃描的 JSON（拿商品網址用）> <輸出 JSON>
import json, os, subprocess, sys, tempfile, time

SRC, OUT = sys.argv[1], sys.argv[2]
SITE = "sell.gogonuts.best"
urls = [i["url"] for i in json.load(open(SRC, encoding="utf-8"))["items"] if i.get("url")]
print("要掃 %d 個商品頁" % len(urls))


def osa(script):
    r = subprocess.run(["osascript", "-"], input=script, capture_output=True, text=True)
    if r.returncode != 0:
        msg = r.stderr.strip()
        if "Apple 事件" in msg or "Apple Events" in msg or "JavaScript" in msg:
            sys.exit("❌ Chrome 還沒允許：請到 Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」打勾，再跑一次。")
        if "-1743" in msg or "not allowed" in msg.lower():
            sys.exit("❌ Mac 沒允許終端機控制 Chrome：系統設定 → 隱私權與安全性 → 自動化 → 終端機 → 打開 Google Chrome，再跑一次。")
        sys.exit("❌ 跟 Chrome 溝通失敗：" + msg)
    return r.stdout.strip()


# 1. 找經銷網站的分頁（沒有就開一個）
loc = osa('''
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "%s" then return (id of w as text) & "," & (id of t as text)
    end repeat
  end repeat
  set w to front window
  tell w to make new tab with properties {URL:"https://%s/shop/"}
  delay 5
  return (id of w as text) & "," & (id of active tab of w as text)
end tell''' % (SITE, SITE))
wid, tid = loc.split(",")
jsfile = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8")


def run_js(code):
    with open(jsfile.name, "w", encoding="utf-8") as f:
        f.write(code)
    return osa('''
set js to read POSIX file "%s" as «class utf8»
tell application "Google Chrome"
  set t to (first tab of window id %s whose id is %s)
  return execute t javascript js
end tell''' % (jsfile.name, wid, tid))


if run_js("document.body.classList.contains('logged-in') ? 'yes' : 'no'") != "yes":
    sys.exit("❌ 這個 Chrome 分頁看起來沒登入經銷網站。請先在 Chrome 登入，再跑一次。")
print("✅ Chrome 分頁已登入，開始掃描（Chrome 不要關，可以照常做別的事）")

# 2. 在分頁裡啟動掃描（同時 4 頁）
JS = r'''
(() => {
  const urls = %s;
  const txt = (el) => el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  window.__scan = { done: 0, total: urls.length, items: [] };
  const one = async (url) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const main = doc.querySelector('div[id^="product-"]') || doc.querySelector(".type-product");
      const cls = main ? main.className : "";
      const form = doc.querySelector("form.variations_form");
      let variations = null;
      if (form && form.dataset.product_variations && form.dataset.product_variations !== "false") {
        variations = JSON.parse(form.dataset.product_variations).map((v) => ({
          attrs: Object.values(v.attributes || {}).map((a) => { try { return decodeURIComponent(a); } catch (e) { return a; } }).join(" / "),
          inStock: !!v.is_in_stock, price: v.display_price, regular: v.display_regular_price }));
      }
      window.__scan.items.push({ url, status: res.status, loggedIn: doc.body.classList.contains("logged-in"),
        title: txt(doc.querySelector("h1.product_title")),
        price: txt(doc.querySelector("p.price")),
        stockClass: /\boutofstock\b/.test(cls) ? "缺貨" : /\binstock\b/.test(cls) ? "有貨" : "看不出來",
        stockText: txt(doc.querySelector("p.stock")), variations });
    } catch (e) {
      window.__scan.items.push({ url, error: String(e) });
    }
    window.__scan.done++;
  };
  const queue = urls.slice();
  const worker = async () => { while (queue.length) await one(queue.shift()); };
  Promise.all([worker(), worker(), worker(), worker()]).then(() => { window.__scan.finished = true; });
  return "started";
})()
''' % json.dumps(urls)
run_js(JS)

# 3. 等它跑完
last = -1
while True:
    time.sleep(3)
    st = json.loads(run_js("JSON.stringify({d: window.__scan.done, t: window.__scan.total, f: !!window.__scan.finished})"))
    if st["d"] != last and (st["d"] % 20 == 0 or st["f"]):
        print("  %d / %d" % (st["d"], st["t"]))
        last = st["d"]
    if st["f"]:
        break

# 4. 分批拿回結果
items = []
n = int(run_js("String(window.__scan.items.length)"))
for i in range(0, n, 40):
    items += json.loads(run_js("JSON.stringify(window.__scan.items.slice(%d, %d))" % (i, i + 40)))
os.unlink(jsfile.name)
items.sort(key=lambda x: x.get("title") or "")
logged = sum(1 for x in items if x.get("loggedIn"))
json.dump({"scannedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "loggedIn": logged == len(items), "count": len(items), "items": items},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
errs = sum(1 for x in items if x.get("error"))
print("完成：共 %d 個商品（登入身分 %d 個、讀取失敗 %d 個）。檔案：%s" % (len(items), logged, errs, OUT))
if len(items) != len(urls):
    print("⚠️ 筆數對不上：應該 %d 個，拿到 %d 個" % (len(urls), len(items)))
