# 用「已經登入的瀏覽器分頁」（Safari 或 Chrome，哪個有開經銷網站就用哪個）掃經銷網站登入後的價格與庫存
# 做法：終端機叫 Chrome 在經銷網站的分頁裡執行一小段程式，逐頁讀商品頁，結果存成 JSON。不讀、不碰任何登入資料。
# 事前（Safari）：Safari 設定 → 進階 → 勾「顯示網頁開發者功能」；再到選單「開發 → 允許來自 Apple 事件的 JavaScript」
# 事前（Chrome）：Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」打勾
# 用法：python3 chrome_scan.py <未登入掃描的 JSON（拿商品網址用）> <輸出 JSON>
import json, os, subprocess, sys, tempfile, time

SRC, OUT = sys.argv[1], sys.argv[2]
SITE = "sell.gogonuts.best"
urls = [i["url"] for i in json.load(open(SRC, encoding="utf-8"))["items"] if i.get("url")]
print("要掃 %d 個商品頁" % len(urls))


BROWSER = None


def osa(script):
    r = subprocess.run(["osascript", "-"], input=script, capture_output=True, text=True)
    if r.returncode != 0:
        msg = r.stderr.strip()
        if "-1743" in msg or "not allowed" in msg.lower() or "不允許" in msg:
            sys.exit("❌ Mac 沒允許終端機控制瀏覽器：系統設定 → 隱私權與安全性 → 自動化 → 終端機 → 打開 %s，再跑一次。" % (BROWSER or "瀏覽器"))
        if "JavaScript" in msg or "Apple 事件" in msg or "Apple Events" in msg:
            if BROWSER == "Safari":
                sys.exit("❌ Safari 還沒允許：Safari 設定 → 進階 → 勾「顯示網頁開發者功能」，再到選單列「開發 → 允許來自 Apple 事件的 JavaScript」，再跑一次。")
            sys.exit("❌ Chrome 還沒允許：Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」打勾，再跑一次。")
        sys.exit("❌ 跟瀏覽器溝通失敗：" + msg)
    return r.stdout.strip()


# 1. 找開著經銷網站的分頁：先找 Safari，再找 Chrome
def find_tab():
    global BROWSER
    for app, test in (("Safari", 'application "Safari" is running'), ("Google Chrome", 'application "Google Chrome" is running')):
        if osa("return " + test) != "true":
            continue
        BROWSER = app
        if app == "Safari":
            got = osa('''
tell application "Safari"
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t contains "%s" then return (id of w as text) & "," & (i as text)
    end repeat
  end repeat
  return ""
end tell''' % SITE)
        else:
            got = osa('''
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "%s" then return (id of w as text) & "," & (id of t as text)
    end repeat
  end repeat
  return ""
end tell''' % SITE)
        if got:
            return got.split(",")
    sys.exit("❌ 找不到開著經銷網站（%s）的分頁。請先用 Safari 打開經銷網站並登入，分頁不要關，再跑一次。" % SITE)


wid, tid = find_tab()
print("使用 %s 裡開著經銷網站的分頁" % BROWSER)
jsfile = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8")


def run_js(code):
    with open(jsfile.name, "w", encoding="utf-8") as f:
        f.write(code)
    if BROWSER == "Safari":
        return osa('''
set js to read POSIX file "%s" as «class utf8»
tell application "Safari" to return do JavaScript js in tab %s of window id %s''' % (jsfile.name, tid, wid))
    return osa('''
set js to read POSIX file "%s" as «class utf8»
tell application "Google Chrome"
  set t to (first tab of window id %s whose id is %s)
  return execute t javascript js
end tell''' % (jsfile.name, wid, tid))


if run_js("document.body.classList.contains('logged-in') ? 'yes' : 'no'") != "yes":
    sys.exit("❌ 這個 %s 分頁看起來沒登入經銷網站。請先登入，再跑一次。" % BROWSER)
print("✅ %s 分頁已登入，開始掃描（那個分頁不要關，可以照常做別的事）" % BROWSER)

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
