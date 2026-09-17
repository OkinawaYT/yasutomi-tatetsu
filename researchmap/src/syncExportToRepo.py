"""毎週日曜 0:00 に launchd (plist) から実行される想定のスクリプト。

やること:
  1. ダウンロードフォルダ等から researchmap のエクスポート（rm_researchers*.jsonl）
     を探し、リポジトリの researchmap/imports/ にあるものより新しいか確認する。
  2. 新しいものがあれば researchmap/imports/ に取り込み、コミットして push する。
  3. push すると .github/workflows/update_rm.yml の
     `push: paths: researchmap/imports/*.jsonl` トリガーで
     GitHub Actions が自動的に data/*.json を再生成してコミットする
     （その部分はこのスクリプトでは何もしなくてよい）。

新しい実行ファイルなので git 管理はするが、実際に launchd に登録する
.plist ファイル自体はマシン固有の絶対パスを含むため git 管理対象外とする
（~/Library/LaunchAgents に直接置く）。

ログは ~/Library/Logs/researchmap-sync.log に追記する
（launchd はターミナルに出力を表示してくれないため）。
"""

import hashlib
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parents[2]   # .../yasutomi-tatetsu
IMPORTS_DIR = REPO_DIR / "researchmap" / "imports"

# researchmap からダウンロードしたエクスポートを探すフォルダとパターン。
# 複数箇所を探したい場合はここに追記する。
SEARCH_DIRS = [Path.home() / "Downloads"]
FILENAME_GLOB = "rm_researchers*.jsonl"

LOG_FILE = Path.home() / "Library" / "Logs" / "researchmap-sync.log"

GIT = shutil.which("git") or "/opt/homebrew/bin/git"


def log(msg):
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(cmd, **kwargs):
    log(f"$ {' '.join(cmd)}")
    result = subprocess.run(
        cmd, cwd=REPO_DIR, capture_output=True, text=True, **kwargs
    )
    if result.stdout.strip():
        log(result.stdout.strip())
    if result.stderr.strip():
        log(result.stderr.strip())
    return result


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_candidate():
    """SEARCH_DIRS の中から一番新しい（mtime）エクスポートを探す。"""
    candidates = []
    for d in SEARCH_DIRS:
        candidates.extend(d.glob(FILENAME_GLOB))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def already_imported(candidate):
    """researchmap/imports/ 内の既存ファイルと内容が同じなら True。"""
    if not IMPORTS_DIR.exists():
        return False
    candidate_hash = sha256(candidate)
    for existing in IMPORTS_DIR.glob("*.jsonl"):
        if sha256(existing) == candidate_hash:
            return True
    return False


def main():
    log("=== researchmap export sync: start ===")

    candidate = find_latest_candidate()
    if candidate is None:
        log(f"No export file found matching {FILENAME_GLOB!r} in {SEARCH_DIRS}. Nothing to do.")
        return

    log(f"Latest candidate: {candidate}")

    if already_imported(candidate):
        log("Already imported (same content already in researchmap/imports/). Nothing to do.")
        return

    # リポジトリを最新化してから作業する（CI の自動コミットと衝突しないように）
    run([GIT, "fetch", "origin"])
    pull = run([GIT, "pull", "--rebase", "origin", "main"])
    if pull.returncode != 0:
        log("git pull --rebase failed — aborting (resolve manually).")
        run([GIT, "rebase", "--abort"])
        return

    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 古いエクスポートは残さず、常に最新の1件だけを保持する
    for old in IMPORTS_DIR.glob("*.jsonl"):
        log(f"Removing old export: {old.name}")
        old.unlink()

    dest = IMPORTS_DIR / candidate.name
    shutil.copy2(candidate, dest)
    log(f"Copied new export to {dest}")

    run([GIT, "add", str(dest.relative_to(REPO_DIR))])
    # 古いファイルの削除も add に含める（git add -A の方が確実）
    run([GIT, "add", "-A", "researchmap/imports"])

    status = run([GIT, "status", "--porcelain", "researchmap/imports"])
    if not status.stdout.strip():
        log("No changes to commit after copy (unexpected). Nothing to do.")
        return

    commit_msg = f"chore: update researchmap export ({datetime.now():%Y-%m-%d})"
    commit = run([GIT, "commit", "-m", commit_msg])
    if commit.returncode != 0:
        log("git commit failed — aborting.")
        return

    push = run([GIT, "push", "origin", "main"])
    if push.returncode != 0:
        log("git push failed — check network/credentials and retry manually.")
        return

    log("Pushed new export — GitHub Actions will rebuild data/*.json automatically.")
    log("=== researchmap export sync: done ===")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        log("ERROR:\n" + traceback.format_exc())
        sys.exit(1)
