# 照 reorg 計畫整理「果果快選所_商品資料庫」：
#   全部販售商品：新品從最下面移到各自系列裡（內容不變，只換位置）
#   Products：加入 Mo 勾選的新品，並依分類、規格排整齊（編號不變，舊訂單不受影響）
# 安全機制：先核對現在的內容跟計畫的「整理前」完全一樣才動；寫入前先複製整份備份；寫完讀回逐格驗證
# 用法：python3 apply_reorg.py <計畫 JSON> [--write]
import json, os, subprocess, sys, time

GWS = os.path.expanduser("~/.local/bin/gws-work")
SHEET = "16JHVoqK2a-7TGSr6ItQposLfMGVRc8L6kkA23DNoqcs"
WRITE = "--write" in sys.argv
plan = json.load(open([a for a in sys.argv[1:] if a != "--write"][0], encoding="utf-8"))
T, PR = "全部販售商品", "Products"


def gws(*args):
    out = subprocess.run([GWS, *args], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("gws-work 執行失敗：\n" + out.stderr + out.stdout)
    start = out.stdout.find("{")
    return json.loads(out.stdout[start:]) if start >= 0 else {}


def read(rng):
    return gws("sheets", "spreadsheets", "values", "get", "--params",
               json.dumps({"spreadsheetId": SHEET, "range": rng, "valueRenderOption": "UNFORMATTED_VALUE"})).get("values", [])


def same(a, b):
    if a in (None, "") and b in (None, ""):
        return True
    if isinstance(a, bool) or isinstance(b, bool):
        return str(a).upper() == str(b).upper()
    try:
        return abs(float(a) - float(b)) < 0.001
    except (TypeError, ValueError):
        return str(a).strip() == str(b).strip()


def diff(cur, want, width, skip=()):
    bad = []
    for i in range(max(len(cur), len(want))):
        a = cur[i] if i < len(cur) else []
        b = want[i] if i < len(want) else []
        for j in range(width):
            if j in skip:
                continue
            x = a[j] if j < len(a) else None
            y = b[j] if j < len(b) else None
            if not same(x, y):
                bad.append((i + 2, chr(65 + j), x, y))
    return bad


# 1. 核對現在的內容 = 計畫的整理前
cur_all = read(T + "!A2:L500")
cur_pr = read(PR + "!A2:N500")
bad = diff(cur_all, plan["all_old"], 12, skip=(10,)) + diff(cur_pr, plan["prod_old"], 14)
print("全部販售商品：%d 列（新品移到各自系列，內容不變）" % len(plan["all_new"]))
print("Products：%d 列 → %d 列（新增 %d 個上架商品，依分類排好）" % (len(plan["prod_old"]), len(plan["prod_new"]), len(plan["prod_new"]) - len(plan["prod_old"])))
if bad:
    print("\n❌ 試算表在計畫之後被改過，有 %d 格對不上，整個不寫：" % len(bad))
    for r, c, x, y in bad[:20]:
        print("  第 %d 列 %s 欄：現在「%s」，計畫時「%s」" % (r, c, x, y))
    sys.exit("把這段貼給 Claude，我重新做計畫。")
print("✅ 現在的內容跟計畫完全一致。")
if not WRITE:
    sys.exit("（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）")

# 2. 備份
stamp = time.strftime("%Y%m%d_%H%M")
cp = gws("drive", "files", "copy", "--params", json.dumps({"fileId": SHEET}),
         "--json", json.dumps({"name": "果果快選所_商品資料庫_備份_" + stamp}))
if not cp.get("id"):
    sys.exit("❌ 備份失敗，沒有寫入。")
print("已備份：果果快選所_商品資料庫_備份_%s" % stamp)

# 3. 寫入（整塊覆寫成整理後的內容）
v = lambda x: "" if x is None else x
na, npr = len(plan["all_new"]), len(plan["prod_new"])
blocks = [(T, "A", "L", [r[:12] for r in plan["all_new"]]), (PR, "A", "N", [r[:14] for r in plan["prod_new"]])]  # 只寫表格範圍內的欄位
for sheet, c0, c1, rows in blocks:  # 分批送，每批 30 列（一次送太大會被系統擋）
    for i in range(0, len(rows), 30):
        part = rows[i:i + 30]
        gws("sheets", "spreadsheets", "values", "batchUpdate", "--params", json.dumps({"spreadsheetId": SHEET}), "--json", json.dumps({
            "valueInputOption": "USER_ENTERED",
            "data": [{"range": "%s!%s%d:%s%d" % (sheet, c0, i + 2, c1, i + 1 + len(part)), "values": [[v(x) for x in r] for r in part]}]}))
meta = gws("sheets", "spreadsheets", "get", "--params", json.dumps({"spreadsheetId": SHEET, "fields": "sheets.properties"}))
sid = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
box = lambda s, r0, r1, c0, c1: {"setDataValidation": {"range": {"sheetId": sid[s], "startRowIndex": r0, "endRowIndex": r1,
                                                                  "startColumnIndex": c0, "endColumnIndex": c1},
                                                        "rule": {"condition": {"type": "BOOLEAN"}, "strict": True}}}
gws("sheets", "spreadsheets", "batchUpdate", "--params", json.dumps({"spreadsheetId": SHEET}), "--json", json.dumps({"requests": [
    box(T, 1, na + 1, 4, 6), box(PR, 1, npr + 1, 7, 9)]}))

# 4. 讀回驗證
bad = diff(read(T + "!A2:L500"), plan["all_new"], 12, skip=(10,)) + diff(read(PR + "!A2:N500"), plan["prod_new"], 14)
print("⚠️ 讀回有 %d 格不符：%s" % (len(bad), bad[:10]) if bad else "✅ 寫入完成，讀回逐格驗證全部正確。")
