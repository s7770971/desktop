# 在 CLAUDE.md 鐵則第 10 條後面加第 11 條「能寫程式在終端機做的，就用程式做」，標題「十條鐵則」改「十一條鐵則」
# 預設只列出改前改後；加 --write 才寫入，寫入前先備份到 backups/
import os, re, shutil, sys, time

WRITE = "--write" in sys.argv
path = os.path.join(os.getcwd(), "CLAUDE.md")
if not os.path.exists(path):
    sys.exit("請先 cd 到 Mo-Agent 資料夾再執行")
RULE = ("11. **能寫程式在終端機做的，就用程式做**：抓資料、比對、整理檔案、批次修改、檢查數量這類重複或大量的工作，"
        "先寫程式在終端機跑，不要用瀏覽器或網頁工具一頁一頁點、一筆一筆手動改。讀資料時先把結果存成檔案，再用程式篩出重點來讀。"
        "這樣省 token、速度快，也比較不會漏。會改到檔案或試算表的程式，照第 6 條先預覽再寫入，跑完要核對筆數。"
        "需要判斷、品味的事（寫文案、看設計）才自己讀、自己寫。\n")
text = open(path, encoding="utf-8").read()
if "能寫程式在終端機做的" in text:
    sys.exit("第 11 條已經加過了，不用再加。")
lines = text.splitlines(keepends=True)
idx = next((i for i, l in enumerate(lines) if re.match(r"10\. \*\*", l)), None)
if idx is None:
    sys.exit("找不到鐵則第 10 條，什麼都沒改。把這段貼給 Claude。")
lines.insert(idx + 1, RULE)
new = "".join(lines).replace("十條鐵則", "十一條鐵則", 1)
print("在第 %d 行（鐵則第 10 條）後面加入：\n  %s" % (idx + 1, RULE.strip()))
if "十一條鐵則" in new and "十條鐵則" in text:
    print("標題「十條鐵則」→「十一條鐵則」")
if not WRITE:
    sys.exit("\n（只檢查，沒有寫入。確認後在指令最後加 --write 再跑一次）")
bak = os.path.join(os.getcwd(), "backups", "CLAUDE_%s.md" % time.strftime("%Y%m%d_%H%M"))
shutil.copy2(path, bak)
open(path, "w", encoding="utf-8").write(new)
ok = open(path, encoding="utf-8").read() == new
print("\n✅ 已加入並讀回核對。原檔備份：backups/" + os.path.basename(bak) if ok else "\n❌ 讀回不符，原檔在 " + bak)
