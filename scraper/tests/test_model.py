from pathlib import Path

import pytest

from provodnik_scraper.model import prev_logic, qty, step_npc, step_places, to_model, variant
from provodnik_scraper.parse import Dictionaries, parse_quest

FIXTURES = Path(__file__).parent / "fixtures"
DICTS = Dictionaries(
    npcs={"Химик": {"location": "Везувий"}, "Литовский": {"location": "Везувий"}, "Капеллан": {"location": "Везувий"}},
    locations={"Везувий", "Тунгуска", "Черный лес"},
    items={"Бинт антисептический", "Обрезки проводков"},
)
NPC_LOCATIONS = {"Литовский": "Везувий", "Штопор": "Тунгуска"}


def build(name: str) -> dict:
    return to_model(parse_quest((FIXTURES / name).read_text(), DICTS), NPC_LOCATIONS, "2026-10-04T07:38:30Z")


@pytest.mark.parametrize("parsed,expected", [
    ({"qty": 3}, {"min": 3, "max": 3}),
    ({"qtyMin": 20, "qtyMax": 50}, {"min": 20, "max": 50}),
    ({"qtyMin": 2}, {"min": 2}),
    ({}, None),
])
def test_qty(parsed, expected):
    assert qty(parsed) == expected


@pytest.mark.parametrize("title,expected", [
    ("(Групп) Бинт антисептический (Вез)", {"groupId": "(Групп)_Бинт_антисептический", "label": "Вез", "confidence": "parsed"}),
    ("(Групп) Посылка Борову (База: Заброшенный рудник)",
     {"groupId": "(Групп)_Посылка_Борову", "label": "База: Заброшенный рудник", "confidence": "parsed"}),
    ("(Бар у ЛВЗ) Специи", None),  # faction prefix, not a variant
    ("\"Запчасти\" для Химика", None),
])
def test_variant(title, expected):
    assert variant(title) == expected


@pytest.mark.parametrize("parsed,expected", [
    ("none", "and"), ("single", "and"), ("and", "and"), ("or", "or"), ("mixed", "unknown"), ("unknown", "unknown"),
])
def test_prev_logic(parsed, expected):
    assert prev_logic(parsed) == expected


def test_step_npc_prefers_end_then_last_mentioned():
    assert step_npc({"npcIds": ["Лешич", "Витёк"]}, None) == "Витёк"
    assert step_npc({"npcIds": ["Химик", "Симург"]}, {"npcId": "Химик"}) == "Химик"
    assert step_npc({"npcIds": []}, None) is None


def test_places_pair_squares_only_when_unambiguous():
    step = {"locationIds": ["Везувий", "Тунгуска"], "squares": ["E2-2", "C2-4"], "npcIds": []}
    assert [p["squares"] for p in step_places(step, False, None, None, {})] == [["E2-2"], ["C2-4"]]
    step["squares"] = ["E2-2"]
    assert [p["squares"] for p in step_places(step, False, None, None, {})] == [[], []]


def test_places_fallbacks():
    end = {"kind": "npc", "npcId": "Химик", "locationId": "Везувий"}
    no_loc = {"locationIds": [], "squares": [], "npcIds": []}
    # last step without any location -> end NPC's location, straight from the infobox
    assert step_places(no_loc, True, None, end, {}) == [{"locationId": "Везувий", "squares": [], "confidence": "wiki"}]
    # not the last step -> nothing invented
    assert step_places(no_loc, False, None, end, {}) == []
    # NPC named in the step -> NPC index location, marked parsed
    with_npc = {"locationIds": [], "squares": ["D5-2"], "npcIds": ["Штопор"]}
    assert step_places(with_npc, False, None, None, {"Штопор": "Тунгуска"}) == [
        {"locationId": "Тунгуска", "squares": ["D5-2"], "confidence": "parsed"}]


def test_simple_quest_model():
    q = build("zapchasti_dlya_khimika.html")
    assert q["end"] == {"kind": "npc", "npcId": "Химик", "locationId": "Везувий", "confidence": "wiki"}
    assert q["prevLogic"] == "and"
    assert q["updatedAt"] == "2026-10-04T07:38:30Z"
    [step] = q["steps"]
    assert step["npcId"] == "Химик"
    assert step["text"] == "Отправляйтесь на локацию Везувий, в северо-восточный сектор квадрата I3-1. Отыщите Химика и передайте ему образцы."
    assert step["places"] == [{"locationId": "Везувий", "squares": ["I3-1"], "confidence": "parsed"}]
    assert step["items"] == []


def test_multistage_numbers_are_stripped():
    q = build("pomogai_ili_ne_meshai.html")
    assert [s["order"] for s in q["steps"]] == [1, 2, 3, 4, 5, 6]
    assert q["steps"][0]["text"].startswith("Отправляйтесь на локацию Везувий")
    assert q["journalStages"][0] == "Повесить плакат в тоннеле на болоте."


def test_board_quest_range_and_per_unit_rewards():
    q = build("obrezki_provodov.html")
    assert q["steps"][0]["items"] == [{"itemId": "Обрезки_проводков", "qty": {"min": 20, "max": 50}, "confidence": "wiki"}]
    assert all(r.get("perUnit") for r in q["rewards"])


def test_auto_end_and_unknown_logic():
    assert build("pyaltsem_v_nebo.html")["end"] == {"kind": "auto", "confidence": "wiki"}
    q = build("vozmozhno_pozzhe.html")
    assert q["prevLogic"] == "unknown" and q["hidden"] is True
    assert q["prev"][2] == {"questId": "Пошел_искать_и_потерялся", "states": ["failed", "none"], "statusRaw": "нет в наличии и не выполнено"}


def test_group_variant_quest():
    q = build("grupp_bint_vez.html")
    assert q["variant"]["groupId"] == "(Групп)_Бинт_антисептический"
    assert q["steps"][0]["items"][0]["qty"] == {"min": 3, "max": 3}
