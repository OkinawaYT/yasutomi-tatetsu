import os
import time
import requests
import json
from datetime import date

RM_PERMALINK = "yasutomi_tatetsu"
BASE_API_URL = f"https://api.researchmap.jp/{RM_PERMALINK}"

RAW_ROOT   = "researchmap/data"       # 生JSONキャッシュ（gitignore）
SITE_DATA  = "data"                   # サイト表示用クリーンJSON
GEO_CACHE  = "data/location_cache.json"  # ジオコーディングキャッシュ


# ──────────────────────────────────────────────
# ジオコーディング（Nominatim / OpenStreetMap）
# ──────────────────────────────────────────────

def load_geo_cache():
    if os.path.exists(GEO_CACHE):
        with open(GEO_CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_geo_cache(cache):
    with open(GEO_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)


def geocode(place, cache, max_retries=4):
    """場所名 → {"lat": float, "lon": float} または None。キャッシュを使い回す。"""
    if not place:
        return None
    # キャッシュにあり、かつ null でない（前回の成功結果）は再利用
    if place in cache and cache[place] is not None:
        return cache[place]
    # キャッシュに null がある場合でも再試行（前回の 429 失敗を上書き可能）
    # ただし "_retry": false のフラグがあればスキップ
    if cache.get(place) == {"_permanent": True}:
        return None

    url = (
        "https://nominatim.openstreetmap.org/search"
        f"?q={requests.utils.quote(place)}"
        "&format=json&limit=1&accept-language=ja,en"
    )
    headers = {"User-Agent": "TatetsuLab-ResearchmapSync/1.0 (y.tatetsu@meio-u.ac.jp)"}

    for attempt in range(max_retries):
        try:
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"    [geocode] '{place}' → 429 rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            r.raise_for_status()
            data = r.json()
            result = {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])} if data else None
            cache[place] = result
            time.sleep(1.5)  # Nominatim ポリシー：1 req/s
            if result:
                print(f"    [geocode] '{place}' → {result['lat']:.4f}, {result['lon']:.4f}")
            else:
                print(f"    [geocode] '{place}' → not found (no results)")
            return result
        except requests.exceptions.RequestException as e:
            print(f"    [geocode] '{place}' → error ({e}), retrying...")
            time.sleep(5)

    print(f"    [geocode] '{place}' → gave up after {max_retries} attempts")
    cache[place] = None  # 失敗をキャッシュ（次回また試みる）
    return None


# ──────────────────────────────────────────────
# テキスト抽出ユーティリティ
# ──────────────────────────────────────────────

def mltext(node, key, lang="en"):
    if not node or key not in node:
        return ""
    v = node[key]
    if isinstance(v, dict):
        return v.get(lang) or v.get("ja" if lang == "en" else "en", "")
    return str(v)


def normalize_date(raw, fallback=""):
    if not raw:
        return fallback
    raw = str(raw)
    if raw in ("9999", "9999-12-31"):
        return ""
    if len(raw) == 4:
        return raw + "-01-01"
    if len(raw) == 7:
        return raw + "-01"
    return raw[:10]


def extract_authors(item, key="authors", max_n=6):
    data = item.get(key, {})
    persons = data.get("en") or data.get("ja", []) if isinstance(data, dict) else data
    names = [p.get("name", "") for p in (persons or []) if p.get("name")]
    return ", ".join(names[:max_n]) + (" et al." if len(names) > max_n else "")


def extract_doi(item):
    for link in item.get("see_also", []):
        if link.get("label") == "doi":
            url = link.get("@id", "")
            if url.startswith("https://doi.org/"):
                return url[len("https://doi.org/"):]
    return (item.get("identifiers", {}).get("doi") or [None])[0]


def item_id(item):
    return item.get("@id", "").split("/")[-1]


# ──────────────────────────────────────────────
# メイン処理
# ──────────────────────────────────────────────

