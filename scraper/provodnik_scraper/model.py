"""Parsed quest page (parse.py) -> data model of SPEC §4.2.

Pure functions only: the same input always gives the same JSON, no network.
"""
from __future__ import annotations

import re

from .parse import STEP_NUM_RE, slugify

# «(Групп) Бинт антисептический (Вез)», «(Групп) Посылка Борову (База: Заброшенный рудник)»
VARIANT_RE = re.compile(r"^\(Групп\)\s+(?P<base>.+?)\s+\((?P<label>[^()]+)\)$")


def title_of(slug: str) -> str:
    return slug.replace("_", " ")


def qty(item: dict) -> dict | None:
    """Parser quantity fields -> `Qty {min, max?}`; exact number has min == max."""
    if item.get("qty") is not None:
        return {"min": item["qty"], "max": item["qty"]}
    if item.get("qtyMin") is not None:
        out = {"min": item["qtyMin"]}
        if item.get("qtyMax") is not None:
            out["max"] = item["qtyMax"]
        return out
    return None


def variant(title: str) -> dict | None:
    m = VARIANT_RE.match(title)
    if not m:
        return None
    return {"groupId": slugify(f"(Групп) {m['base']}"), "label": m["label"], "confidence": "parsed"}


def prev_logic(parsed: str) -> str:
    # `single`/`none`: with at most one prerequisite AND and OR are the same thing (SPEC §4.2).
    if parsed in ("single", "none"):
        return "and"
    if parsed in ("and", "or"):
        return parsed
    return "unknown"  # mixed separators or several prerequisites without separators


def quest_end(end: dict | None) -> dict | None:
    if not end:
        return None
    if end.get("raw") == "автозавершение":
        return {"kind": "auto", "confidence": "wiki"}
    if end.get("npcId"):
        out = {"kind": "npc", "npcId": end["npcId"], "confidence": "wiki"}
        if end.get("locationId"):
            out["locationId"] = end["locationId"]
        return out
    return None


def strip_number(text: str) -> str:
    return STEP_NUM_RE.sub("", text, count=1).strip()


def step_npc(step: dict, end: dict | None) -> str | None:
    """The NPC the step is about: the end NPC if named, otherwise the last NPC mentioned
    («Расскажите про Лешича Витьку» -> Витёк)."""
    npcs = step["npcIds"]
    if not npcs:
        return None
    if end and end.get("npcId") in npcs:
        return end["npcId"]
    return npcs[-1]


def step_places(step: dict, is_last: bool, start: dict | None, end: dict | None,
                npc_locations: dict[str, str]) -> list[dict]:
    locations = step["locationIds"]
    squares = step["squares"]
    if len(locations) == 1:
        return [{"locationId": locations[0], "squares": squares, "confidence": "parsed"}]
    if len(locations) > 1:
        # Alternatives («один из проходов»): squares are paired only when the pairing is unambiguous.
        paired = len(squares) == len(locations)
        return [{"locationId": loc, "squares": [squares[i]] if paired else [], "confidence": "parsed"}
                for i, loc in enumerate(locations)]

    # No location in the text: fall back to a named NPC's location, then to the end NPC for the last step.
    known = {ref["npcId"]: ref["locationId"] for ref in (start, end) if ref and ref.get("npcId") and ref.get("locationId")}
    for npc in reversed(step["npcIds"]):
        loc = known.get(npc) or npc_locations.get(npc)
        if loc:
            return [{"locationId": loc, "squares": squares, "confidence": "parsed"}]
    if is_last and end and end.get("kind") == "npc" and end.get("locationId"):
        return [{"locationId": end["locationId"], "squares": squares, "confidence": "wiki"}]
    return []


def step_kills(step: dict) -> list[dict]:
    out = []
    for k in step["kills"]:
        kill = {"name": title_of(k["mobId"]) if k.get("mobId") else k.get("mobText", "?"), "confidence": "parsed"}
        if k.get("mobId"):
            kill["mobId"] = k["mobId"]
        q = qty(k)
        if q:
            kill["qty"] = q
        out.append(kill)
    return out


