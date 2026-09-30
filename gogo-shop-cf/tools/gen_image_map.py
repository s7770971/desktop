# 依 products.csv（Products 分頁匯出）＋ imglist.txt（圖檔清單）產生 tools/image_map.json
# 規則：每個商品配「商品圖＋營養標示」，同口味不同包裝共用營養標示（盒裝 = 單包的營養標示）
# 資料夾找不到主圖的，用 official:關鍵字|頁面標題必含字 到官網抓；營養標示找不到就留空並列入報告。
import csv, json, re, sys

L = [l.strip() for l in open("imglist.txt", encoding="utf-8") if l.strip()]
rows = list(csv.reader(open("products.csv", encoding="utf-8")))[1:]
problems = []


def find(dir_part, *needles, exclude=(), direct=True):
    """找 dir_part 資料夾（direct=True 表示檔案要直接在這層）裡、檔名含全部 needles 的檔案。"""
    hits = []
    for p in L:
        d, _, f = p.rpartition("/")
        if direct and not d.endswith(dir_part):
            continue
        if not direct and dir_part not in d:
            continue
        if all(n in f for n in needles) and not any(x in p for x in exclude):
            hits.append(p)
    if len(hits) > 1:
        # 有「複製」「複本」的版本時優先用原檔
        clean = [h for h in hits if "複製" not in h]
        if len(clean) == 1:
            return clean[0]
        raise SystemExit("多個符合：%s %s → %s" % (dir_part, needles, hits))
    return hits[0] if hits else None


def key(name, spec):
    return re.sub(r"\s+", "", name) + "|" + re.sub(r"\s+", "", spec)


def flavor(name):
    f = name.split("-", 1)[1] if "-" in name else name
    f = re.sub(r"-?\s*\((全素|奶素)\)", "", f)
    f = f.replace("(不加甜)", "").replace("風味", "").replace(" ", "").strip("-")
    return f


WHEY_H_EN = {"香蕉牛奶": "banana milk", "可可歐蕾": "coco olay", "綠豆沙牛奶": "mung bean pasta milk",
             "木瓜牛奶": "papaya milk", "海鹽焦糖": "salted caramel"}
SUPP_NUTRI = {"300億膠原蛋白益生菌": "300億膠原蛋白益生菌", "90% Omega-3 挪威高濃度魚油": "Omega-3",
              "Chromium 酵母鉻": "Chromium", "L-carnitine左旋肉鹼": "L-carnitine",
              "Multi-Enzyme 綜合消化酵素": "Multi-Enzyme", "Multi-Vitamin B 綜合維生素B群": "Multi-Vitamin B",
              "Taurine 牛磺酸": "Taurine", "UC2+HA 固力穩": "UC2 + HA", "強勁瑪卡膠囊": "MACA",
              "輔酵素 Q10": "輔酵素 Q10", "Glutamine+Vitamin D3 麩醯胺酸+維生素D3 (/袋)": "Glutamine"}


def src(p):
    return "src:" + p if p else None


def official(query, must):
    return "official:%s|%s" % (query, must)


