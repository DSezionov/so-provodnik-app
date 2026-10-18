"""Phase 0 probe parser: rendered quest page HTML -> dict close to the SPEC §4.2 model.

Everything taken from the `Шаблон:Задание` infobox / templated markup is `wiki`;
everything inferred from free text is `parsed`; anything not found is left out
or marked `unknown`. No guessing.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import unquote

from bs4 import BeautifulSoup, NavigableString, Tag

TYPE_MAP = {"Разовое": "once", "Многоразовое": "repeatable", "Подработка": "board"}

# Prerequisite status, e.g. `[в наличии, выполнено или провалено]`, as the set of quest states that satisfy it.
PREV_STATE_WORDS = {"в наличии": "taken", "выполнено": "done", "провалено": "failed"}
PREV_STATE_NONE = "нет в наличии и не выполнено"  # the prerequisite must NOT have been taken or done


def parse_prev_status(raw: str | None) -> list[str] | None:
    """`None` when the status cannot be read: the caller keeps `statusRaw` and marks it unknown."""
    if not raw:
        return None
    raw = raw.strip().lower()
    if raw == PREV_STATE_NONE:
        return ["none"]
    parts = [p.strip() for p in re.split(r",|\bили\b", raw) if p.strip()]
    states = [PREV_STATE_WORDS.get(p) for p in parts]
    return None if not states or None in states else states


SQUARE_RE = re.compile(r"квадрат\w*\s+((?:[A-Z]{1,2}\d{1,2}(?:-\d)?)(?:\s*(?:,|и|или)\s*[A-Z]{1,2}\d{1,2}(?:-\d)?)*)")
SQUARE_TOKEN_RE = re.compile(r"[A-Z]{1,2}\d{1,2}(?:-\d)?")
STEP_NUM_RE = re.compile(r"^\s*(\d{1,2})\.\s+")
QTY_RE = re.compile(r"[–-]\s*(?:от\s+(\d[\d\s]*)\s+до\s+(\d[\d\s]*)|от\s+(\d[\d\s]*)|(\d[\d\s]*))\s*шт")
KILL_RE = re.compile(r"убить\s+(?:(\d+)\s+)?", re.I)
KILL_QTY_RE = re.compile(r"[–-]\s*(?:от\s+(\d+)\s+до\s+(\d+)|(\d+))\s*штук")

# Generic rules repeated on every page of a type; not quest-specific.
BOILERPLATE_NOTICES = ("Если отменить/провалить задание", "Суммарное количество «Подработок»")

KIND_PATTERNS = [  # first match wins; order matters
    ("kill", re.compile(r"\bубе?й|\bубить|\bуничтож", re.I)),
    ("deliver", re.compile(r"передай|передать|отдай|отдать|сдай|сдать|принести|принесите|отнеси|отнести|доставь|доставить", re.I)),
    ("talk", re.compile(r"поговори|расспрос|расскаж|спросить|спросите|доложи|узнать|узнайте", re.I)),
    ("collect", re.compile(r"добыть|добудь|собери|собрать|заберите|забрать", re.I)),
    ("goto", re.compile(r"отправляйтесь|посетить|посетите|доберитесь|пройдите", re.I)),
]


@dataclass
class Dictionaries:
    """Page titles known to be NPCs / locations / items (from the wiki's index pages)."""

    npcs: dict[str, dict] = field(default_factory=dict)  # title -> {location}
    locations: set[str] = field(default_factory=set)
    items: set[str] = field(default_factory=set)

    def classify(self, title: str) -> str:
        if title in self.locations:
            return "location"
        if title in self.npcs:
            return "npc"
        if title in self.items:
            return "item"
        return "other"


def slugify(title: str) -> str:
    return title.strip().replace(" ", "_")


def mw_config(html: str) -> dict:
    """`RLCONF={...}` page meta plus all `mw.config.set({...})` payloads (embedded SMW query results)."""
    merged: dict = {}
    for m in re.finditer(r"(?:RLCONF=|mw\.config\.set\()(\{.*?\})\)?;", html, re.S):
        try:
            merged.update(json.loads(m.group(1)))
        except json.JSONDecodeError:
            continue
    return merged


def smw_query_results(html: str) -> list[dict]:
    return [json.loads(v) for k, v in mw_config(html).items() if k.startswith("smw-")]


def _text(el: Tag | NavigableString | None) -> str:
    if el is None:
        return ""
    if isinstance(el, NavigableString):
        return str(el)
    clone = BeautifulSoup(str(el), "lxml")
    for junk in clone.select(".ext-floatingui-content, .maps-map, script, style"):
        junk.decompose()
    # Separate block elements only; inline links keep the surrounding punctuation tight («Везувий,»).
    for block in clone.select("p, li, div, br, tr, td, th, h2, h3, h4, ul, ol"):
        block.insert_before(" ")
        block.insert_after(" ")
    text = re.sub(r"\s+", " ", clone.get_text("")).strip()
    text = re.sub(r"\s+([,.;:!?)\]])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    return re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)  # «шт..» from the `Требуется` template + sentence dot


def _num(s: str) -> int | None:
    digits = re.sub(r"[^\d-]", "", s)
    return int(digits) if re.fullmatch(r"-?\d+", digits) else None


def _link_title(a: Tag) -> str | None:
    if a.get("title"):
        return a["title"]
    href = a.get("href", "")
    if href.startswith("/wiki/"):
        return unquote(href[len("/wiki/"):]).replace("_", " ")
    return None


def _links(el: Tag) -> list[tuple[str, str]]:
    """(title, visible text) for every internal wiki link, skipping icon-only links."""
    out = []
    for a in el.select("a[href^='/wiki/']"):
        if a.find("img") and not a.get_text(strip=True):
            continue
        title = _link_title(a)
        if title:
            out.append((title, a.get_text(" ", strip=True)))
    return out


# --------------------------------------------------------------------------- infobox

def _row_label(row: Tag) -> str:
    ref = row.select_one(".ext-floatingui-reference")
    if ref:
        return ref.get_text(" ", strip=True).rstrip(":")
    first = row.find(string=True)
    return (first or "").strip().rstrip(":")


def _npc_ref(value: Tag) -> dict:
    """`NPC [Location]` -> {npcId, locationId, confidence}; text without links (e.g. `автозавершение`) is kept raw."""
    links = value.find_all("a")
    raw = _text(value)
    if not links:
        return {"raw": raw, "confidence": "wiki"}
    ref = {"npcId": slugify(_link_title(links[0]) or ""), "confidence": "wiki"}
    if len(links) > 1 and "[" in raw:
        ref["locationId"] = slugify(_link_title(links[1]) or "")
    return ref


def _prev_list(row: Tag) -> tuple[list[dict], str, list[str]]:
    """Prerequisites with statuses and the logic the wiki states explicitly between lists (`и` / `или`)."""
    items: list[dict] = []
    separators: list[str] = []
    for child in row.children:
        if not isinstance(child, Tag):
            continue
        if child.name == "ul":
            for li in child.find_all("li", recursive=False):
                a = li.find("a")
                if not a:
                    continue  # "нет"
                status_raw = None
                m = re.search(r"\[([^\]]+)\]\s*$", _text(li))
                if m:
                    status_raw = m.group(1).strip()
                states = parse_prev_status(status_raw)
                items.append({
                    "questId": slugify(_link_title(a) or ""),
                    "states": states if states is not None else "unknown",
                    "statusRaw": status_raw,
                })
        elif child.name == "p":
            word = _text(child).lower()
            if word in ("и", "или"):
                separators.append(word)
    if len(items) <= 1:
        logic = "single" if items else "none"
    elif not separators:
        logic = "unknown"  # several prerequisites in one list: the wiki itself says it can be AND or OR
    elif set(separators) == {"или"}:
        logic = "or"
    elif set(separators) == {"и"}:
        logic = "and"
    else:
        logic = "mixed"
    return items, logic, separators


def parse_infobox(root: Tag) -> dict:
    box = root.select_one(".quest-base-info")
    out: dict = {"conditions": []}
    if box is None:
        return out
    for section in box.select(".infobox-section"):
        title_el = section.select_one(".infobox-title")
        section_title = _text(title_el)
        if "Особые условия" in section_title:
            out["conditions"] = [_text(li) for li in section.select("li")]
            continue
        for row in section.select(".infobox-row"):
            if "infobox-title" in (row.get("class") or []):
                continue
            label = _row_label(row)
            value = row.select_one(".infobox-value")
            if label == "Тип задания" and value:
                out["typeRaw"] = _text(value)
            elif label == "Периодичность" and value:
                out["periodHours"] = _num(_text(value))
            elif label == "Начало" and value:
                out["start"] = _npc_ref(value)
            elif label == "Конец" and value:
                out["end"] = _npc_ref(value)
            elif label == "Предыдущее задание":
                out["prev"], out["prevLogic"], out["prevSeparators"] = _prev_list(row)
            elif label == "Следующее задание":
                out["next"] = [slugify(t) for t, _ in _links(row)]
            elif label == "Глава":
                links = _links(row)
                out["chapter"] = slugify(links[0][0]) if links else None
            elif label == "Список подглав":
                out["chapterQuests"] = [slugify(t) for t, _ in _links(row)]
    return out


# --------------------------------------------------------------------------- sections

def _section(root: Tag, header_class: str) -> list[Tag]:
    """Sibling elements after an <h3 class=header_class> up to the next <h3>."""
    header = root.select_one(f"h3.{header_class}")
    if header is None:
        return []
    out = []
    for sib in header.next_siblings:
        if isinstance(sib, Tag):
            if sib.name in ("h2", "h3"):
                break
            out.append(sib)
    return out


def _required_items(el: Tag) -> list[dict]:
    """`Шаблон:Требуется`: <span nowrap><icon link/><a>Item</a> – N шт.</span>."""
    out = []
    for span in el.select("span[style*='nowrap']"):
        if not span.select_one("[typeof='mw:File']"):
            continue
        links = [a for a in span.find_all("a") if a.get_text(strip=True)]
        if not links:
            continue
        item: dict = {"itemId": slugify(_link_title(links[0]) or ""), "confidence": "wiki", "source": "template"}
        m = QTY_RE.search(_text(span))
        if m:
            lo, hi, lo_only, exact = m.groups()
            if exact:
                item["qty"] = _num(exact)
            elif lo and hi:
                item["qtyMin"], item["qtyMax"] = _num(lo), _num(hi)
            elif lo_only:
                item["qtyMin"] = _num(lo_only)
        out.append(item)
    return out


def _map_points(el: Tag) -> list[dict]:
    pts = []
    for m in el.select(".maps-map[data-mw-maps-mapdata]"):
        try:
            data = json.loads(m["data-mw-maps-mapdata"])
        except (json.JSONDecodeError, KeyError):
            continue
        for loc in data.get("locations") or []:
            pts.append({"layer": (data.get("layers") or [None])[0], "lat": loc.get("lat"), "lon": loc.get("lon")})
    return pts


def _kill_targets(text: str, links: list[tuple[str, str]], dicts: Dictionaries) -> list[dict]:
    out = []
    if not KILL_RE.search(text):
        return out
    m = KILL_QTY_RE.search(text)
    unclassified = [t for t, _ in links if dicts.classify(t) == "other"]
    if unclassified:
        target: dict = {"mobId": slugify(unclassified[0]), "confidence": "parsed"}
        if m:
            lo, hi, exact = m.groups()
            if exact:
                target["qty"] = int(exact)
            else:
                target["qtyMin"], target["qtyMax"] = int(lo), int(hi)
        out.append(target)
    else:
        m2 = re.search(r"убить\s+(\d+)\s+([а-яё]+)", text, re.I)
        if m2:
            out.append({"mobText": m2.group(2), "qty": int(m2.group(1)), "confidence": "parsed"})
    return out


def _build_step(order: int, blocks: list[Tag], dicts: Dictionaries, numbered: bool) -> dict:
    text = " ".join(_text(b) for b in blocks).strip()
    links: list[tuple[str, str]] = []
    items: list[dict] = []
    points: list[dict] = []
    for b in blocks:
        links += _links(b)
        items += _required_items(b)
        points += _map_points(b)
    item_ids = {i["itemId"] for i in items}
    # Item links outside the template have no quantity: kept as `parsed` with qty unknown.
    for title, _ in links:
        if dicts.classify(title) == "item" and slugify(title) not in item_ids:
            items.append({"itemId": slugify(title), "confidence": "parsed", "source": "link"})
            item_ids.add(slugify(title))
    locations = [slugify(t) for t, _ in links if dicts.classify(t) == "location"]
    npcs = [slugify(t) for t, _ in links if dicts.classify(t) == "npc"]
    squares = [tok for m in SQUARE_RE.finditer(text) for tok in SQUARE_TOKEN_RE.findall(m.group(1))]
    kind = "other"
    for name, rx in KIND_PATTERNS:
        if rx.search(text):
            kind = name
            break
    step = {
        "order": order,
        "kind": kind,
        "text": text,
        "items": items,
        "kills": _kill_targets(text, links, dicts),
        "locationIds": list(dict.fromkeys(locations)),
        "npcIds": list(dict.fromkeys(npcs)),
        "squares": list(dict.fromkeys(squares)),
        "mapPoints": points,
        "otherLinks": list(dict.fromkeys(slugify(t) for t, _ in links if dicts.classify(t) == "other")),
        "numbered": numbered,
        "confidence": "parsed",
    }
    return step


def parse_steps(blocks: list[Tag], dicts: Dictionaries) -> list[dict]:
    """Split «Процесс выполнения» on paragraphs that start with `N.`; otherwise one step."""
    content = [b for b in blocks if not ("tmpl-notice" in (b.get("class") or []))]
    groups: list[tuple[int, list[Tag]]] = []
    for b in content:
        m = STEP_NUM_RE.match(_text(b)) if b.name == "p" else None
        if m:
            groups.append((int(m.group(1)), [b]))
        elif groups:
            groups[-1][1].append(b)
        else:
            groups.append((0, [b]))  # preamble before the first numbered paragraph
    numbered = any(n > 0 for n, _ in groups)
    if not numbered:
        return [_build_step(1, content, dicts, numbered=False)] if content else []
    steps = []
    for n, bs in groups:
        if n == 0:
            continue
        steps.append(_build_step(n, bs, dicts, numbered=True))
    # Preamble (rare) is merged into the first numbered step.
    if groups[0][0] == 0 and steps:
        pre = _build_step(1, groups[0][1], dicts, numbered=True)
        for key in ("items", "kills", "locationIds", "npcIds", "squares", "mapPoints", "otherLinks"):
            steps[0][key] = pre[key] + steps[0][key]
        steps[0]["text"] = pre["text"] + " " + steps[0]["text"]
    return steps


def parse_notices(blocks: list[Tag]) -> tuple[list[str], list[str]]:
    tips, notes = [], []
    for b in blocks:
        for n in ([b] if "tmpl-notice" in (b.get("class") or []) else b.select(".tmpl-notice")):
            header = _text(n.select_one(".tmpl-notice-header"))
            body = _text(n.select_one(".tmpl-notice-text"))
            if body.startswith(BOILERPLATE_NOTICES):
                continue
            (tips if "Совет" in header else notes).append(body)
    return tips, notes


def parse_rewards(blocks: list[Tag]) -> list[dict]:
    rewards: list[dict] = []
    for b in blocks:
        classes = b.get("class") or []
        if "reward" not in classes:
            continue
        label_el = b.find(["u", "i"])
        label = _text(label_el).rstrip(":") if label_el else _text(b).split(":")[0]
        if "money" in classes:
            rewards.append({"kind": "money", "value": _num(_text(b).split(":", 1)[-1])})
        elif "xp" in classes:
            rewards.append({"kind": "xp", "value": _num(_text(b).split(":", 1)[-1])})
        elif "items" in classes:
            for div in b.find_all("div"):
                links = [a for a in div.find_all("a") if a.get_text(strip=True)]
                m = re.search(r"×\s*([\d\s]+)\s*шт", _text(div))
                if links:
                    rewards.append({"kind": "item", "value": _num(m.group(1)) if m else None,
                                    "target": slugify(_link_title(links[0]) or "")})
        elif label.startswith("Очки группировки"):
            rewards.append({"kind": "group", "value": _num(_text(b).split(":", 1)[-1])})
        elif label in ("Репутация", "Очки торговли"):
            kind = "rep" if label == "Репутация" else "trade"
            p = b.find("p") or b
            line: list = []
            lines: list[list] = []
            for ch in p.children:
                if isinstance(ch, Tag) and ch.name == "br":
                    lines.append(line)
                    line = []
                else:
                    line.append(ch)
            lines.append(line)
            for ln in lines:
                frag = BeautifulSoup("".join(str(x) for x in ln), "lxml")
                txt = _text(frag)
                a = frag.find("a")
                m = re.match(r"^(.+?):\s*(-?\d[\d\s,]*)\s*(?:очк\w*|очко)\s+\w+\s*(?:\((.*)\))?", txt)
                if not a or not m:
                    continue
                r = {"kind": kind, "value": _num(m.group(2)), "target": slugify(_link_title(a) or "")}
                if m.group(3):
                    r["note"] = m.group(3)
                rewards.append(r)
        else:
            rewards.append({"kind": "other", "value": _text(b)})
    return rewards


def parse_quest(html: str, dicts: Dictionaries, url: str = "") -> dict:
    soup = BeautifulSoup(html, "lxml")
    cfg = mw_config(html)
    root = soup.select_one("#mw-content-text .mw-parser-output")
    title = cfg.get("wgTitle") or _text(soup.select_one("#firstHeading"))
    info = parse_infobox(root)

    desc_blocks = _section(root, "quest-description-header")
    process_blocks = _section(root, "quest-process-header")
    reward_blocks = _section(root, "quest-reward-header")
    hidden = any("Скрытое задание" in _text(b) for b in desc_blocks)
    desc_paras = [_text(b) for b in desc_blocks if b.name == "p" and _text(b)]
    journal_stages = [p for p in desc_paras if STEP_NUM_RE.match(p)]
    tips, notes = parse_notices(process_blocks + reward_blocks)

    quest = {
        "id": slugify(title),
        "title": title,
        "url": url,
        "revision": cfg.get("wgRevisionId"),
        "categories": cfg.get("wgCategories", []),
        "typeRaw": info.get("typeRaw"),
        "type": TYPE_MAP.get(info.get("typeRaw") or "", "other"),
        "periodHours": info.get("periodHours"),
        "start": info.get("start"),
        "end": info.get("end"),
        "conditions": info.get("conditions", []),
        "prev": info.get("prev", []),
        "prevLogic": info.get("prevLogic", "none"),
        "prevSeparators": info.get("prevSeparators", []),
        "next": info.get("next", []),
        "chapter": info.get("chapter"),
        "chapterQuests": info.get("chapterQuests", []),
        "hidden": hidden,
        "description": " ".join(p for p in desc_paras if not STEP_NUM_RE.match(p)) or None,
        "journalStages": journal_stages,
        "steps": parse_steps(process_blocks, dicts),
        "rawProcess": "\n".join(_text(b) for b in process_blocks
                                if "tmpl-notice" not in (b.get("class") or []) and _text(b)),
        "tip": "\n".join(tips) or None,
        "notes": notes,
        "rewards": parse_rewards(reward_blocks),
        # Board quests: listed rewards are base values per item / per kill, scaled by the quantity issued.
        "rewardsPerUnit": any(n.startswith("Размер итоговой награды") for n in notes),
    }
    return quest


def load_dictionaries(npc_html: str, locations_html: str, *items_html: str) -> Dictionaries:
    d = Dictionaries()
    for q in smw_query_results(npc_html):
        for row in q["query"]["result"]:
            name_cell = BeautifulSoup(row[0]["display"], "lxml").find("a")
            if not name_cell:
                continue
            loc = BeautifulSoup(row[1]["display"], "lxml").get_text(" ", strip=True) if len(row) > 1 else None
            d.npcs[_link_title(name_cell)] = {"location": loc or None}
    for html, target in [(locations_html, d.locations)] + [(h, d.items) for h in items_html]:
        root = BeautifulSoup(html, "lxml").select_one("#mw-content-text .mw-parser-output")
        for a in root.select("a[href^='/wiki/']"):
            t = _link_title(a)
            if t and t != "Заглавная страница":
                target.add(t)
    # Index pages also link to their own sub-index pages; those are not items.
    d.items -= {"Трофеи", "Упаковки", "Рецепты", "Медицина", "Пища", "Грибы", "Цветы и растения"}
    return d


def iter_titles(sample: dict) -> Iterable[tuple[str, str]]:
    for group, titles in sample.items():
        for t in titles:
            yield group, t