def to_model(parsed: dict, npc_locations: dict[str, str], updated_at: str | None) -> dict:
    """One parsed quest -> `Quest` (SPEC §4.2)."""
    start = parsed["start"]
    end = quest_end(parsed["end"])
    steps = []
    for i, st in enumerate(parsed["steps"]):
        step = {
            "order": i + 1,
            "kind": st["kind"],
            "text": strip_number(st["text"]),
            "places": step_places(st, i == len(parsed["steps"]) - 1, start, end, npc_locations),
            # Requirements only from the `Требуется` template (SPEC §4.3).
            "items": [{"itemId": it["itemId"], **({"qty": qty(it)} if qty(it) else {}), "confidence": "wiki"}
                      for it in st["items"] if it["source"] == "template"],
            "kills": step_kills(st),
            "confidence": "parsed",
        }
        npc = step_npc(st, end)
        if npc:
            step["npcId"] = npc
        steps.append(step)
    if not steps and end and end["kind"] == "npc":
        # Skeleton: nothing parsed from the process text -> just «сдать end» (SPEC §4.2).
        places = [{"locationId": end["locationId"], "squares": [], "confidence": "wiki"}] if end.get("locationId") else []
        steps.append({"order": 1, "kind": "deliver", "text": "", "npcId": end["npcId"], "places": places,
                      "items": [], "kills": [], "confidence": "wiki"})

    per_unit = parsed.get("rewardsPerUnit", False)
    rewards = []
    for r in parsed["rewards"]:
        if r["kind"] == "other":
            continue
        reward = {k: v for k, v in r.items() if v is not None}
        if per_unit and r["kind"] != "item":
            reward["perUnit"] = True
        rewards.append(reward)

    quest = {
        "id": parsed["id"],
        "title": parsed["title"],
        "url": parsed["url"],
        "type": parsed["type"],
        # Праздничное / PvP / Соревнование …: kept for filters, `type` is "other" for them.
        **({"typeRaw": parsed["typeRaw"]} if parsed["type"] == "other" and parsed.get("typeRaw") else {}),
        "hidden": parsed["hidden"],
        "conditions": parsed["conditions"],
        "prev": [{"questId": p["questId"], "states": p["states"], **({"statusRaw": p["statusRaw"]} if p["statusRaw"] else {})}
                 for p in parsed["prev"]],
        "prevLogic": prev_logic(parsed["prevLogic"]),
        "next": parsed["next"],
        "journalStages": [strip_number(s) for s in parsed["journalStages"]],
        "steps": steps,
        "rewards": rewards,
        "rawProcess": parsed["rawProcess"],
        "notes": parsed["notes"],
        "revision": parsed["revision"],
    }
    optional = {
        "periodHours": parsed["periodHours"],
        "variant": variant(parsed["title"]),
        "start": {k: v for k, v in start.items() if k in ("npcId", "locationId", "confidence")} if start and start.get("npcId") else None,
        "end": end,
        "description": parsed["description"],
        "tip": parsed["tip"],
        "updatedAt": updated_at,
    }
    quest.update({k: v for k, v in optional.items() if v is not None})
    return quest


def referenced_ids(quests: list[dict]) -> tuple[set[str], set[str], set[str]]:
    """NPC, location and item ids the quests point to (dictionaries only ship what is used)."""
    npcs: set[str] = set()
    locations: set[str] = set()
    items: set[str] = set()
    for q in quests:
        for ref in (q.get("start"), q.get("end")):
            if ref and ref.get("npcId"):
                npcs.add(ref["npcId"])
            if ref and ref.get("locationId"):
                locations.add(ref["locationId"])
        for st in q["steps"]:
            if st.get("npcId"):
                npcs.add(st["npcId"])
            locations.update(p["locationId"] for p in st["places"])
            items.update(i["itemId"] for i in st["items"])
        items.update(r["target"] for r in q["rewards"] if r["kind"] == "item" and r.get("target"))
    return npcs, locations, items
