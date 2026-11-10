"""foods.js を、文部科学省「日本食品標準成分表（八訂）増補2023年」の Excel から作ります。

数値は手で打たず、すべてこのスクリプトが Excel から読み取ります。
使う列（成分識別子）: ENERC_KCAL（エネルギー kcal）・PROT-（たんぱく質）・FAT-（脂質）・CHOCDF-（炭水化物）。
Excel は https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html の「第2章（データ）」。
文部科学省ウェブサイト利用規約（https://www.mext.go.jp/b_menu/1351168.htm）に従い、出典と加工したことを表示する。

SELECTION の食品は分かりやすい名前を付けた「よく使う食品」（common: true）。
それ以外の全食品は成分表の正式名で入れる（4項目のどれかが未測定 "-" の食品だけ除く）。

実行: python3 -I tools/build_foods.py <Excel のパス> foods.js
"""
import json
import re
import sys

import openpyxl

# (食品番号, アプリでの id, 表示名, 分類)。食品番号は成分表の番号で、名前は Excel の食品名と照合して表示する。
SELECTION = [
    # 主食
    ("01088", "rice", "ごはん（精白米・炊いたもの）", "主食"),
    ("01085", "brown-rice", "玄米ごはん", "主食"),
    ("01117", "mochi", "もち", "主食"),
    ("01026", "bread", "食パン", "主食"),
    ("01034", "roll", "ロールパン", "主食"),
    ("01148", "bagel", "ベーグル", "主食"),
    ("01004", "oatmeal", "オートミール（乾燥）", "主食"),
    ("01137", "cornflakes", "コーンフレーク", "主食"),
    ("01039", "udon", "うどん（ゆで）", "主食"),
    ("01128", "soba", "そば（ゆで）", "主食"),
    ("01044", "somen", "そうめん・ひやむぎ（ゆで）", "主食"),
    ("01048", "ramen-noodle", "中華めん（ゆで）", "主食"),
    ("01064", "pasta", "パスタ（ゆで）", "主食"),
    ("02017", "potato", "じゃがいも（皮なし・生）", "主食"),
    ("02006", "sweet-potato", "さつまいも（皮なし・生）", "主食"),
    # 肉
    ("11220", "chicken-breast", "鶏むね肉（皮なし・生）", "肉"),
    ("11219", "chicken-breast-skin", "鶏むね肉（皮つき・生）", "肉"),
    ("11227", "chicken-sasami", "ささみ（生）", "肉"),
    ("11224", "chicken-thigh", "鶏もも肉（皮なし・生）", "肉"),
    ("11221", "chicken-thigh-skin", "鶏もも肉（皮つき・生）", "肉"),
    ("11286", "chicken-wing", "手羽もと（皮つき・生）", "肉"),
    ("11230", "chicken-minced", "鶏ひき肉（生）", "肉"),
    ("11232", "chicken-liver", "鶏レバー（生）", "肉"),
    ("11140", "pork-fillet", "豚ヒレ肉（赤肉・生）", "肉"),
    ("11123", "pork-loin", "豚ロース肉（脂身つき・生）", "肉"),
    ("11131", "pork-round", "豚もも肉（皮下脂肪なし・生）", "肉"),
    ("11129", "pork-belly", "豚ばら肉（生）", "肉"),
    ("11163", "pork-minced", "豚ひき肉（生）", "肉"),
    ("11048", "beef-round", "牛もも肉（国産牛・皮下脂肪なし・生）", "肉"),
    ("11076", "beef-round-import", "牛もも肉（輸入牛・皮下脂肪なし・生）", "肉"),
    ("11046", "beef-belly", "牛ばら肉（国産牛・生）", "肉"),
    ("11089", "beef-minced", "牛ひき肉（生）", "肉"),
    ("11176", "ham", "ロースハム", "肉"),
    ("11183", "bacon", "ベーコン（ばら）", "肉"),
    ("11186", "sausage", "ウインナーソーセージ", "肉"),
    # 魚
    ("10134", "salmon", "鮭（しろさけ・生）", "魚"),
    ("10154", "mackerel", "さば（まさば・生）", "魚"),
    ("10253", "tuna", "まぐろ（くろまぐろ・天然・赤身・生）", "魚"),
    ("10260", "tuna-can", "ツナ缶（水煮・ライト）", "魚"),
    ("10263", "tuna-can-oil", "ツナ缶（油漬・ライト）", "魚"),
    ("10003", "aji", "あじ（まあじ・皮つき・生）", "魚"),
    ("10047", "sardine", "いわし（まいわし・生）", "魚"),
    ("10173", "sanma", "さんま（皮つき・生）", "魚"),
    ("10241", "buri", "ぶり（成魚・生）", "魚"),
    ("10205", "cod", "たら（まだら・生）", "魚"),
    ("10329", "shrimp", "えび（ブラックタイガー・生）", "魚"),
    ("10345", "squid", "いか（するめいか・生）", "魚"),
    ("10362", "octopus", "たこ（まだこ・ゆで）", "魚"),
    ("10281", "asari", "あさり（生）", "魚"),
    ("10313", "scallop", "ほたて貝柱（生）", "魚"),
    # 卵・大豆
    ("12004", "egg", "卵（鶏卵・全卵・生）", "卵・大豆"),
    ("12005", "egg-boiled", "ゆで卵（全卵）", "卵・大豆"),
    ("12014", "egg-white", "卵白（生）", "卵・大豆"),
    ("04046", "natto", "納豆（糸引き納豆）", "卵・大豆"),
    ("04032", "tofu", "木綿豆腐", "卵・大豆"),
    ("04033", "tofu-silken", "絹ごし豆腐", "卵・大豆"),
    ("04039", "atsuage", "厚揚げ（生揚げ）", "卵・大豆"),
    ("04040", "aburaage", "油揚げ（生）", "卵・大豆"),
    ("04052", "soy-milk", "豆乳（無調整）", "卵・大豆"),
    ("04053", "soy-milk-adjusted", "調製豆乳", "卵・大豆"),
    ("06016", "edamame", "枝豆（ゆで）", "卵・大豆"),
    # 乳製品
    ("13003", "milk", "牛乳（普通）", "乳製品"),
    ("13005", "milk-lowfat", "低脂肪乳", "乳製品"),
    ("13025", "yogurt", "ヨーグルト（全脂無糖）", "乳製品"),
    ("13054", "yogurt-nonfat", "ヨーグルト（無脂肪無糖）", "乳製品"),
    ("13026", "yogurt-sweet", "ヨーグルト（脱脂加糖）", "乳製品"),
    ("13033", "cottage-cheese", "カッテージチーズ", "乳製品"),
    ("13040", "process-cheese", "プロセスチーズ", "乳製品"),
    ("13056", "mozzarella", "モッツァレラチーズ", "乳製品"),
    # 野菜・きのこ・海藻
    ("06263", "broccoli", "ブロッコリー（生）", "野菜"),
    ("06264", "broccoli-boiled", "ブロッコリー（ゆで）", "野菜"),
    ("06267", "spinach", "ほうれんそう（生）", "野菜"),
    ("06061", "cabbage", "キャベツ（生）", "野菜"),
    ("06182", "tomato", "トマト（生）", "野菜"),
    ("06183", "mini-tomato", "ミニトマト（生）", "野菜"),
    ("06214", "carrot", "にんじん（皮なし・生）", "野菜"),
    ("06153", "onion", "たまねぎ（生）", "野菜"),
    ("06312", "lettuce", "レタス（生）", "野菜"),
    ("06065", "cucumber", "きゅうり（生）", "野菜"),
    ("06291", "moyashi", "もやし（りょくとう・生）", "野菜"),
    ("06245", "green-pepper", "ピーマン（生）", "野菜"),
    ("06191", "eggplant", "なす（生）", "野菜"),
    ("06048", "pumpkin", "かぼちゃ（西洋・生）", "野菜"),
    ("08016", "shimeji", "しめじ（ぶなしめじ・生）", "野菜"),
    ("08001", "enoki", "えのきたけ（生）", "野菜"),
    ("08028", "maitake", "まいたけ（生）", "野菜"),
    ("09041", "wakame", "わかめ（乾燥・水戻し）", "野菜"),
    # 果物
    ("07107", "banana", "バナナ", "果物"),
    ("07148", "apple", "りんご（皮なし）", "果物"),
    ("07027", "mikan", "みかん（うんしゅうみかん）", "果物"),
    ("07054", "kiwi", "キウイフルーツ（緑肉種）", "果物"),
    ("07012", "strawberry", "いちご", "果物"),
    ("07116", "grape", "ぶどう（皮なし）", "果物"),
    ("07062", "grapefruit", "グレープフルーツ（白肉種）", "果物"),
    ("07124", "blueberry", "ブルーベリー", "果物"),
    ("07006", "avocado", "アボカド", "果物"),
    # その他
    ("05040", "almond", "アーモンド（いり・無塩）", "その他"),
    ("05014", "walnut", "くるみ（いり）", "その他"),
    ("05035", "peanut", "ピーナッツ（いり）", "その他"),
    ("14001", "olive-oil", "オリーブ油", "その他"),
    ("14017", "butter", "バター（有塩）", "その他"),
    ("17042", "mayonnaise", "マヨネーズ（全卵型）", "その他"),
    ("03022", "honey", "はちみつ", "その他"),
    ("03003", "sugar", "砂糖（上白糖）", "その他"),
    ("15116", "chocolate", "ミルクチョコレート", "その他"),
]

