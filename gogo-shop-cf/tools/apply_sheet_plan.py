# 照 sheet_plan_*.json 更新「果果快選所_商品資料庫」：改既有格子＋在「全部販售商品」最下面加新品
# 安全機制：每一格都先核對「現在的值」跟計畫裡的「改前」一樣才改；有任何一格對不上就整個不寫
#           寫入前先把整份試算表複製一份備份；寫完再讀回來逐格驗證
# 用法：python3 apply_sheet_plan.py <計畫 JSON>          （只檢查）
#       python3 apply_sheet_plan.py <計畫 JSON> --write  （真的寫入）
import json, os, subprocess, sys, time

GWS = os.path.expanduser("~/.local/bin/gws-work")
SHEET = "16JHVoqK2a-7TGSr6ItQposLfMGVRc8L6kkA23DNoqcs"
WRITE = "--write" in sys.argv
plan = json.load(open([a for a in sys.argv[1:] if a != "--write"][0], encoding="utf-8"))
T = "全部販售商品"


def gws(*args):
    out = subprocess.run([GWS, *args], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("gws-work 執行失敗：\n" + out.stderr + out.stdout)
    start = out.stdout.find("{")
    return json.loads(out.stdout[start:]) if start >= 0 else {}


def read(rng):
    return gws("sheets", "spreadsheets", "values", "get", "--params",
               json.dumps({"spreadsheetId": SHEET, "range": rng, "valueRenderOption": "UNFORMATTED_VALUE"})).get("values", [])


def col(c):
    return ord(c) - ord("A")


def same(a, b):
    if a in (None, "") and b in (None, ""):
        return True
    if isinstance(a, bool) or isinstance(b, bool):
        return str(a).upper() == str(b).upper()
    try:
        return abs(float(a) - float(b)) < 0.001
    except (TypeError, ValueError):
        return str(a).strip() == str(b).strip()


def snapshot():
    return {"Products": read("Products!A1:N260"), T: read(T + "!A1:L460")}


def cell(data, rng):
    sheet, ref = rng.split("!")
    r, c = int(ref[1:]) - 1, col(ref[0])
    rows = data[sheet]
    return rows[r][c] if r < len(rows) and c < len(rows[r]) else None


# 1. 核對
data = snapshot()
bad = []
for c in plan["cells"]:
    now = cell(data, c["range"])
    if not same(now, c["old"]):
        bad.append("%s 現在是「%s」，計畫的改前是「%s」（%s）" % (c["range"], now, c["old"], c["why"]))
last = len(data[T])
if last != plan["last_row"]:
    bad.append("「全部販售商品」現在有 %d 列，計畫時是 %d 列（可能有人加了東西）" % (last, plan["last_row"]))
from collections import Counter
print("要改 %d 格：" % len(plan["cells"]))
for (sheet, why), n in sorted(Counter((c["sheet"], c["why"].split("：")[0]) for c in plan["cells"]).items()):
    print("  %-8s %-20s %d 格" % (sheet, why, n))
if plan["new_rows"]:
    print("要在「全部販售商品」第 %d～%d 列新增 %d 個新品（平台開啟販售先不勾）：" % (
        plan["new_rows"][0]["row"], plan["new_rows"][-1]["row"], len(plan["new_rows"])))
for r in plan["new_rows"]:
    v = r["values"]
    print("  第%d列 %s %s ｜%s｜牌價 %s 經銷 %s 建議 %s" % (r["row"], v[0], v[1], "有貨" if v[4] else "缺貨", v[7], v[8], v[9]))
if bad:
    print("\n❌ 有 %d 格跟計畫對不上，整個不寫：" % len(bad))
    for b in bad[:30]:
        print("  " + b)
    sys.exit("把這段貼給 Claude。")
print("\n✅ 每一格都核對過，跟計畫的改前一致。")
if not WRITE:
    sys.exit("（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）")

# 2. 備份整份試算表
stamp = time.strftime("%Y%m%d_%H%M")
cp = gws("drive", "files", "copy", "--params", json.dumps({"fileId": SHEET}),
         "--json", json.dumps({"name": "果果快選所_商品資料庫_備份_" + stamp}))
if not cp.get("id"):
    sys.exit("❌ 備份失敗，沒有寫入。")
print("已備份：果果快選所_商品資料庫_備份_%s" % stamp)

# 3. 寫入
val = lambda v: "" if v is None else v
updates = [{"range": c["range"], "values": [[val(c["new"])]]} for c in plan["cells"]]
updates += [{"range": "%s!A%d:L%d" % (T, r["row"], r["row"]), "values": [[val(v) for v in r["values"]]]} for r in plan["new_rows"]]
gws("sheets", "spreadsheets", "values", "batchUpdate", "--params", json.dumps({"spreadsheetId": SHEET}),
    "--json", json.dumps({"valueInputOption": "USER_ENTERED", "data": updates}))
# 新品列的「庫存狀態／平台開啟販售」做成勾選框
meta = None
if plan["new_rows"]:
  meta = gws("sheets", "spreadsheets", "get", "--params", json.dumps({"spreadsheetId": SHEET, "fields": "sheets.properties"}))
  sid = next(s["properties"]["sheetId"] for s in meta["sheets"] if s["properties"]["title"] == T)
  gws("sheets", "spreadsheets", "batchUpdate", "--params", json.dumps({"spreadsheetId": SHEET}), "--json", json.dumps({"requests": [{
    "setDataValidation": {"range": {"sheetId": sid, "startRowIndex": plan["new_rows"][0]["row"] - 1, "endRowIndex": plan["new_rows"][-1]["row"],
                                    "startColumnIndex": 4, "endColumnIndex": 6},
                          "rule": {"condition": {"type": "BOOLEAN"}, "strict": True}}}]}))

# 4. 讀回驗證
data = snapshot()
wrong = [c["range"] for c in plan["cells"] if not same(cell(data, c["range"]), c["new"])]
for r in plan["new_rows"]:
    for i, v in enumerate(r["values"]):
        if i != 10 and not same(cell(data, "%s!%s%d" % (T, chr(65 + i), r["row"])), v):
            wrong.append("%s!%s%d" % (T, chr(65 + i), r["row"]))
if wrong:
    print("⚠️ 讀回有 %d 格不符：%s" % (len(wrong), "、".join(wrong[:20])))
else:
    print("✅ 寫入完成，讀回逐格驗證全部正確（%d 格＋%d 列新品）。" % (len(plan["cells"]), len(plan["new_rows"])))
