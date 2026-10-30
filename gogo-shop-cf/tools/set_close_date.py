# 把 Settings 分頁的 closeDate（結單日，顯示在賣場上）改成指定文字
# 用法：python3 set_close_date.py "11/3（二）12:00 前" [--write]
import json, os, subprocess, sys
GWS = os.path.expanduser("~/.local/bin/gws-work")
SHEET = "16JHVoqK2a-7TGSr6ItQposLfMGVRc8L6kkA23DNoqcs"
text = [a for a in sys.argv[1:] if a != "--write"][0]
def gws(*a):
    o = subprocess.run([GWS, *a], capture_output=True, text=True)
    if o.returncode: sys.exit(o.stderr + o.stdout)
    i = o.stdout.find("{"); return json.loads(o.stdout[i:]) if i >= 0 else {}
rows = gws("sheets", "spreadsheets", "values", "get", "--params", json.dumps({"spreadsheetId": SHEET, "range": "Settings!A1:B40"})).get("values", [])
r = next((i + 1 for i, x in enumerate(rows) if x and x[0] == "closeDate"), None)
if not r: sys.exit("❌ Settings 裡找不到 closeDate")
print("Settings 第 %d 列 closeDate：「%s」→「%s」" % (r, rows[r - 1][1] if len(rows[r - 1]) > 1 else "", text))
if "--write" not in sys.argv: sys.exit("（只檢查，加 --write 才寫入）")
gws("sheets", "spreadsheets", "values", "update", "--params", json.dumps({"spreadsheetId": SHEET, "range": "Settings!B%d" % r, "valueInputOption": "RAW"}),
    "--json", json.dumps({"values": [[text]]}))
back = gws("sheets", "spreadsheets", "values", "get", "--params", json.dumps({"spreadsheetId": SHEET, "range": "Settings!B%d" % r}))["values"][0][0]
print("✅ 已改成「%s」" % back if back == text else "⚠️ 讀回是「%s」" % back)
