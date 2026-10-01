# 把 187KB 的進度交接.md 拆成：精簡現況版（進度交接.md）＋完整舊紀錄（進度交接_歷史.md，原文一字不改）
# 預設只檢查；加 --write 才寫入。寫入前原檔先備份到 backups/。
# 用法：在 Mo-Agent 資料夾執行 python3 split_handoff.py <新版檔案> [--write]
import os, shutil, sys, time

WRITE = "--write" in sys.argv
ROOT = os.getcwd()
args = [a for a in sys.argv[1:] if a != "--write"]
if not os.path.exists(os.path.join(ROOT, "CLAUDE.md")) or not args:
    sys.exit("用法：先 cd 到 Mo-Agent 資料夾，再執行 python3 split_handoff.py <新版檔案> [--write]")
cur = os.path.join(ROOT, "進度交接.md")
hist = os.path.join(ROOT, "進度交接_歷史.md")
new = open(args[0], encoding="utf-8").read()
old = open(cur, encoding="utf-8").read()

if os.path.exists(hist):
    sys.exit("進度交接_歷史.md 已經存在，代表拆過了，不再重做。")
if not old.startswith("# 進度交接｜目前狀態快照") or len(old.encode()) < 100000:
    sys.exit("進度交接.md 看起來不是舊的長版（開頭或大小不符），先停下來，把這段訊息貼給 Claude。")
if not new.startswith("# 進度交接｜目前狀態"):
    sys.exit("新版檔案內容不對，先停下來。")

head = ("# 進度交接｜歷史紀錄（2026-07-14 ～ 2026-09-18）\n\n"
        "> 這是舊版進度交接的完整原文，2026-10-01 拆出來存檔，內容一字未改。\n"
        "> 現況請看 `進度交接.md`。要查舊事（做過什麼、踩過的坑、Doc／Sheet ID）用關鍵字搜尋這份，不要整份讀。\n"
        "> 之後完成的事，在這裡最上方（這段說明下面）補一行「日期＋做了什麼＋檔案在哪」。\n\n---\n\n")
print("舊版進度交接.md：%d KB，%d 行" % (len(old.encode()) // 1024, old.count("\n")))
print("→ 進度交接_歷史.md：舊版原文全部保留（前面加 4 行說明）")
print("→ 新版進度交接.md：%d KB，%d 行" % (len(new.encode()) // 1024, new.count("\n")))
if not WRITE:
    sys.exit("\n（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）")

bdir = os.path.join(ROOT, "backups")
os.makedirs(bdir, exist_ok=True)
bak = os.path.join(bdir, "進度交接_拆分前_%s.md" % time.strftime("%Y%m%d_%H%M"))
shutil.copy2(cur, bak)
open(hist, "w", encoding="utf-8").write(head + old)
open(cur, "w", encoding="utf-8").write(new)
# 讀回驗證
ok = open(hist, encoding="utf-8").read() == head + old and open(cur, encoding="utf-8").read() == new
print("\n✅ 完成並讀回核對無誤。原檔備份：backups/" + os.path.basename(bak) if ok else "\n❌ 讀回核對不符，把這段貼給 Claude（原檔備份在 backups/）")
