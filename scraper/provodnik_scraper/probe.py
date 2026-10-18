"""Phase 0: parse the cached sample and print data-quality metrics as Markdown.

    python -m provodnik_scraper.probe            # offline, uses scraper/cache only
    python -m provodnik_scraper.probe --fetch    # fetch missing pages politely first
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from bs4 import BeautifulSoup

from .fetch import PoliteFetcher, page_url
from .parse import iter_titles, load_dictionaries, parse_quest, smw_query_results

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = Path(__file__).resolve().parents[1] / "sample_titles.json"
OUT_JSON = ROOT / "data" / "probe" / "sample-quests.json"
GROUPS = ["Разовое", "Многоразовое", "Подработка"]


def pct(n: int, d: int) -> str:
    return "—" if d == 0 else f"{n}/{d} ({round(100 * n / d)}%)"


def smw_list_values(html: str) -> dict[str, dict]:
    """title -> {period, xp, money} from the SMW datatable embedded in the «Задания» page."""
    out = {}
    for q in smw_query_results(html):
        for row in q["query"]["result"]:
            title = BeautifulSoup(row[0]["display"], "lxml").get_text(strip=True)
            vals = [c.get("sort") for c in row[1:]]
            out[title] = dict(zip(["period", "xp", "money"], vals))
    return out


def as_int(v) -> int | None:
    if v in (None, ""):
        return None
    try:
        return int(str(v).replace(" ", ""))
    except ValueError:
        return None


def effective_location(q: dict, i: int, npc_locations: dict[str, str]) -> str | None:
    """Step location: explicit link in the step, else the location of an NPC named in it
    (from the infobox or the NPC index), else — for the last step — the end NPC's location."""
    st = q["steps"][i]
    if st["locationIds"]:
        return st["locationIds"][0]
    known = {}
    for ref in (q["start"], q["end"]):
        if ref and ref.get("npcId") and ref.get("locationId"):
            known[ref["npcId"]] = ref["locationId"]
    for npc in reversed(st["npcIds"]):
        loc = known.get(npc) or npc_locations.get(npc)
        if loc:
            return loc
    if i == len(q["steps"]) - 1 and q["end"] and q["end"].get("locationId"):
        return q["end"]["locationId"]
    return None


NPC_LOCATIONS: dict[str, str] = {}


def metrics(quests: list[dict], smw: dict[str, dict], npc_locations: dict[str, str] = NPC_LOCATIONS) -> dict:
    m: Counter = Counter()
    for q in quests:
        m["quests"] += 1
        m["type_ok"] += q["typeRaw"] == q["_group"]
        if q["type"] != "once":
            m["period_expected"] += 1
            m["period_found"] += q["periodHours"] is not None
        s = q["start"] or {}
        e = q["end"] or {}
        m["start_npc"] += bool(s.get("npcId"))
        m["start_loc"] += bool(s.get("locationId"))
        m["end_npc"] += bool(e.get("npcId"))
        m["end_auto"] += e.get("raw") == "автозавершение"
        m["end_loc"] += bool(e.get("locationId"))
        m["prev_any"] += bool(q["prev"])
        m["prev_multi"] += len(q["prev"]) > 1
        m["prev_logic_explicit"] += q["prevLogic"] in ("and", "or", "mixed")
        m["prev_items"] += len(q["prev"])
        m["prev_status_known"] += sum(p["states"] != "unknown" for p in q["prev"])
        m["next_any"] += bool(q["next"])
        m["hidden"] += q["hidden"]
        m["chapter"] += bool(q["chapter"] or q["chapterQuests"])
        m["conditions"] += bool(q["conditions"])
        m["tip"] += bool(q["tip"])

        # SMW cross-check of rewards / period.
        ref = smw.get(q["title"])
        if ref:
            m["smw_rows"] += 1
            money = next((r["value"] for r in q["rewards"] if r["kind"] == "money"), None)
            xp = next((r["value"] for r in q["rewards"] if r["kind"] == "xp"), None)
            m["money_match"] += as_int(ref["money"]) == money
            m["xp_match"] += as_int(ref["xp"]) == xp
            if q["type"] != "once":
                m["period_match"] += as_int(ref["period"]) == q["periodHours"]

        steps = q["steps"]
        m["steps"] += len(steps)
        m["numbered"] += any(st["numbered"] for st in steps)
        if q["journalStages"]:
            m["journal"] += 1
            m["journal_match"] += len(q["journalStages"]) == len(steps)
        req = [i for st in steps for i in st["items"] if i["source"] == "template"]
        loose = [i for st in steps for i in st["items"] if i["source"] == "link"]
        m["q_items_tpl"] += bool(req)
        m["items_tpl"] += len(req)
        m["items_tpl_qty"] += sum(("qty" in i) or ("qtyMin" in i) for i in req)
        m["items_tpl_range"] += sum("qtyMin" in i for i in req)
        m["q_items_loose"] += bool(loose)
        m["items_loose"] += len(loose)
        kills = [k for st in steps for k in st["kills"]]
        m["q_kill"] += any(st["kind"] == "kill" for st in steps)
        m["kills_with_qty"] += sum(("qty" in k) or ("qtyMin" in k) for k in kills)
        m["kills"] += len(kills)
        for i, st in enumerate(steps):
            m["st_loc"] += bool(st["locationIds"])
            m["st_loc_eff"] += bool(effective_location(q, i, npc_locations))
            m["st_square"] += bool(st["squares"])
            m["st_npc"] += bool(st["npcIds"])
            m["st_map"] += bool(st["mapPoints"])
            m["st_kind"] += st["kind"] != "other"
            m["st_other_links"] += bool(st["otherLinks"])
        rewards = q["rewards"]
        m["rw_any"] += bool(rewards)
        m["rw_rep_note"] += sum("note" in r for r in rewards)
    return m


