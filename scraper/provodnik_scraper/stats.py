"""Data-quality statistics of the built public/data/quests.json (SPEC §4.1 «report»).

    python -m provodnik_scraper.stats   # prints a Markdown section
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"


def pct(n: int, d: int) -> str:
    return "—" if d == 0 else f"{n}/{d} ({round(100 * n / d)}%)"


def main() -> None:
    meta = json.loads((DATA / "meta.json").read_text())
    quests = json.loads((DATA / "quests.json").read_text())["quests"]
    types = Counter(q.get("typeRaw") or q["type"] for q in quests)
    steps = [s for q in quests for s in q["steps"]]
    items = [i for s in steps for i in s["items"]]
    kills = [k for s in steps for k in s["kills"]]
    end_kinds = Counter((q.get("end") or {}).get("kind", "none") for q in quests)
    multi_prev = [q for q in quests if len(q["prev"]) > 1]

    rows = [
        ("Заданий", str(len(quests))),
        ("По типам", ", ".join(f"{k}: {v}" for k, v in types.most_common())),
        ("Скрытых", pct(sum(q["hidden"] for q in quests), len(quests))),
        ("Вариаций `(Групп)`", pct(sum("variant" in q for q in quests), len(quests))),
        ("Начало: NPC", pct(sum(bool(q.get("start")) for q in quests), len(quests))),
        ("Конец: NPC / автозавершение / нет", f"{end_kinds['npc']} / {end_kinds['auto']} / {end_kinds['none']}"),
        ("Несколько предыдущих", f"{len(multi_prev)}, из них логика И/ИЛИ явная: {sum(q['prevLogic'] != 'unknown' for q in multi_prev)}"),
        ("Статус предыдущего распознан", pct(sum(p["states"] != "unknown" for q in quests for p in q["prev"]), sum(len(q["prev"]) for q in quests))),
        ("Этапы журнала совпадают с шагами", pct(sum(bool(q["journalStages"]) and len(q["journalStages"]) == len(q["steps"]) for q in quests),
                                                  sum(bool(q["journalStages"]) for q in quests))),
        ("Шагов", str(len(steps))),
        ("Шаг: локация определена", pct(sum(bool(s["places"]) for s in steps), len(steps))),
        ("Шаг: квадрат", pct(sum(any(p["squares"] for p in s["places"]) for s in steps), len(steps))),
        ("Шаг: NPC", pct(sum("npcId" in s for s in steps), len(steps))),
        ("Шаг: несколько мест на выбор", pct(sum(len(s["places"]) > 1 for s in steps), len(steps))),
        ("Требуемых предметов", f"{len(items)}, с количеством: {pct(sum('qty' in i for i in items), len(items))}"),
        ("Целей убийства", f"{len(kills)}, с количеством: {pct(sum('qty' in k for k in kills), len(kills))}"),
        ("Награды «за единицу»", pct(sum(any(r.get("perUnit") for r in q["rewards"]) for q in quests), len(quests))),
    ]
    print(f"## Полный сбор ({meta['version'][:10]})\n")
    print("| Показатель | Значение |\n|---|---|")
    for k, v in rows:
        print(f"| {k} | {v} |")


if __name__ == "__main__":
    main()
