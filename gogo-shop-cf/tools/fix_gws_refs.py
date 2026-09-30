# 清掉 Mo-Agent 規則檔裡「已停用帳號」的舊指令與矛盾說明
# 預設只檢查（列出每一處修改前後）；確認後加 --write 才寫入，寫入前每個檔案先備份到 backups/
# 用法：在 Mo-Agent 資料夾執行 python3 fix_gws_refs.py [--write]
import glob, os, re, shutil, sys, time

WRITE = "--write" in sys.argv
ROOT = os.getcwd()
if not os.path.exists(os.path.join(ROOT, "CLAUDE.md")):
    sys.exit("請先 cd 到 Mo-Agent 資料夾再執行")

GWS_CMD = re.compile(r"(?<![\w/-])gws (?=(drive|docs|calendar|gmail|script|sheets)\b)")


def fix_line(path, line):
    name = os.path.basename(path)
    new = line
    # 1. 所有 Google 指令改用 gws-work（綁 mohuangoole@gmail.com）
    new = GWS_CMD.sub("gws-work ", new)
    new = new.replace("用 gws 匯出", "用 gws-work 匯出").replace("導致 gws 工具", "導致 gws-work 工具")
    if name == "工具箱.md":
        if "裸指令" in new and "gws-lazi" in new:
            return None  # 整行刪掉：舊帳號說明
        if "tree@lazicorner.com" in new and "停用" in new:
            return "**Google 相關操作一律用 `gws-work`（帳號 mohuangoole@gmail.com，完整路徑 `~/.local/bin/gws-work`）。**\n"
        if "指令要用完整路徑" in new:
            new = new.replace("`~/.local/bin/gws`", "`~/.local/bin/gws-work`").replace("裸指令 `gws`", "只打 `gws-work`")
        if "gemini-flash-lite-latest" in new:
            return "- model：照 CLAUDE.md 第 9 條，預設用免費額度的模型；真的需要會花錢的模型，先跟 Mo 講原因\n"
    if name == "CLAUDE.md" and "gws-lazi" in new:
        return "- 工作信箱：mohuangoole@gmail.com。Google 相關指令一律用 `gws-work`（完整路徑 `~/.local/bin/gws-work`）。\n"
    return new


files = sorted(glob.glob(os.path.join(ROOT, "參考", "*.md"))) + [os.path.join(ROOT, "CLAUDE.md"), os.path.join(ROOT, "交辦範本.md")]
stamp = time.strftime("%Y%m%d_%H%M")
total = 0
for path in files:
    if not os.path.exists(path):
        continue
    lines = open(path, encoding="utf-8").readlines()
    out, changes = [], []
    for i, line in enumerate(lines, 1):
        new = fix_line(path, line)
        if new != line:
            changes.append((i, line.rstrip("\n"), None if new is None else new.rstrip("\n")))
        if new is not None:
            out.append(new)
    if not changes:
        continue
    rel = os.path.relpath(path, ROOT)
    print("\n■ %s（%d 處）" % (rel, len(changes)))
    for i, old, new in changes:
        print("  第 %d 行" % i)
        print("    改前：" + old[:160])
        print("    改後：" + ("（整行刪除）" if new is None else new[:160]))
    total += len(changes)
    if WRITE:
        bdir = os.path.join(ROOT, "backups")
        os.makedirs(bdir, exist_ok=True)
        shutil.copy2(path, os.path.join(bdir, os.path.basename(path).replace(".md", "_" + stamp + ".md")))
        open(path, "w", encoding="utf-8").writelines(out)

print("\n共 %d 處。" % total + ("已寫入，原檔備份在 backups/。" if WRITE else "（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）"))
