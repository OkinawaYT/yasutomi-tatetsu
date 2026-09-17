"""researchmap の「マイポータル → エクスポート」で取得できる JSONL 一括エクスポート
ファイルから data/*.json を再生成する。

researchmap の REST API が利用制限などで使えないときに、手動でダウンロードした
エクスポートファイルを使って getResearchmapData.py と同じ処理（テキスト抽出・
ジオコーディング・整形）を行うためのスクリプト。

使い方:
    uv run researchmap/src/loadFromExport.py path/to/rm_researchers20260917.jsonl

    引数を省略した場合は researchmap/imports/ 以下を見に行く
    （rm_export.jsonl という名前があればそれを、無ければ *.jsonl のうち
    最も新しいものを使う）。researchmap/imports/ は（researchmap/data/ と
    違って）.gitignore 対象外なので、ダウンロードしたファイルをファイル名の
    ままここに置いて push すると、GitHub Actions が自動でこのスクリプトを
    実行し data/*.json を更新・コミットする
    （.github/workflows/update_rm.yml 参照）。

エクスポート内の各行は次の形式:
    {"insert": {"type": "published_papers", "id": "...", "user_id": "..."},
     "merge":  {...researchmap API と同じフィールド...}}

"merge" の中身は researchmap API のレスポンス項目とほぼ同じ形なので、
getResearchmapData.py 側の抽出ロジック（mltext / extract_authors 等）を
そのまま再利用できる。id だけ "@id" に詰め替えて item_id() と互換にする。
"""

import glob
import json
import os
import sys
from collections import defaultdict

from getResearchmapData import fetch_all


IMPORTS_DIR = "researchmap/imports"
DEFAULT_PATH = f"{IMPORTS_DIR}/rm_export.jsonl"


def find_default_path():
    """引数なしで実行された場合に使うファイルを決める。

    researchmap/imports/rm_export.jsonl という決め打ちの名前があればそれを、
    無ければ researchmap/imports/ 直下の *.jsonl のうち最終更新が一番新しい
    ものを使う（researchmap からダウンロードしたファイル名のまま置いてよい）。
    """
    if os.path.exists(DEFAULT_PATH):
        return DEFAULT_PATH
    candidates = glob.glob(f"{IMPORTS_DIR}/*.jsonl")
    if not candidates:
        return DEFAULT_PATH  # 存在しないが、呼び出し元でエラーにする
    return max(candidates, key=os.path.getmtime)


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
    path = sys.argv[1] if len(sys.argv) > 1 else find_default_path()
    if not os.path.exists(path):
        sys.exit(f"Export file not found: {path}\n"
                  f"({IMPORTS_DIR}/ に researchmap からダウンロードした .jsonl を置いてください)")
    print(f"Loading researchmap export: {path}")
    by_type = load_export(path)
    fetch_all(get_items=lambda rm_type: by_type.get(rm_type, []))


if __name__ == "__main__":
    main()