def render(groups: dict[str, list[dict]], smw: dict[str, dict]) -> str:
    cols = GROUPS + ["Всего"]
    ms = {g: metrics(groups[g], smw) for g in GROUPS}
    ms["Всего"] = metrics([q for g in GROUPS for q in groups[g]], smw)

    def row(label, f):
        return f"| {label} | " + " | ".join(f(ms[c]) for c in cols) + " |"

    lines = ["| Показатель | " + " | ".join(cols) + " |", "|---|" + "---|" * len(cols)]
    rows = [
        ("Заданий в выборке", lambda m: str(m["quests"])),
        ("Тип задания (совпал со списком)", lambda m: pct(m["type_ok"], m["quests"])),
        ("Периодичность (для многоразовых/подработок)", lambda m: pct(m["period_found"], m["period_expected"])),
        ("Начало: NPC", lambda m: pct(m["start_npc"], m["quests"])),
        ("Начало: локация", lambda m: pct(m["start_loc"], m["quests"])),
        ("Конец: NPC", lambda m: pct(m["end_npc"], m["quests"])),
        ("Конец: «автозавершение»", lambda m: pct(m["end_auto"], m["quests"])),
        ("Есть предыдущие задания", lambda m: pct(m["prev_any"], m["quests"])),
        ("…из них >1 предыдущего", lambda m: pct(m["prev_multi"], m["prev_any"])),
        ("…логика И/ИЛИ указана явно", lambda m: pct(m["prev_logic_explicit"], m["prev_multi"])),
        ("Статус предыдущего распознан", lambda m: pct(m["prev_status_known"], m["prev_items"])),
        ("Есть следующие задания", lambda m: pct(m["next_any"], m["quests"])),
        ("Особые условия", lambda m: pct(m["conditions"], m["quests"])),
        ("Скрытое задание", lambda m: pct(m["hidden"], m["quests"])),
        ("Глава / подглавы", lambda m: pct(m["chapter"], m["quests"])),
        ("Совет", lambda m: pct(m["tip"], m["quests"])),
        ("Деньги = SMW", lambda m: pct(m["money_match"], m["smw_rows"])),
        ("Опыт = SMW", lambda m: pct(m["xp_match"], m["smw_rows"])),
        ("Шагов всего", lambda m: str(m["steps"])),
        ("Пронумерованный процесс (многоэтапные)", lambda m: pct(m["numbered"], m["quests"])),
        ("Этапы журнала в описании", lambda m: pct(m["journal"], m["quests"])),
        ("…число этапов = числу шагов", lambda m: pct(m["journal_match"], m["journal"])),
        ("Шаг: локация", lambda m: pct(m["st_loc"], m["steps"])),
        ("Шаг: локация с учётом NPC и «сдать в конце»", lambda m: pct(m["st_loc_eff"], m["steps"])),
        ("Шаг: квадрат", lambda m: pct(m["st_square"], m["steps"])),
        ("Шаг: точка на карте", lambda m: pct(m["st_map"], m["steps"])),
        ("Шаг: NPC в тексте", lambda m: pct(m["st_npc"], m["steps"])),
        ("Шаг: тип (≠ other)", lambda m: pct(m["st_kind"], m["steps"])),
        ("Задания с требуемыми предметами (шаблон)", lambda m: pct(m["q_items_tpl"], m["quests"])),
        ("…предметы с количеством", lambda m: pct(m["items_tpl_qty"], m["items_tpl"])),
        ("…из них диапазон «от–до»", lambda m: pct(m["items_tpl_range"], m["items_tpl"])),
        ("Ссылки на предметы без количества", lambda m: pct(m["q_items_loose"], m["quests"])),
        ("Задания на убийство", lambda m: pct(m["q_kill"], m["quests"])),
        ("…цель + количество", lambda m: pct(m["kills_with_qty"], m["q_kill"])),
        ("Шаги с нераспознанными ссылками", lambda m: pct(m["st_other_links"], m["steps"])),
    ]
    lines += [row(label, f) for label, f in rows]
    return "\n".join(lines)


