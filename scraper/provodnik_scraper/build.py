"""Build public/data/*.json in the SPEC §4.2 model.

    python -m provodnik_scraper.build            # offline, from scraper/cache
    python -m provodnik_scraper.build --fetch    # fetch missing pages politely first

    python -m provodnik_scraper.build --all --fetch   # every quest listed on the wiki page «Задания»

Without --all only the 50-quest sample (sample_titles.json) is built.
A full first crawl is ~1760 pages × 5 s (Crawl-delay) ≈ 2.5 h; later runs reuse scraper/cache.
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
from .parse import iter_titles, load_dictionaries, parse_quest, smw_query_results

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


def all_quest_titles(fetcher: PoliteFetcher) -> list[str]:
    """Every quest from the SMW table `[[Категория:Задания]]` embedded in the page «Задания»."""
    from bs4 import BeautifulSoup

    titles = []
    for q in smw_query_results(fetcher.get(page_url("Задания")).text):
        for row in q["query"]["result"]:
            a = BeautifulSoup(row[0]["display"], "lxml").find("a")
            if a and a.get("title"):
                titles.append(a["title"])
    return titles


def write_json(name: str, payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="fetch missing pages (polite, Crawl-delay)")
    ap.add_argument("--all", action="store_true", help="all quests from the wiki, not just the sample")
    args = ap.parse_args()
    fetcher = PoliteFetcher(offline=not args.fetch)

    index_html = {t: fetcher.get(page_url(t)).text for t in INDEX_PAGES}
    dicts = load_dictionaries(*index_html.values())
    npc_locations = {slugify_title(k): slugify_title(v["location"]) for k, v in dicts.npcs.items() if v["location"]}
    lastmod = sitemap_lastmod(fetcher)

    titles = all_quest_titles(fetcher) if args.all else [t for _, t in iter_titles(json.loads(SAMPLE.read_text()))]
    quests, failed, not_quest = [], [], []
    for n, title in enumerate(titles, 1):
        url = page_url(title)
        try:
            resp = fetcher.get(url)
        except Exception as e:  # network error or not cached in offline mode: report, keep going
            failed.append(f"{title}: {e}")
            continue
        if resp.status != 200 or "quest-base-info" not in resp.text:
            not_quest.append(title)
            continue
        parsed = parse_quest(resp.text, dicts, url)
        quests.append(to_model(parsed, npc_locations, lastmod.get(title)))
        if n % 50 == 0:
            print(f"  {n}/{len(titles)} pages, network requests so far: {fetcher.network_requests}", flush=True)
    quests.sort(key=lambda q: q["title"])
    if failed:
        print(f"failed: {len(failed)}", *failed[:20], sep="\n  ")
    if not_quest:
        print(f"skipped (no quest infobox): {len(not_quest)}", *not_quest[:20], sep="\n  ")

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
        "sample": not args.all,
        "counts": {"quests": len(quests), "npcs": len(npcs), "locations": len(locations), "items": len(items)},
    })
    print(f"wrote {OUT_DIR}: {len(quests)} quests, {len(npcs)} npcs, {len(locations)} locations, {len(items)} items")


def slugify_title(title: str) -> str:
    return title.strip().replace(" ", "_")


if __name__ == "__main__":
    main()
