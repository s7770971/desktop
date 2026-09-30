# 把官網查到、已人工核對的「原價」寫進 果果快選所_商品資料庫 → Products 分頁 F 欄（原價）
# 安全機制：先讀 A:C 欄，用「編號」找到真正的列，並比對品名一致才寫；寫完再讀回驗證。
# 用法：python3 fill_retail.py        （加 --dry 只檢查不寫入）
import json, re, subprocess, sys, os

GWS = os.path.expanduser("~/.local/bin/gws-work")
SHEET = "16JHVoqK2a-7TGSr6ItQposLfMGVRc8L6kkA23DNoqcs"
DRY = "--dry" in sys.argv

# 編號: (試算表品名, 官網原價)
FILL = {
    147: ("PRO EAAs 必需胺基酸-梅子綠茶", 1199),
    148: ("PRO EAAs 必需胺基酸-莓果爆擊", 1199),
    149: ("PRO EAAs 必需胺基酸-蜜桃鐵觀音", 1199),
    161: ("輔酵素 Q10", 450),
    162: ("Glutamine+Vitamin D3 麩醯胺酸+維生素D3 (/袋)", 1199),
    163: ("無調味綜合堅果", 39),
    164: ("燕麥脆片-伯爵厚奶｜單包", 45),
    165: ("燕麥脆片-纖脆可可｜單包", 45),
    166: ("燕麥脆片-酥烤海苔｜單包", 45),
    167: ("燕麥脆片-醇黑芝麻｜單包", 45),
    168: ("燕麥脆片-金沙鹹蛋｜單包", 45),
    172: ("蛋白香酥脆-朱雀辛咖哩", 55),
    175: ("麥脆朵朵-濃布朗尼 (單包)", 45),
    176: ("麥脆朵朵-黑糖肉桂 (單包)", 45),
    190: ("Blender Bottle 316 不鏽鋼彈簧球", 35),
    208: ("Hyper Nutro 電動攪拌杯--白", 1080),
    209: ("Hyper Nutro 電動攪拌杯--粉", 1080),
    210: ("Hyper Nutro 電動攪拌杯--藍", 1080),
    211: ("Hyper Nutro 電動攪拌杯--黑", 1080),
}


def gws(*args):
    out = subprocess.run([GWS, *args], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("gws-work 執行失敗：\n" + out.stderr + out.stdout)
    start = out.stdout.find("{")
    return json.loads(out.stdout[start:])


def read(rng):
    return gws("sheets", "spreadsheets", "values", "get",
               "--params", json.dumps({"spreadsheetId": SHEET, "range": rng})).get("values", [])


norm = lambda s: re.sub(r"\s+", "", str(s))

# 1. 讀 A:F，用編號找列並核對品名
rows = read("Products!A1:F260")
where = {}
for i, r in enumerate(rows):
    if r and re.fullmatch(r"\d+", str(r[0]).strip()):
        where[int(r[0])] = (i + 1, r)
bad = []
data = []
for pid, (name, price) in FILL.items():
    if pid not in where:
        bad.append("找不到編號 %d" % pid)
        continue
    rownum, r = where[pid]
    sheet_name = r[2] if len(r) > 2 else ""
    old = r[5] if len(r) > 5 else ""
    if norm(sheet_name) != norm(name):
        bad.append("編號 %d 第 %d 列品名不符：表上是「%s」，預期「%s」" % (pid, rownum, sheet_name, name))
        continue
    if str(old).strip():
        bad.append("編號 %d 第 %d 列原價已經有值（%s），不覆蓋" % (pid, rownum, old))
        continue
    data.append({"range": "Products!F%d" % rownum, "values": [[price]]})
    print("核對 OK：第 %d 列 %s → 原價 %d" % (rownum, name, price))

if bad:
    print("\n以下項目跳過：\n" + "\n".join(bad))
if DRY or not data:
    sys.exit("\n（只檢查，沒有寫入）" if DRY else "\n沒有可寫入的項目")

# 2. 寫入
gws("sheets", "spreadsheets", "values", "batchUpdate",
    "--params", json.dumps({"spreadsheetId": SHEET}),
    "--json", json.dumps({"valueInputOption": "USER_ENTERED", "data": data}))

# 3. 讀回驗證
check = read("Products!A1:F260")
ok = 0
for d in data:
    rownum = int(d["range"][10:])
    got = check[rownum - 1][5] if len(check[rownum - 1]) > 5 else ""
    want = d["values"][0][0]
    if str(got).replace(",", "") == str(want):
        ok += 1
    else:
        print("⚠️ 第 %d 列讀回是「%s」，預期 %s" % (rownum, got, want))
print("\n寫入並驗證完成：%d / %d 筆" % (ok, len(data)))
