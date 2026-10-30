# 透過 Google Chrome 分頁讀果果官網（www.gogonuts.best）所有商品的名稱和價格，存成 JSON
# 官網會擋程式直接連線，所以在 Chrome 分頁裡讀（跟一般人開網頁一樣）
# 事前：Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」要打勾
# 用法：python3 official_scan.py <輸出 JSON>
import json, subprocess, sys, tempfile, time

OUT = sys.argv[1]
SITE = "www.gogonuts.best"


def osa(script, wait=60):
    try:
        r = subprocess.run(["osascript", "-"], input=script, capture_output=True, text=True, timeout=wait)
    except subprocess.TimeoutExpired:
        sys.exit("❌ Chrome 超過 %d 秒沒回應。請看畫面上有沒有跳出「允許」的視窗沒按；按完再跑一次。" % wait)
    if r.returncode != 0:
        msg = r.stderr.strip()
        if "JavaScript" in msg or "Apple 事件" in msg or "Apple Events" in msg:
            sys.exit("❌ Chrome 還沒允許：Chrome 選單「檢視 → 開發人員 → 允許來自 Apple 事件的 JavaScript」打勾，再跑一次。")
        if "-1743" in msg or "不允許" in msg or "not allowed" in msg.lower():
            sys.exit("❌ Mac 沒允許終端機控制 Chrome：系統設定 → 隱私權與安全性 → 自動化 → 終端機 → 打開 Google Chrome，再跑一次。")
        sys.exit("❌ 跟 Chrome 溝通失敗：" + msg)
    return r.stdout.strip()


def find_tab():
    return osa('''
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "%s" then return (id of w as text) & "," & (id of t as text)
    end repeat
  end repeat
  return ""
end tell''' % SITE)


print("1. 找 Google Chrome 裡的果果官網分頁…", flush=True)
loc = find_tab()
if not loc:
    print("   沒有開著的官網分頁，幫你在 Chrome 開一個，等 8 秒…", flush=True)
    osa('''
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  tell front window to make new tab with properties {URL:"https://%s/"}
end tell''' % SITE)
    time.sleep(8)
    loc = find_tab()
if not loc:
    sys.exit("❌ 開不出官網分頁")
wid, tid = loc.split(",")
print("2. 用 Chrome 這個分頁讀官網", flush=True)
jsfile = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8").name


def run_js(code):
    open(jsfile, "w", encoding="utf-8").write(code)
    return osa('''
set js to read POSIX file "%s" as «class utf8»
tell application "Google Chrome"
  set t to (first tab of window id %s whose id is %s)
  return execute t javascript js
end tell''' % (jsfile, wid, tid))


JS = r'''
(() => {
  window.__off = { done: 0, total: 0, items: [], log: [] };
  const S = window.__off;
  const get = async (u) => { const r = await fetch(u, { credentials: "include" }); return r.ok ? r.text() : ""; };
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  (async () => {
    let urls = new Set();
    const top = await get("/sitemap.xml");
    S.log.push("sitemap " + top.length);
    for (const u of locs(top)) {
      if (/\/products\//.test(u)) urls.add(u);
      else if (/sitemap/i.test(u)) for (const v of locs(await get(u))) if (/\/products\//.test(v)) urls.add(v);
    }
    urls = [...urls];
    S.total = urls.length;
    const one = async (url) => {
      try {
        const h = await get(url);
        const doc = new DOMParser().parseFromString(h, "text/html");
        const meta = (p) => (doc.querySelector('meta[property="' + p + '"]') || {}).content || "";
        const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch (e) { return null; } }).filter(Boolean);
        const prices = [];
        const walk = (o) => { if (!o || typeof o !== "object") return; if (o.price !== undefined) prices.push(String(o.price)); if (o.lowPrice !== undefined) prices.push(String(o.lowPrice)); Object.values(o).forEach(walk); };
        ld.forEach(walk);
        const txt = (sel) => [...doc.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 6);
        S.items.push({ url, title: meta("og:title") || (doc.querySelector("h1") || {}).textContent || "", ldPrices: [...new Set(prices)],
          metaPrice: meta("product:price:amount"), priceTexts: txt('[class*="price"]'), variations: txt('[class*="variation"] option, select option') });
      } catch (e) { S.items.push({ url, error: String(e) }); }
      S.done++;
    };
    const q = urls.slice();
    const worker = async () => { while (q.length) await one(q.shift()); };
    await Promise.all([worker(), worker(), worker()]);
    S.finished = true;
  })();
  return "started";
})()
'''
print("3. 開始讀取商品清單…", flush=True)
run_js("window.__offrun = (window.__offrun || 0) + 1; 'ok'")
run_js(JS)
last = -1
started = time.time()
while True:
    time.sleep(3)
    st = json.loads(run_js("JSON.stringify({d: window.__off.done, t: window.__off.total, f: !!window.__off.finished, log: window.__off.log})"))
    if st["d"] != last or int(time.time() - started) % 30 < 3:
        print("   已讀 %d / %d 個商品頁 %s" % (st["d"], st["t"], st["log"]), flush=True)
        last = st["d"]
    if st["t"] == 0 and st["f"]:
        sys.exit("❌ 官網的商品清單（sitemap）讀不到，回報給 Claude。")
    if st["f"]:
        break
items = []
n = int(run_js("String(window.__off.items.length)"))
for i in range(0, n, 40):
    items += json.loads(run_js("JSON.stringify(window.__off.items.slice(%d, %d))" % (i, i + 40)))
json.dump({"scannedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "count": len(items), "items": items}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("完成：官網共 %d 個商品頁，失敗 %d 個。檔案：%s" % (len(items), sum(1 for x in items if x.get("error")), OUT))
