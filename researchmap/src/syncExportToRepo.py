"""毎週日曜 0:00 に launchd (plist) から実行される想定のスクリプト。

前提: researchmap からダウンロードしたエクスポート（rm_researchers*.jsonl）は
      手動で researchmap/imports/ に置く（このスクリプトはダウンロード
      フォルダなどを探索しない）。

やること:
  1. researchmap/imports/ に git 未コミットの変更（新しいファイル・更新された
     ファイル・削除されたファイル）がないか確認する。
  2. 変更があれば commit して push する。
  3. push すると .github/workflows/update_rm.yml の
     `push: paths: researchmap/imports/*.jsonl` トリガーで
     GitHub Actions が自動的に data/*.json を再生成してコミットする
     （その部分はこのスクリプトでは何もしなくてよい）。

"更新されたかどうか" は git の差分検出（git status）で判定する。
ファイルの mtime だけを見ると git checkout 等で意図せず新しく見えて
しまうことがあるため、内容ベースの git diff の方が確実。

新しい実行ファイルなので git 管理はするが、実際に launchd に登録する
.plist ファイル自体はマシン固有の絶対パスを含むため git 管理対象外とする
（~/Library/LaunchAgents に直接置く）。

ログは ~/Library/Logs/researchmap-sync.log に追記する
（launchd はターミナルに出力を表示してくれないため）。
"""

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parents[2]   # .../yasutomi-tatetsu
IMPORTS_REL = "researchmap/imports"
IMPORTS_DIR = REPO_DIR / IMPORTS_REL

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


def imports_changed():
    """researchmap/imports/ に未コミットの変更（新規/更新/削除）があるか。"""
    status = run([GIT, "status", "--porcelain", "--", IMPORTS_REL])
    return status.stdout.strip()


def main():
    log("=== researchmap export sync: start ===")

    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)

    changes = imports_changed()
    if not changes:
        log(f"No changes under {IMPORTS_REL}/. Nothing to do.")
        return

    log(f"Detected changes under {IMPORTS_REL}/:\n{changes}")

    # researchmap/imports/ の変更を一旦退避してからリポジトリを最新化する
    # （git pull --rebase は他のファイルに未コミットの変更があると拒否するため）
    stash = run([GIT, "stash", "push", "--include-untracked", "--", IMPORTS_REL])
    stashed = "No local changes to save" not in stash.stdout

    run([GIT, "fetch", "origin"])
    pull = run([GIT, "pull", "--rebase", "origin", "main"])
    if pull.returncode != 0:
        log("git pull --rebase failed — aborting (resolve manually).")
        run([GIT, "rebase", "--abort"])
        if stashed:
            run([GIT, "stash", "pop"])
        return

    if stashed:
        pop = run([GIT, "stash", "pop"])
        if pop.returncode != 0:
            log("git stash pop failed — resolve manually (changes are safe in the stash).")
            return

    run([GIT, "add", "-A", "--", IMPORTS_REL])

    status = run([GIT, "status", "--porcelain", "--", IMPORTS_REL])
    if not status.stdout.strip():
        log("No staged changes after add (unexpected). Nothing to do.")
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

    log("Pushed updated export — GitHub Actions will rebuild data/*.json automatically.")
    log("=== researchmap export sync: done ===")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        log("ERROR:\n" + traceback.format_exc())
        sys.exit(1)