def per_quest_table(groups: dict[str, list[dict]]) -> str:
    lines = ["| Задание | Тип | Шагов | Предметы (кол-во) | Локации шагов | Квадраты | Замечания |", "|---|---|---|---|---|---|---|"]
    for g in GROUPS:
        for q in groups[g]:
            items = [f"{i['itemId'].replace('_', ' ')} ({i.get('qty') or '–'.join(str(x) for x in (i.get('qtyMin'), i.get('qtyMax')) if x) or '?'})"
                     for st in q["steps"] for i in st["items"]]
            kills = [f"⚔ {k.get('mobId', k.get('mobText', '?')).replace('_', ' ')} ({k.get('qty') or '–'.join(str(x) for x in (k.get('qtyMin'), k.get('qtyMax')) if x) or '?'})"
                     for st in q["steps"] for k in st["kills"]]
            locs = sorted({l.replace("_", " ") for st in q["steps"] for l in st["locationIds"]})
            squares = [s for st in q["steps"] for s in st["squares"]]
            notes = []
            if q["hidden"]:
                notes.append("скрытое")
            if (q["end"] or {}).get("raw"):
                notes.append(f"конец: {q['end']['raw']}")
            if q["prevLogic"] in ("unknown", "mixed", "or", "and"):
                notes.append(f"prev: {q['prevLogic']}")
            if q["journalStages"] and len(q["journalStages"]) != len(q["steps"]):
                notes.append(f"этапов журнала {len(q['journalStages'])} ≠ шагов {len(q['steps'])}")
            missing_loc = sum(not st["locationIds"] for st in q["steps"])
            if missing_loc:
                notes.append(f"без локации: {missing_loc} шаг.")
            other = sorted({o.replace('_', ' ') for st in q["steps"] for o in st["otherLinks"]})
            if other:
                notes.append("нераспозн. ссылки: " + ", ".join(other[:3]) + ("…" if len(other) > 3 else ""))
            title = q["title"].replace("|", "\\|")
            lines.append(f"| [{title}]({q['url']}) | {q['type']} | {len(q['steps'])} | "
                         f"{'; '.join(items + kills) or '—'} | {', '.join(locs) or '—'} | {', '.join(squares) or '—'} | {'; '.join(notes) or ''} |")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    args = ap.parse_args()
    f = PoliteFetcher(offline=not args.fetch)
    dicts = load_dictionaries(*(f.get(page_url(t)).text for t in ("Персонажи", "Локации", "Предметы", "Артефакты")))
    smw = smw_list_values(f.get(page_url("Задания")).text)
    NPC_LOCATIONS.update({k.replace(" ", "_"): v["location"].replace(" ", "_") for k, v in dicts.npcs.items() if v["location"]})
    sample = json.loads(SAMPLE.read_text())
    groups: dict[str, list[dict]] = {g: [] for g in GROUPS}
    for g, title in iter_titles(sample):
        url = page_url(title)
        q = parse_quest(f.get(url).text, dicts, url)
        q["_group"] = g
        groups[g].append(q)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps([q for g in GROUPS for q in groups[g]], ensure_ascii=False, indent=1))
    print(f"<!-- dictionaries: npcs={len(dicts.npcs)} locations={len(dicts.locations)} items={len(dicts.items)} smw_rows={len(smw)} -->")
    print(render(groups, smw))
    print()
    print(per_quest_table(groups))


if __name__ == "__main__":
    main()
