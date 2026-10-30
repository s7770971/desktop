# 從這台 Mac 的瀏覽器（Chrome／Brave／Edge／Arc／Safari）讀出某網站「已經登入」的 cookie，給掃描程式用
# 只讀不改；cookie 只輸出給下一個程式，不存檔、不顯示
# 用法：COOKIE="$(python3 browser_cookie.py gogonuts.best)" node dealer_catalog.mjs ...
import glob, hashlib, os, shutil, sqlite3, struct, subprocess, sys, tempfile

DOMAIN = sys.argv[1] if len(sys.argv) > 1 else "gogonuts.best"
HOME = os.path.expanduser("~")
CHROMIUM = [  # (名稱, 資料夾, 鑰匙圈項目)
    ("Chrome", HOME + "/Library/Application Support/Google/Chrome", "Chrome Safe Storage"),
    ("Brave", HOME + "/Library/Application Support/BraveSoftware/Brave-Browser", "Brave Safe Storage"),
    ("Edge", HOME + "/Library/Application Support/Microsoft Edge", "Microsoft Edge Safe Storage"),
    ("Arc", HOME + "/Library/Application Support/Arc/User Data", "Arc Safe Storage"),
]


def say(msg):
    print(msg, file=sys.stderr)


def match(host):
    host = host.lstrip(".")
    return host == DOMAIN or host.endswith("." + DOMAIN)


def aes_decrypt(key, data):
    # 用系統內建的 openssl 解密，不需要另外裝套件
    out = subprocess.run(["openssl", "enc", "-d", "-aes-128-cbc", "-K", key.hex(), "-iv", "20" * 16],
                         input=data, capture_output=True)
    if out.returncode != 0:
        raise ValueError("解密失敗")
    return out.stdout


def chromium_cookies(name, base, service, password=None):
    dbs = glob.glob(base + "/*/Cookies") + glob.glob(base + "/*/Network/Cookies")
    if not dbs:
        return {}
    if password is None:
        say("讀取 %s 的 cookie：Mac 可能會跳出視窗問「security 想使用鑰匙圈」，請輸入 Mac 開機密碼並按「允許」。" % name)
        pw = subprocess.run(["security", "find-generic-password", "-w", "-s", service], capture_output=True, text=True)
        if pw.returncode != 0:
            say("  （沒拿到 %s 的鑰匙，略過）" % name)
            return {}
        password = pw.stdout.strip()
    key = hashlib.pbkdf2_hmac("sha1", password.encode(), b"saltysalt", 1003, 16)
    found = {}
    for db in dbs:
        tmp = tempfile.mkdtemp()
        try:
            for suffix in ("", "-wal", "-shm"):  # 瀏覽器開著也能讀：複製一份再讀
                if os.path.exists(db + suffix):
                    shutil.copy2(db + suffix, os.path.join(tmp, "Cookies" + suffix))
            con = sqlite3.connect(os.path.join(tmp, "Cookies"))
            try:
                ver = int((con.execute("select value from meta where key='version'").fetchone() or [0])[0])
            except sqlite3.Error:
                ver = 0
            for host, cname, value, enc in con.execute("select host_key, name, value, encrypted_value from cookies"):
                if not match(host):
                    continue
                if not value and enc and enc[:3] in (b"v10", b"v11"):
                    try:
                        plain = aes_decrypt(key, enc[3:])
                    except ValueError:
                        continue
                    if ver >= 24:  # 新版 Chrome 在前面多放 32 位元組的網域雜湊
                        plain = plain[32:]
                    value = plain.decode("utf-8", "replace")
                if value:
                    found.setdefault(os.path.dirname(db), {})[cname] = value
            con.close()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return found


def safari_cookies():
    paths = [HOME + "/Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies",
             HOME + "/Library/Cookies/Cookies.binarycookies"]
    out = {}
    for p in paths:
        if not os.path.exists(p):
            continue
        try:
            data = open(p, "rb").read()
        except PermissionError:
            say("Safari 的 cookie 需要權限：系統設定 → 隱私權與安全性 → 完整磁碟取用權限 → 打開「終端機」，再重開終端機。")
            continue
        if data[:4] != b"cook":
            continue
        n = struct.unpack(">i", data[4:8])[0]
        sizes = struct.unpack(">" + "i" * n, data[8:8 + 4 * n])
        pos = 8 + 4 * n
        for size in sizes:
            page = data[pos:pos + size]
            pos += size
            count = struct.unpack("<i", page[4:8])[0]
            offs = struct.unpack("<" + "i" * count, page[8:8 + 4 * count])
            for o in offs:
                c = page[o:]
                url_o, name_o, path_o, val_o = struct.unpack("<iiii", c[16:32])
                s = lambda k: c[k:c.index(b"\0", k)].decode("utf-8", "replace")
                if match(s(url_o)):
                    out[s(name_o)] = s(val_o)
    return {"Safari": out} if out else {}


def main():
    candidates = {}
    for name, base, service in CHROMIUM:
        if os.path.isdir(base):
            for prof, ck in chromium_cookies(name, base, service).items():
                candidates["%s（%s）" % (name, os.path.basename(prof))] = ck
    candidates.update(safari_cookies())
    logged = {k: v for k, v in candidates.items() if any(n.startswith("wordpress_logged_in") for n in v)}
    pick = logged or candidates
    if not pick:
        say("❌ 在這台 Mac 的瀏覽器裡找不到 %s 的 cookie。請確認是用 Chrome 或 Safari 登入的。" % DOMAIN)
        sys.exit(1)
    src = next(iter(pick))
    say(("✅ 用 %s 裡已登入的身分" if logged else "⚠️ %s 裡有這個網站的 cookie，但看不出有登入，還是先試試看") % src)
    print("; ".join("%s=%s" % kv for kv in pick[src].items()))


if __name__ == "__main__":
    main()
