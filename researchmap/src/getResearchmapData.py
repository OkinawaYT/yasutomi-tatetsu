import os
import requests
import json
from datetime import datetime

# ==========================================
# 設定領域
# ==========================================
RM_PERMALINK = "yasutomi_tatetsu"
BASE_API_URL = f"https://api.researchmap.jp/{RM_PERMALINK}"

CONTENT_ROOT = "content"
DATA_ROOT = "researchmap/data"

ACHIEVEMENT_TYPES = {
    # [出版物・成果物系] -> Hugoの 'publication' フォルダへ
    "published_papers": {"title": "paper_title", "date": "publication_date", "folder": "publication"},
    "misc": {"title": "paper_title", "date": "publication_date", "folder": "publication"},
    "books_etc": {"title": "book_title", "date": "publication_date", "folder": "publication"},
    "works": {"title": "work_title", "date": "from_date", "folder": "publication"},
    "industrial_property_rights": {"title": "industrial_property_right_title", "date": "application_date", "folder": "publication"},
    "research_data": {"title": "research_data_title", "date": "posted_date", "folder": "publication"}, # v4.6.2 追加項目
    "others": {"title": "other_title", "date": "from_date", "folder": "publication"},

    # [イベント・活動系] -> Hugoの 'event' フォルダへ
    "presentations": {"title": "presentation_title", "date": "publication_date", "folder": "event"},
    "social_contribution": {"title": "social_contribution_title", "date": "from_event_date", "folder": "event"},
    "media_coverage": {"title": "media_coverage_title", "date": "publication_date", "folder": "event"},
    "academic_contribution": {"title": "academic_contribution_title", "date": "from_event_date", "folder": "event"},

    # [プロジェクト・受賞] -> Hugoの 'project', 'award' フォルダへ
    "awards": {"title": "award_name", "date": "award_date", "folder": "award"},
    "research_projects": {"title": "research_project_title", "date": "from_date", "folder": "project"},

    # [プロフィール・経歴系] -> 一覧表示用に 'profile_data' 等へ
    "research_interests": {"title": "keyword", "date": None, "folder": "profile_data"},
    "research_areas": {"title": "research_field", "date": None, "folder": "profile_data"},
    "research_experience": {"title": "affiliation", "date": "from_date", "folder": "profile_data"},
    "education": {"title": "affiliation", "date": "from_date", "folder": "profile_data"},
    "committee_memberships": {"title": "committee_name", "date": "from_date", "folder": "profile_data"},
    "teaching_experience": {"title": "subject_name", "date": "from_date", "folder": "profile_data"},
    "association_memberships": {"title": "academic_society_name", "date": "from_date", "folder": "profile_data"}
}

def get_multilingual_text(data_node, key):
    """ja/en構造を持つノードから適切なテキストを抽出する"""
    if not data_node or key not in data_node:
        return "No Title"
    node = data_node[key]
    if isinstance(node, dict):
        return node.get("ja") or node.get("en", "No Title")
    return str(node)

def fetch_and_generate():
    # データの保存先フォルダ作成
    os.makedirs(DATA_ROOT, exist_ok=True)

    for ach_type, mapping in ACHIEVEMENT_TYPES.items():
        api_url = f"{BASE_API_URL}/{ach_type}?limit=1000"
        print(f"Fetching: {ach_type}...")

        response = requests.get(api_url)
        if response.status_code != 200: continue

        data = response.json()

        # JSONを保存 (researchmap/data/ フォルダへ)
        with open(f"{DATA_ROOT}/{ach_type}.json", "w", encoding="utf-8") as jf:
            json.dump(data, jf, ensure_ascii=False, indent=2)

        items = data.get("items", [])
        for item in items:
            item_id = item.get("@id", "").split("/")[-1]
            if not item_id: continue

            title = get_multilingual_text(item, mapping["title"])
            date_key = mapping["date"]
            date_str = item.get(date_key) or item.get("rm:created", "2000-01-01").split("T")[0]

            # 日付補完処理
            if len(date_str) == 7: date_str += "-01"
            elif len(date_str) == 4: date_str += "-01-01"

            # content/フォルダへのパス (例: content/publication/rm_...)
            dir_path = os.path.join(CONTENT_ROOT, mapping['folder'], f"rm_{ach_type}_{item_id}")
            os.makedirs(dir_path, exist_ok=True)

            md_content = f"""---
title: "{title.replace('"', '')}"
date: "{date_str}T00:00:00Z"
publishDate: "{date_str}T00:00:00Z"
authors: ["admin"]
rm_type: "{ach_type}"
---
"""
            with open(os.path.join(dir_path, "index.md"), "w", encoding="utf-8") as f:
                f.write(md_content)

if __name__ == "__main__":
    fetch_and_generate()