def resolve(cat, name, spec):
    f = flavor(name)
    n = name.replace(" ", "")
    s = spec.replace(" ", "")
    C, H, P, W = "果果能量_肌酸/", "果果能量_水解乳清系列/產品圖/", "果果能量_濃縮乳清PLUS系列/", "果果能量_濃縮乳清系列/"
    V = "彼蛋白/產品Product/植物蛋白/"
    if cat == "微粉肌酸":
        if "軟糖" in n:
            return find(C + "肌酸軟糖", "肌酸軟糖_商品圖"), find(C + "肌酸軟糖", "肌酸軟糖_營養標")
        if n.startswith("美日肌酸"):
            d = "彼蛋白/產品Product/美日肌酸/商品圖"
            return find(d, f + "-1"), find(d, f + "-營養標示")
        if "盒" in s:
            return find(C + "盒裝/商品圖", "_" + f + ".png"), find(C + "盒裝/營養標", "_" + f + "_營養標")
        alias = {"南島百香": "百香", "麝香葡萄": "葡萄"}.get(f, f)
        return find(C + "袋裝/商品圖", alias), find(C + "袋裝/營養標", alias)
    if cat == "水解乳清蛋白":
        alt = {"蜂蜜檸檬": "檸檬蜂蜜"}
        n35 = find(H + "35g隨身包/營養標示", f)
        if "35g" in s:
            m = find(H + "35g隨身包", f) or find(H + "35g隨身包", alt.get(f, "@@"))
            return m, n35
        if "盒裝" in s:
            return find(H + "盒裝", f), n35
        # 500g
        m = find(H + "500G 立袋", f)
        nut = find(H + "500G 立袋/營養標", f) or (find(H + "500G 立袋/營養標", WHEY_H_EN[f]) if f in WHEY_H_EN else None)
        if not m:
            m = official("水解乳清 " + f, f)
        return m, nut
    if cat == "濃縮乳清雙蛋白PLUS":
        if "35克" in s:
            return find(P + "2.隨手包", "_" + f + "_35g"), find(P + "2.隨手包/營養標", "_" + f + "_35g")
        n35 = find(P + "2.隨手包/營養標", "_" + f + "_35g")
        if "盒裝" in s:
            return find(P + "5.盒裝", "_" + f + "_30"), n35
        if "1KG" in s.upper() or "1公斤" in s:
            return find(P + "4.立袋1kg", "_" + f + "_1kg"), find(P + "4.立袋1kg/營養標", "_" + f + "_1kg")
        return find(P + "1.立袋500g", "_" + f + "_500g"), find(P + "1.立袋500g/營養標", "_" + f + "_500g")
    if cat == "濃縮乳清蛋白":
        alt = {"焦糖瑪奇朵": "焦糖瑪琪朵"}
        n35 = find(W + "2. 隨手包/營養標示圖", "營養標示_" + f)
        if "35g" in s:
            return find(W + "2. 隨手包/商品圖", f), n35
        if "盒裝" in s:
            return find(W + "5.盒裝", f), n35
        if "1KG" in s.upper():
            return (find(W + "4.立袋1kg", "乳清蛋白1Kg_" + f),
                    find(W + "4.立袋1kg/營養標示", "1公斤_" + f) or find(W + "4.立袋1kg/營養標示", "1公斤_" + alt.get(f, "@@")))
        return (find(W + "1. 立袋500g", f + "500g"),
                find(W + "1. 立袋500g/營養標示", "營養標示_" + f) or find(W + "1. 立袋500g/營養標示", "營養標示_" + alt.get(f, "@@")))
    if cat == "植物蛋白":
        if "緩釋酪蛋白" in n:
            f2 = "夜巡芝麻" if "夜巡芝麻" in n else "濃醇黑巧"
            nut = find("果果能量_緩釋酪蛋白系列/35G/營養標", f2)
            if "盒" in s:
                return find("果果能量_緩釋酪蛋白系列/盒裝", f2), nut
            return find("果果能量_緩釋酪蛋白系列/35G/商品圖", f2), nut
        if "植感濃湯" in n:
            f2 = "田園玉米" if "田園玉米" in n else "蘑菇馬鈴薯"
            return (find("彼蛋白/產品Product/植感濃湯/盒裝30入", f2 + ".png"),
                    find("彼蛋白/產品Product/植感濃湯/35克隨身包", "營養標示_" + f2))
        n35 = find(V + "35克/營養標示", "_" + f + "35g")
        if "35g" in s:
            return find(V + "35克/商品圖", "_" + f + "_35g"), n35
        if "盒裝" in s:
            return find(V + "30入盒裝", "_" + f + ".png"), n35
        return find(V + "500克/商品圖", "_" + f + "_500g"), find(V + "500克/營養標示", "_" + f + "500g")
    if cat == "保健品/必須氨基酸/葡萄糖":
        if n.startswith("PROEAAs"):
            d = "果果能量_PRO EAAs 必需胺基酸"
            return (find(d, f + ".jpg") or official("PRO EAAs " + f, f)), find(d + "/營養標示圖", f)
        if n.startswith("丙胺酸"):
            return find("果果能量_丙胺酸", "丙胺酸.jpg"), find("果果能量_丙胺酸", "營養標示")
        if n.startswith("葡萄糖粉"):
            return find("果果能量_葡萄糖粉", "葡萄糖420.png"), find("果果能量_葡萄糖粉", "營養標")
        tag = SUPP_NUTRI.get(name)
        nut = find("守衛者/營養標示", tag) if tag else None
        short = re.sub(r"\(.*\)|/袋", "", name).strip()
        return official(short, tag or short), nut
    if cat == "零食":
        if n.startswith("無調味綜合堅果"):
            return find("果果堅果_堅果隨身包", "(新)無調味綜合堅果.jpg"), find("果果堅果_堅果隨身包", "(新)無調味綜合堅果_營養標示圖")
        if n.startswith("燕麥脆片"):
            f2 = re.sub(r"｜.*", "", f)
            d = "果果能量_燕麥脆片40g-包"
            return find(d, "燕麥脆片-" + f2 + ".jpg"), find(d, "燕麥脆片-" + f2 + "-營養標示")
        if n.startswith("蛋白香酥脆"):
            d = "果果能量_蛋白香酥脆"
            table = {
                "台南擔仔麵": ("05-F台南擔仔麵.png", "台南擔仔麵_營養標"),
                "和風壽喜燒": ("和風壽喜燒.png", "和風壽喜燒_營養標示"),
                "愛情海瓜子": ("愛情海瓜子_灰底", "愛情海瓜子_營養標"),
                "朱雀辛咖哩": ("朱雀辛咖喱_灰底", "朱雀辛咖喱_營養標示"),
                "泰式酸辣": ("05-F泰式酸辣.png", None),
                "義式紅醬披薩": ("義式紅醬披薩.png", "義式紅醬披薩_營養標"),
            }[f]
            return find(d, table[0]), (find(d, table[1]) if table[1] else None)
        if n.startswith("麥脆朵朵"):
            f2 = re.sub(r"\(.*", "", f)
            return official("麥脆朵朵 " + f2, f2), None
        if n.startswith("堅果能量棒"):
            d = "果果能量_堅果能量棒/黑巧瑪卡"
            return find(d, "黑巧瑪卡盒裝"), find(d, "黑巧瑪卡營養標")
        if n.startswith("脆米蛋白棒"):
            d = "果果能量_脆米蛋白棒/新版脆米蛋白棒"
            return find(d, "新版-" + f + "-盒裝"), find(d, "新版-" + f + "-營養標示")
        if n.startswith("蛋白威化餅"):
            if "草莓起司" in n:
                return (find("果果能量_蛋白威化餅/6入盒裝", "草莓起司"),
                        find("果果能量_蛋白威化餅/上架圖+營養標", "草莓起司風味_營養標"))
            return find("果果能量_蛋白威化餅/6入盒裝", f + ".png"), find("果果能量_蛋白威化餅/上架圖+營養標", f + "_營養標示")
    if cat == "搖搖杯":
        m = re.search(r"【(.*?)】", name)
        label = m.group(1) if m else name
        if "Tumbler" in name:
            f2 = label.replace("Tumbler", "").strip()
            return find("其他周邊_Blender Bottle 不鏽鋼吸管隨行杯", f2), None
        color = label.split()[-1] if m else name.split("--")[-1]
        return official(name.split("【")[0].replace("--" + color, "").strip(), color), None
    return None, None


out = {}
for r in rows:
    if r[8] != "TRUE":
        continue
    cat, name, spec = r[1], r[2], r[3]
    m, nut = resolve(cat, name, spec)
    out[key(name, spec)] = {k: v for k, v in (("main", m if (m or "").startswith("official:") else src(m)),
                                              ("nutri", src(nut))) if v}
    food = cat != "搖搖杯"
    if not m or (food and not nut):
        problems.append("%s %s（%s）：%s%s" % (r[0], name, spec, "" if m else "缺商品圖 ", "缺營養標示" if food and not nut else ""))

json.dump(out, open("tools/image_map.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
off = [k for k, v in out.items() if v.get("main", "").startswith("official:")]
print("商品數", len(out), "／官網抓主圖", len(off))
print("\n".join(problems))