def fetch_all():
    os.makedirs(RAW_ROOT, exist_ok=True)
    os.makedirs(SITE_DATA, exist_ok=True)

    geo_cache = load_geo_cache()
    print(f"Geocoding cache loaded: {len(geo_cache)} entries")

    # --- 論文 ---
    pub_items = []
    for rm_type in ("published_papers", "misc", "books_etc"):
        title_key = "book_title" if rm_type == "books_etc" else "paper_title"
        for item in _fetch(rm_type).get("items", []):
            pub_items.append({
                "id": item_id(item),
                "type": rm_type,
                "title": mltext(item, title_key, "en") or mltext(item, title_key, "ja"),
                "title_ja": mltext(item, title_key, "ja") or None,
                "date": normalize_date(item.get("publication_date") or item.get("from_date"), "2000-01-01"),
                "authors": extract_authors(item) or None,
                "journal": mltext(item, "publication_name") or None,
                "doi": extract_doi(item),
            })
    pub_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("publications", pub_items)

    # --- 発表（ジオコーディング付き）---
    print("Geocoding presentation locations…")
    pres_items = []
    for item in _fetch("presentations").get("items", []):
        loc = mltext(item, "location") or None
        coords = geocode(loc, geo_cache) if loc else None
        pres_items.append({
            "id": item_id(item),
            "title": mltext(item, "presentation_title", "en") or mltext(item, "presentation_title", "ja"),
            "title_ja": mltext(item, "presentation_title", "ja") or None,
            "date": normalize_date(item.get("publication_date"), "2000-01-01"),
            "event": mltext(item, "event") or None,
            "location": loc,
            "lat": coords["lat"] if coords else None,
            "lon": coords["lon"] if coords else None,
            "type": item.get("presentation_type") or None,
            "authors": extract_authors(item, "presenters") or None,
        })
    pres_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("presentations", pres_items)

    # --- メディア掲載 ---
    media_items = []
    for item in _fetch("media_coverage").get("items", []):
        url = next((l.get("@id") for l in item.get("see_also", []) if l.get("label") == "url"), None)
        media_items.append({
            "id": item_id(item),
            "title": mltext(item, "media_coverage_title", "en") or mltext(item, "media_coverage_title", "ja"),
            "title_ja": mltext(item, "media_coverage_title", "ja") or None,
            "date": normalize_date(item.get("publication_date"), "2000-01-01"),
            "publication": mltext(item, "publisher") or mltext(item, "event") or None,
            "url": url,
        })
    media_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("media_coverage", media_items)

    # --- 受賞 ---
    award_items = []
    for item in _fetch("awards").get("items", []):
        award_items.append({
            "id": item_id(item),
            "title": mltext(item, "award_name", "en") or mltext(item, "award_name", "ja"),
            "title_ja": mltext(item, "award_name", "ja") or None,
            "date": normalize_date(item.get("award_date"), "2000-01-01"),
            "organization": mltext(item, "associated_organization") or None,
        })
    award_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("awards", award_items)

    # --- 研究プロジェクト ---
    proj_items = []
    for item in _fetch("research_projects").get("items", []):
        from_d = normalize_date(item.get("from_date"), "")
        to_d   = normalize_date(item.get("to_date"), "")
        kaken  = next((l.get("@id","") for l in item.get("see_also",[]) if l.get("label")=="kaken"), None)
        proj_items.append({
            "id": item_id(item),
            "title": mltext(item, "research_project_title", "en") or mltext(item, "research_project_title", "ja"),
            "title_ja": mltext(item, "research_project_title", "ja") or None,
            "from_date": from_d,
            "to_date": to_d or None,
            "investigators": extract_authors(item, "investigators") or None,
            "system": mltext(item, "system_name") or None,
            "offer_org": mltext(item, "offer_organization") or None,
            "grant_number": ((item.get("identifiers",{}).get("grant_number") or [None])[0]),
            "role": item.get("research_project_owner_role") or None,
            "kaken_url": kaken or None,
        })
    proj_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("projects", proj_items)

    # --- 研究分野 ---
    area_items = []
    for item in _fetch("research_areas").get("items", []):
        area_items.append({
            "id": item_id(item),
            "field": mltext(item, "research_field", "en") or mltext(item, "research_field", "ja"),
            "field_ja": mltext(item, "research_field", "ja") or None,
        })
    _write_json("research_areas", area_items)

    # --- 研究経歴 ---
    exp_items = []
    for item in _fetch("research_experience").get("items", []):
        exp_items.append({
            "id": item_id(item),
            "institution": mltext(item, "affiliation", "en") or mltext(item, "affiliation", "ja"),
            "institution_ja": mltext(item, "affiliation", "ja") or None,
            "department": mltext(item, "section", "en") or mltext(item, "section", "ja") or None,
            "department_ja": mltext(item, "section", "ja") or None,
            "position": mltext(item, "job", "en") or mltext(item, "job", "ja") or None,
            "position_ja": mltext(item, "job", "ja") or None,
            "from_date": normalize_date(item.get("from_date"), ""),
            "to_date": normalize_date(item.get("to_date"), "") or None,
        })
    exp_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("research_experience", exp_items)

    # --- 学歴 ---
    edu_items = []
    for item in _fetch("education").get("items", []):
        edu_items.append({
            "id": item_id(item),
            "institution": mltext(item, "affiliation", "en") or mltext(item, "affiliation", "ja"),
            "institution_ja": mltext(item, "affiliation", "ja") or None,
            "department": mltext(item, "department", "en") or None,
            "department_ja": mltext(item, "department", "ja") or None,
            "degree": mltext(item, "job_title", "en") or mltext(item, "job_title", "ja") or None,
            "degree_ja": mltext(item, "job_title", "ja") or None,
            "from_date": normalize_date(item.get("from_date"), ""),
            "to_date": normalize_date(item.get("to_date"), "") or None,
        })
    edu_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("education", edu_items)

    # --- 担当授業 ---
    teach_items = []
    for item in _fetch("teaching_experience").get("items", []):
        teach_items.append({
            "id": item_id(item),
            "subject": mltext(item, "subject_name", "en") or mltext(item, "subject_name", "ja"),
            "subject_ja": mltext(item, "subject_name", "ja") or None,
            "institution": mltext(item, "institution_name", "en") or mltext(item, "institution_name", "ja") or None,
            "institution_ja": mltext(item, "institution_name", "ja") or None,
            "from_date": normalize_date(item.get("from_date"), ""),
            "to_date": normalize_date(item.get("to_date"), "") or None,
        })
    teach_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("teaching_experience", teach_items)

    # --- 委員会 ---
    comm_items = []
    for item in _fetch("committee_memberships").get("items", []):
        comm_items.append({
            "id": item_id(item),
            "name": mltext(item, "committee_name", "en") or mltext(item, "committee_name", "ja"),
            "name_ja": mltext(item, "committee_name", "ja") or None,
            "organization": mltext(item, "associated_organization") or None,
            "from_date": normalize_date(item.get("from_date"), ""),
            "to_date": normalize_date(item.get("to_date"), "") or None,
        })
    comm_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("committee_memberships", comm_items)

    # --- 学会 ---
    assoc_items = []
    for item in _fetch("association_memberships").get("items", []):
        assoc_items.append({
            "id": item_id(item),
            "name": mltext(item, "academic_society_name", "en") or mltext(item, "academic_society_name", "ja"),
            "name_ja": mltext(item, "academic_society_name", "ja") or None,
            "from_date": normalize_date(item.get("from_date"), ""),
            "to_date": normalize_date(item.get("to_date"), "") or None,
        })
    assoc_items.sort(key=lambda x: x["from_date"], reverse=True)
    _write_json("association_memberships", assoc_items)

    # --- 社会貢献（ジオコーディング付き）---
    print("Geocoding activity locations…")
    soc_items = []
    for item in _fetch("social_contribution").get("items", []):
        loc = mltext(item, "location") or None
        coords = geocode(loc, geo_cache) if loc else None
        soc_items.append({
            "id": item_id(item),
            "title": mltext(item, "social_contribution_title", "en") or mltext(item, "social_contribution_title", "ja"),
            "title_ja": mltext(item, "social_contribution_title", "ja") or None,
            "date": normalize_date(item.get("from_event_date"), "2000-01-01"),
            "to_date": normalize_date(item.get("to_event_date"), "") or None,
            "organization": mltext(item, "promoter") or mltext(item, "associated_organization") or None,
            "location": loc,
            "lat": coords["lat"] if coords else None,
            "lon": coords["lon"] if coords else None,
        })
    soc_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("social_contribution", soc_items)

    # --- その他 ---
    others_items = []
    for item in _fetch("others").get("items", []):
        others_items.append({
            "id": item_id(item),
            "title": mltext(item, "other_title", "en") or mltext(item, "other_title", "ja"),
            "title_ja": mltext(item, "other_title", "ja") or None,
            "date": normalize_date(item.get("from_date"), "2000-01-01"),
            "description": mltext(item, "description") or None,
            "description_ja": mltext(item, "description", "ja") or None,
        })
    others_items.sort(key=lambda x: x["date"], reverse=True)
    _write_json("others", others_items)

    # ジオコーディングキャッシュを保存
    save_geo_cache(geo_cache)
    print(f"Geocoding cache saved: {len(geo_cache)} entries total")
    print(f"\nDone — {date.today()}")


def _fetch(rm_type):
    url = f"{BASE_API_URL}/{rm_type}?limit=1000"
    print(f"Fetching {rm_type}…", end=" ")
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        data = r.json()
        with open(f"{RAW_ROOT}/{rm_type}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"{len(data.get('items', []))} items")
        return data
    except Exception as e:
        print(f"SKIP ({e})")
        cache = f"{RAW_ROOT}/{rm_type}.json"
        if os.path.exists(cache):
            with open(cache, encoding="utf-8") as f:
                return json.load(f)
        return {}


def _write_json(name, items):
    path = f"{SITE_DATA}/{name}.json"
    payload = {"updated": str(date.today()), "items": items}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  -> {path} ({len(items)} items)")


if __name__ == "__main__":
    fetch_all()
