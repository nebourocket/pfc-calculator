"""見出し・大きな数字・はんこに使う手書き風フォント（Klee One SemiBold）を、使う文字だけに絞ります。

元のフォント: https://github.com/google/fonts/tree/main/ofl/kleeone （SIL Open Font License 1.1、
予約フォント名なし。ライセンス文は fonts/KleeOne-OFL.txt）
全部入りは約9MB あるため、手書き体で表示する文字だけを残して約40KB の woff2 にする。
画面の見出しや、手書き体の要素に入る文字列を変えたら、このスクリプトを実行し直す。

実行（fontTools と brotli が要る）:
  python3 -I tools/build_font_subset.py <KleeOne-SemiBold.ttf> fonts/KleeOne-SemiBold-subset.woff2
"""
import re
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent

# JS が手書き体の要素（残りカロリー・連続記録・お知らせ・週のふり返りの数字・はんこ）に入れる文字列。
JS_TEXT = [
    "あと kcal オーバー", "日連続で記録中（今日の記録で更新）", "今日から記録を始めよう",
    "記録の連続が自己ベスト更新：日", "日連続で記録しています", "/ 7日 kcal g —", "◎○・",
    "0123456789,.%+−±", "Pro 円 買い切り",
]


def collect_text():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    legal = (ROOT / "legal.html").read_text(encoding="utf-8")
    parts = []
    for src in (html, legal):
        parts += re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", src, re.S)
    parts += re.findall(r'<button type="button" class="tab"[^>]*>(.*?)</button>', html)
    parts += re.findall(r'class="hanko"[^>]*>(.*?)</span></span>', html)
    parts += re.findall(r'class="celebrate-title">(.*?)<', html)
    parts += re.findall(r'class="price">(.*?)</p>', html, re.S)
    text = re.sub(r"<[^>]+>", "", "".join(parts + JS_TEXT))
    chars = set(text) | {chr(c) for c in range(0x20, 0x7F)}
    return "".join(sorted(c for c in chars if c not in "\n\r\t"))


def main(src, out):
    text = collect_text()
    subset.main([
        src, "--text=" + text, "--flavor=woff2", "--layout-features=kern,palt",
        "--no-hinting", "--desubroutinize", "--drop-tables+=DSIG,BASE", "--name-IDs=*",
        "--output-file=" + out,
    ])
    print(len(text), "chars ->", out, Path(out).stat().st_size, "bytes")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
