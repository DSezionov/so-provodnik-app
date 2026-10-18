"""Build public/data/*.json in the SPEC §4.2 model.

    python -m provodnik_scraper.build            # offline, from scraper/cache
    python -m provodnik_scraper.build --fetch    # fetch missing pages politely first

Until the wiki admin answers, only the 50-quest sample (sample_titles.json) is built.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from .fetch import BASE_URL, PoliteFetcher, page_url
from .model import referenced_ids, title_of, to_model
from .parse import iter_titles, load_dictionaries, parse_quest

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = Path(__file__).resolve().parents[1] / "sample_titles.json"
OUT_DIR = ROOT / "public" / "data"
SITEMAP_NS0 = f"{BASE_URL}/sitemap/sitemap-so-wiki.ru-NS_0-0.xml.gz"
INDEX_PAGES = ("Персонажи", "Локации", "Предметы", "Артефакты")


def sitemap_lastmod(fetcher: PoliteFetcher) -> dict[str, str]:
    """Page title -> lastmod (ISO) from the main-namespace sitemap."""
    body = fetcher.get(SITEMAP_NS0).content
    xml = (gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body).decode("utf-8")
    out = {}
    for loc, lastmod in re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml):
        out[unquote(loc.split("/wiki/", 1)[-1]).replace("_", " ")] = lastmod
    return out


def write_json(name: str, payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    args = ap.parse_args()
    fetcher = PoliteFetcher(offline=not args.fetch)

    index_html = {t: fetcher.get(page_url(t)).text for t in INDEX_PAGES}
    dicts = load_dictionaries(*index_html.values())
    npc_locations = {slugify_title(k): slugify_title(v["location"]) for k, v in dicts.npcs.items() if v["location"]}
    lastmod = sitemap_lastmod(fetcher)

    quests = []
    for _, title in iter_titles(json.loads(SAMPLE.read_text())):
        url = page_url(title)
        parsed = parse_quest(fetcher.get(url).text, dicts, url)
        quests.append(to_model(parsed, npc_locations, lastmod.get(title)))
    quests.sort(key=lambda q: q["title"])

    npc_ids, location_ids, item_ids = referenced_ids(quests)
    npc_by_id = {slugify_title(k): v for k, v in dicts.npcs.items()}

    def entry(entity_id: str, **extra) -> dict:
        return {"id": entity_id, "name": title_of(entity_id), "url": page_url(title_of(entity_id)),
                **{k: v for k, v in extra.items() if v}}

    npcs = [entry(i, locationId=slugify_title(npc_by_id[i]["location"]) if npc_by_id.get(i, {}).get("location") else None)
            for i in sorted(npc_ids)]
    locations = [entry(i) for i in sorted(location_ids)]
    items = [entry(i) for i in sorted(item_ids)]

    version = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    write_json("quests.json", {"version": version, "quests": quests})
    write_json("npcs.json", {"version": version, "npcs": npcs})
    write_json("locations.json", {"version": version, "locations": locations})
    write_json("items.json", {"version": version, "items": items})
    write_json("meta.json", {
        "version": version,
        "source": "https://so-wiki.ru",
        "license": "CC BY 4.0",
        "sample": True,  # only the 50-quest sample until the full crawl (SPEC §7)
        "counts": {"quests": len(quests), "npcs": len(npcs), "locations": len(locations), "items": len(items)},
    })
    print(f"wrote {OUT_DIR}: {len(quests)} quests, {len(npcs)} npcs, {len(locations)} locations, {len(items)} items")


def slugify_title(title: str) -> str:
    return title.strip().replace(" ", "_")


if __name__ == "__main__":
    main()
