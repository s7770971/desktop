# 整理 Mo-Agent 資料夾：清掉重複舊副本 + 一個專案一個主資料夾 + 自動改好規則檔裡的路徑
# 預設只列出「要做什麼」，不動任何檔案；確認後加 --write 才真的搬。
# 不刪任何東西：要清掉的一律搬到 backups/整理_<日期>/，保留原本路徑，想復原搬回去就好。
# 用法：在 Mo-Agent 資料夾執行 python3 reorg_mo_agent.py [--write]
import os, re, shutil, sys, time

WRITE = "--write" in sys.argv
ROOT = os.getcwd()
if not os.path.exists(os.path.join(ROOT, "CLAUDE.md")):
    sys.exit("請先 cd 到 Mo-Agent 資料夾再執行")
STAMP = time.strftime("%Y%m%d")
TRASH = "backups/整理_" + STAMP  # 清掉的東西放這裡

# ── 一、清掉重複舊副本（Mo 已同意 1–7）──────────────────────────
CLEAN = [
    "context",                              # 1. 9/13 的舊交接＋重複檔
    "本機鏡像/context/參考_鏡像",            # 2. 8 月版規則副本
    "本機鏡像/context/進度交接_鏡像.md",
    "本機鏡像/context/CLAUDE_鏡像.md",
    "手機交辦",                             # 3. 本機鏡像/手機交辦 才是在用的那份
    "download.html",                        # 4. 空檔
    "gws清單.txt",
]
OLD_RULES = "backups/舊版規則"              # 6. 舊版規則集中放
IMG_OLD = ("gogo-shop-cf/images_backup_original", "gogo-shop-cf/backups/images_backup_original")  # 7.

# ── 二、一個專案一個主資料夾（舊位置 → 新位置）────────────────────
PROJECT = [
    ("資料庫/科學人系列", "專案/科學人/節目資料"),
    ("商業開發/科學人", "專案/科學人/商業開發"),
    ("參考/工作流_科學人系列內容產出.md", "專案/科學人/工作流_科學人系列內容產出.md"),
    ("參考/科學人文案語境DNA.md", "專案/科學人/科學人文案語境DNA.md"),
    ("資料庫/賈文青無料案內所", "專案/賈文青無料案內所/節目資料"),
    ("商業開發/賈文青", "專案/賈文青無料案內所/商業開發"),
    ("參考/工作流_賈文青內容產出.md", "專案/賈文青無料案內所/工作流_賈文青內容產出.md"),
    ("企劃/PANDA", "專案/PANDA/企劃"),
    ("資料庫/PANDA", "專案/PANDA/節目資料"),
    ("企劃/潤男的Room_節目企劃_生活感方向.md", "專案/潤男的Room/潤男的Room_節目企劃_生活感方向.md"),
    ("資料庫/潤男的Room", "專案/潤男的Room/節目資料"),
    ("企劃/女僕咖啡廳訪問研究.md", "專案/女僕咖啡廳訪問/女僕咖啡廳訪問研究.md"),
    ("gogo-shop-cf", "專案/果果快選所/gogo-shop-cf"),
    ("參考/工作流_電商快選所架站模板.md", "專案/果果快選所/工作流_電商快選所架站模板.md"),
    ("短影音工作區", "專案/短影音/工作區"),
    ("參考/工作流_短影音自動剪輯.md", "專案/短影音/工作流_短影音自動剪輯.md"),
    ("資料庫/meta社群", "專案/個人社群/meta社群"),
    ("參考/資源包_IG成長Prompt.md", "專案/個人社群/資源包_IG成長Prompt.md"),
    ("法律案件/洪繹翔案", "專案/洪繹翔案"),
    ("文件", "個人/文件"),
    ("個人工具", "個人/個人工具"),
    ("資料庫/個人簡介.md", "個人/個人簡介.md"),
]
# 搬完後如果只剩 .DS_Store 就收進備份
MAYBE_EMPTY = ["企劃", "商業開發", "法律案件"]

# ── 三、規則檔、程式裡寫到舊路徑的地方一起改 ─────────────────────
# 單一層的名字（文件、個人工具、gogo-shop-cf）太常見，只改明確的寫法
REWRITE = [(a, b) for a, b in PROJECT if a not in ("gogo-shop-cf", "文件", "個人工具")]
REWRITE += [("Mo-Agent/gogo-shop-cf", "Mo-Agent/專案/果果快選所/gogo-shop-cf"),
            ("Mo-Agent/文件", "Mo-Agent/個人/文件"),
            ("Mo-Agent/個人工具", "Mo-Agent/個人/個人工具"),
            ("個人工具/打平帳本", "個人/個人工具/打平帳本")]
REWRITE += [("文件/" + n, "個人/文件/" + n) for n in ("免除教育召集", "命理分析報告", "教召免召", "無一定雇主")]
REWRITE.sort(key=lambda p: -len(p[0]))
# 前面必須是開頭、空白、斜線、引號、括號等，避免改到「本機鏡像/…」或別的字中間
PAT = re.compile(r"(?<![^\s/`'\"(（「『~:：\[|])(" + "|".join(re.escape(a) for a, _ in REWRITE) + ")")
NEW = dict(REWRITE)


