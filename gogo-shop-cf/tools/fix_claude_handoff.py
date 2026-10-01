# CLAUDE.md 裡講到「進度交接.md 的進行中段」的地方，改成配合新版（現況＋歷史兩份）
# 預設只列出改前改後；加 --write 才寫入，寫入前先備份到 backups/
import os, re, shutil, sys, time

WRITE = "--write" in sys.argv
path = os.path.join(os.getcwd(), "CLAUDE.md")
if not os.path.exists(path):
    sys.exit("請先 cd 到 Mo-Agent 資料夾再執行")
RULES = [
    (re.compile(r"（只看「進行中」段）"), "（只放還沒結束的事；查舊事用關鍵字搜尋 `進度交接_歷史.md`）"),
    (re.compile(r" ?的「進行中」段"), "（做完的事從這份刪掉，在 `進度交接_歷史.md` 最上方補一行）"),
]
lines = open(path, encoding="utf-8").readlines()
out, n = [], 0
for i, line in enumerate(lines, 1):
    new = line
    for pat, rep in RULES:
        new = pat.sub(rep, new)
    if new != line:
        n += 1
        print("第 %d 行\n  改前：%s\n  改後：%s" % (i, line.strip(), new.strip()))
    out.append(new)
if not n:
    sys.exit("沒有找到要改的地方（可能已經改過了）。")
if WRITE:
    bak = os.path.join(os.getcwd(), "backups", "CLAUDE_%s.md" % time.strftime("%Y%m%d_%H%M"))
    shutil.copy2(path, bak)
    open(path, "w", encoding="utf-8").writelines(out)
    ok = open(path, encoding="utf-8").read() == "".join(out)
    print("\n✅ 已改 %d 行並讀回核對。原檔備份：backups/%s" % (n, os.path.basename(bak)) if ok else "\n❌ 讀回不符，原檔在 " + bak)
else:
    print("\n（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）")
