"""off-foods.js（市販品の食品データ）を、Open Food Facts のデータファイルから作ります。

データファイル: https://world.openfoodfacts.org/data の CSV（en.openfoodfacts.org.products.csv.gz）。
API はたくさん叩かず、公式が勧めるデータファイルから必要な分だけを取り出す。

ライセンス: Open Food Facts のデータベースは Open Database License (ODbL) 1.0、
個々の内容は Database Contents License (DbCL) 1.0。取り出した off-foods.js も ODbL で公開する。
成分表のデータ（foods.js）やアプリのコードとは別のファイルにしておく。

取り出す条件:
- 販売国に日本（en:japan）を含み、商品名に日本語（ひらがな・カタカナ・漢字）が入っている
- 100g あたりのエネルギー（kcal）・たんぱく質・脂質・炭水化物がすべて入っている
- 値がありうる範囲にある（kcal 0〜900、各 0〜100g、P＋F＋C が 105g 以下）
- kcal が P×4＋F×9＋C×4 から 25%（小さい値は 25kcal）より大きく外れていない（入力ミスを除くため）
- 同じバーコードは1つだけ。同じ商品名・ブランドが重なったら、新しく更新された方を残す
- スキャンされた回数の多い順に、最大 LIMIT 件

実行: python3 -I tools/build_off_foods.py <products.csv.gz> off-foods.js
"""
import csv
import gzip
import json
import re
import sys

LIMIT = 5000
JP = re.compile(r"[぀-ヿ一-鿿]")


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None  # NaN を除く


def main(src, out):
    csv.field_size_limit(sys.maxsize)
    seen_codes = set()
    best = {}
    stats = {"japan": 0, "nutrients": 0, "consistent": 0}
    with gzip.open(src, "rt", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        for row in reader:
            if "en:japan" not in (row.get("countries_tags") or ""):
                continue
            stats["japan"] += 1
            name = (row.get("product_name") or "").strip()
            if not name or not JP.search(name):
                continue
            kcal = num(row.get("energy-kcal_100g"))
            p = num(row.get("proteins_100g"))
            f = num(row.get("fat_100g"))
            c = num(row.get("carbohydrates_100g"))
            if kcal is None or p is None or f is None or c is None:
                continue
            if not (0 <= kcal <= 900 and 0 <= p <= 100 and 0 <= f <= 100 and 0 <= c <= 100 and p + f + c <= 105):
                continue
            stats["nutrients"] += 1
            est = p * 4 + f * 9 + c * 4
            if abs(kcal - est) > max(25, kcal * 0.25):
                continue
            stats["consistent"] += 1
            code = (row.get("code") or "").strip()
            if not re.fullmatch(r"\d{6,14}", code) or code in seen_codes:
                continue
            seen_codes.add(code)
            brand = (row.get("brands") or "").split(",")[0].strip()
            key = (re.sub(r"\s+", "", name), brand)
            item = {
                "code": code, "name": re.sub(r"\s+", " ", name)[:80], "brand": brand[:40],
                "kcal": round(kcal), "p": round(p, 1), "f": round(f, 1), "c": round(c, 1),
                "scans": int(num(row.get("unique_scans_n")) or 0),
                "modified": int(num(row.get("last_modified_t")) or 0),
            }
            prev = best.get(key)
            if prev is None or item["modified"] > prev["modified"]:
                best[key] = item

    items = sorted(best.values(), key=lambda x: (-x["scans"], -x["modified"], x["code"]))[:LIMIT]
    lines = [
        "// 市販品の食品データ（100gあたり）— tools/build_off_foods.py が自動で作るファイルです。手で直さないでください。",
        "// Contains data from Open Food Facts (https://world.openfoodfacts.org/), available under the",
        "// Open Database License (ODbL) 1.0 https://opendatacommons.org/licenses/odbl/1-0/ .",
        "// 個々の内容は Database Contents License (DbCL) 1.0。このファイル（取り出した部分）も ODbL で公開します。",
        "// 誰でも編集できるデータのため、誤りが含まれることがあります。正確さは保証されません。",
        "window.OFF_FOODS = [",
    ]
    rows = []
    for it in items:
        rows.append("  " + json.dumps({
            "id": "off:" + it["code"],
            "name": it["name"] + ("（" + it["brand"] + "）" if it["brand"] else ""),
            "category": "市販品",
            "kcal": it["kcal"], "p": it["p"], "f": it["f"], "c": it["c"],
            "source": "Open Food Facts " + it["code"],
        }, ensure_ascii=False))
    lines.append(",\n".join(rows))
    lines.append("];")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("japan", stats["japan"], "with 4 nutrients", stats["nutrients"],
          "consistent", stats["consistent"], "unique", len(best), "wrote", len(items))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