def fix_paths(text):
    # 已經是新路徑（前面是「個人/」「專案/」）就不再改，重跑也不會疊兩層
    def rep(m):
        if m.string[:m.start()].endswith(("個人/", "專案/")):
            return m.group(1)
        return NEW[m.group(1)]
    return PAT.sub(rep, text)
TEXT_EXT = (".md", ".py", ".sh", ".txt", ".json", ".command", ".plist")
SKIP_DIRS = {"backups", "本機鏡像", ".agents", ".git", "node_modules", ".venv", "__pycache__", ".wrangler",
             "capcut-mate", "video-autopilot-kit", "fable-harness", "終極剪輯系統", "public", "images_backup_original"}
SKIP_FILES = {"資料夾結構.txt", "skills-lock.json"}


def count_files(p):
    if os.path.isfile(p):
        return 1
    return sum(len(fs) for _, _, fs in os.walk(p))


def move(src, dst, log):
    s, d = os.path.join(ROOT, src), os.path.join(ROOT, dst)
    if not os.path.exists(s):
        return
    if os.path.exists(d):
        print("  ⚠️ 跳過（目的地已經有東西）：" + dst)
        return
    n = count_files(s)
    print("  %s  →  %s（%d 個檔案）" % (src, dst, n))
    if WRITE:
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.move(s, d)
        got = count_files(d)
        if os.path.exists(s) or got != n:
            sys.exit("❌ 搬移核對失敗：%s（原 %d 個，新位置 %d 個）。先停下來，把這段訊息貼給 Claude。" % (src, n, got))
        log.append("%s\t→\t%s\t%d 個檔案" % (src, dst, n))


log = []
print("【一、清掉重複舊副本 → %s/】" % TRASH)
for p in CLEAN:
    move(p, TRASH + "/" + p, log)

print("\n【二、舊版規則集中到 %s/】" % OLD_RULES)
bdir = os.path.join(ROOT, "backups")
olds = sorted(f for f in os.listdir(bdir) if f.startswith("CLAUDE") and (f.endswith(".md") or f.endswith(".bak")))
keep = sorted(f for f in olds if re.fullmatch(r"CLAUDE_\d{8}_\d{4,6}\.md", f))[-2:]
for f in os.listdir(bdir):
    if f.endswith(".bak") or (f in olds and f not in keep):
        move("backups/" + f, OLD_RULES + "/" + f, log)
print("  （留在原位的最新兩份：%s）" % "、".join(keep))

print("\n【三、網站舊原圖收進網站自己的 backups/】")
move(IMG_OLD[0], IMG_OLD[1], log)

print("\n【四、一個專案一個主資料夾】")
for src, dst in PROJECT:
    move(src, dst, log)

print("\n【五、搬空的舊資料夾收進備份】")
for p in MAYBE_EMPTY:
    full = os.path.join(ROOT, p)
    if os.path.isdir(full):
        left = [f for f in os.listdir(full) if f != ".DS_Store"]
        if not WRITE:
            print("  %s：搬完後如果空了就收進備份" % p)
        elif not left:
            move(p, TRASH + "/" + p, log)
        else:
            print("  %s 還有東西，保留：%s" % (p, "、".join(left)))

print("\n【六、規則檔與程式裡的舊路徑】")
changed = 0
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for f in files:
        if not f.endswith(TEXT_EXT) or f in SKIP_FILES:
            continue
        path = os.path.join(dirpath, f)
        if os.path.getsize(path) > 400000:
            continue
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        new = fix_paths(text)
        if new == text:
            continue
        rel = os.path.relpath(path, ROOT)
        hits = [l.strip() for l in text.splitlines() if PAT.search(l)]
        print("  ■ %s（%d 行）例：%s" % (rel, len(hits), hits[0][:100]))
        changed += 1
        if WRITE:
            bak = os.path.join(ROOT, TRASH, "改路徑前", rel)
            os.makedirs(os.path.dirname(bak), exist_ok=True)
            shutil.copy2(path, bak)
            open(path, "w", encoding="utf-8").write(new)
print("  共 %d 個檔案" % changed)
print("  ※ 註：還沒搬的時候先預覽，這裡列的是「搬完後」會改的檔案（用目前位置顯示）")

print("\n【七、只檢查不改：本機鏡像/scripts、Mac 排程（LaunchAgents）有沒有寫到舊路徑】")
outside = [os.path.join(ROOT, "本機鏡像", "scripts"), os.path.expanduser("~/Library/LaunchAgents")]
found = 0
for base in outside:
    for dirpath, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            path = os.path.join(dirpath, f)
            try:
                text = open(path, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            if fix_paths(text) != text:
                found += 1
                print("  ⚠️ " + path.replace(os.path.expanduser("~"), "~"))
print("  " + ("沒有，安全。" if not found else "以上 %d 個檔案寫到舊路徑，把這段貼給 Claude 處理。" % found))

if WRITE:
    os.makedirs(os.path.join(ROOT, TRASH), exist_ok=True)
    move("資料夾結構.txt", TRASH + "/資料夾結構.txt", log)  # 5. 用完的清單
    open(os.path.join(ROOT, TRASH, "搬移清單.txt"), "a", encoding="utf-8").write("\n".join(log) + "\n")
    print("\n✅ 完成，每一項都核對過檔案數量。紀錄在 %s/搬移清單.txt" % TRASH)
else:
    print("\n（只預覽，沒有動任何檔案。確認沒問題後在指令最後加 --write 再跑一次）")
