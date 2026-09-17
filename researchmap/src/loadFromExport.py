"""researchmap の「マイポータル → エクスポート」で取得できる JSONL 一括エクスポート
ファイルから data/*.json を再生成する。

researchmap の REST API が利用制限などで使えないときに、手動でダウンロードした
エクスポートファイルを使って getResearchmapData.py と同じ処理（テキスト抽出・
ジオコーディング・整形）を行うためのスクリプト。

使い方:
    uv run researchmap/src/loadFromExport.py path/to/rm_researchers20260917.jsonl

    引数を省略した場合は researchmap/data/rm_export.jsonl を読みに行く
    （このパスは .gitignore 対象なので、ダウンロードしたファイルをそのまま
    このパスにコピー/リネームして置いておける）。

エクスポート内の各行は次の形式:
    {"insert": {"type": "published_papers", "id": "...", "user_id": "..."},
     "merge":  {...researchmap API と同じフィールド...}}

"merge" の中身は researchmap API のレスポンス項目とほぼ同じ形なので、
getResearchmapData.py 側の抽出ロジック（mltext / extract_authors 等）を
そのまま再利用できる。id だけ "@id" に詰め替えて item_id() と互換にする。
"""

import json
import sys
from collections import defaultdict

from getResearchmapData import fetch_all


DEFAULT_PATH = "researchmap/data/rm_export.jsonl"


def load_export(path):
    """JSONL エクスポートを読み込み、{rm_type: [item, ...]} の形にまとめる。"""
    by_type = defaultdict(list)
    with open(path, encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"  [skip] line {lineno}: invalid JSON ({e})")
                continue

            insert = record.get("insert", {})
            rm_type = insert.get("type")
            item = dict(record.get("merge", {}))
            item["@id"] = insert.get("id", "")
            if rm_type:
                by_type[rm_type].append(item)

    for rm_type, items in sorted(by_type.items()):
        print(f"  {rm_type}: {len(items)} items")
    return by_type


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    print(f"Loading researchmap export: {path}")
    by_type = load_export(path)
    fetch_all(get_items=lambda rm_type: by_type.get(rm_type, []))


if __name__ == "__main__":
    main()