# 成分表に無いもの。値は以前から foods.js にあった目安値をそのまま使う（製品によって大きく違う）。
EXTRA = '  { "id": "protein", "name": "プロテイン（ホエイ・粉末・目安）", "category": "その他", "kcal": 390, "p": 78.0, "f": 4.0, "c": 6.0, "source": "", "common": true }'

COLUMNS = {"kcal": "ENERC_KCAL", "p": "PROT-", "f": "FAT-", "c": "CHOCDF-"}


def to_number(v):
    """成分表の記号を数値にする。( ) は推定値なので中の数を使い、Tr（微量）と (0) は 0 にする。"""
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("(", "").replace(")", "")
    if s in ("Tr", "0", ""):
        return 0.0
    if s == "-":
        raise ValueError("未測定 (-) の値は使いません")
    return float(s)


def main(xlsx, out):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb["表全体"]
    header = next(ws.iter_rows(min_row=12, max_row=12, values_only=True))
    col = {k: header.index(v) for k, v in COLUMNS.items()}
    rows = {str(r[1]): r for r in ws.iter_rows(min_row=13, values_only=True) if r[1]}

    # シート名「1穀類」「10魚介類」などから、食品群の名前を取る。
    groups = {}
    for sheet in wb.sheetnames:
        m = re.match(r"^(\d+)(.+)$", sheet)
        if m:
            groups["%02d" % int(m.group(1))] = m.group(2)

    def clean(name):
        return re.sub(r"\s+", " ", str(name).replace("　", " ")).strip()

    def entry(fid, name, category, v, source, common):
        item = {"id": fid, "name": name, "category": category}
        item.update({k: round(v[k], 1) if k != "kcal" else round(v[k]) for k in ("kcal", "p", "f", "c")})
        item["source"] = source
        if common:
            item["common"] = True
        return "  " + json.dumps(item, ensure_ascii=False)

    items = []
    ids = set()
    for number, fid, name, category in SELECTION:
        if fid in ids:
            raise SystemExit("id が重複しています: " + fid)
        ids.add(fid)
        r = rows.get(number)
        if r is None:
            raise SystemExit("食品番号が見つかりません: " + number)
        v = {k: to_number(r[i]) for k, i in col.items()}
        items.append(entry(fid, name, category, v, number + " " + clean(r[3]), True))
    items.append(EXTRA)

    # 残りの全食品（正式名）。表示名からは先頭の「＜魚類＞」のような見出しを外す。
    chosen = {n for n, _, _, _ in SELECTION}
    count = skipped = 0
    for number in sorted(rows):
        if number in chosen:
            continue
        r = rows[number]
        try:
            v = {k: to_number(r[i]) for k, i in col.items()}
        except ValueError:
            skipped += 1
            continue
        official = clean(r[3])
        display = re.sub(r"^＜[^＞]*＞\s*", "", official)
        items.append(entry("m" + number, display, groups[str(r[0])], v, number + " " + official, False))
        count += 1

    lines = [
        "// 食品データ（100gあたり）— tools/build_foods.py が自動で作るファイルです。手で直さないでください。",
        "// 出典：「日本食品標準成分表（八訂）増補2023年」（文部科学省）"
        "（https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html）を加工して作成",
        "// （正誤表 令和8年3月27日 反映済みのデータ。kcal＝エネルギー、p＝たんぱく質、f＝脂質、c＝炭水化物）",
        "// common: true は「よく使う食品」（分かりやすい名前を付けたもの）。それ以外は成分表の正式名。",
        "// プロテインは成分表に無く、製品によって大きく異なるため、代表的なホエイプロテインの目安値です。",
        "window.FOODS = [",
        ",\n".join(items),
        "];",
    ]
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("wrote", out, "common", len(SELECTION) + 1, "others", count, "skipped", skipped)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
