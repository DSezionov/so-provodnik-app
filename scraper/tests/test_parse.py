from pathlib import Path

import pytest

from provodnik_scraper.fetch import RobotsRules, USER_AGENT
from provodnik_scraper.parse import Dictionaries, _kill_targets, parse_prev_status, parse_quest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def dicts() -> Dictionaries:
    # Minimal hand-made dictionaries: tests check the parser, not the index pages.
    return Dictionaries(
        npcs={"Химик": {"location": "Везувий"}, "Симург": {"location": "Везувий"}, "Капеллан": {"location": "Везувий"},
              "Литовский": {"location": "Везувий"}, "Митька": {"location": None}, "Штопор": {"location": "Тунгуска"}},
        locations={"Везувий", "Тунгуска", "Черный лес"},
        items={"Бинт антисептический", "Обрезки проводков"},
    )


def load(name: str, dicts: Dictionaries) -> dict:
    return parse_quest((FIXTURES / name).read_text(), dicts)


class TestRobots:
    rules = RobotsRules.parse((FIXTURES / "robots.txt").read_text(), USER_AGENT)

    @pytest.mark.parametrize("path", ["/w/api.php?action=query", "/wiki/Special:Ask", "/wiki/Служебная:Ask",
                                      "/wiki/edit/X", "/wiki/X?oldid=1", "/wiki/X?action=history"])
    def test_disallowed(self, path):
        assert not self.rules.allowed(path)

    @pytest.mark.parametrize("path", ["/wiki/Задания", "/wiki/%D0%97%D0%B0%D0%B4%D0%B0%D0%BD%D0%B8%D1%8F", "/sitemap.xml"])
    def test_allowed(self, path):
        assert self.rules.allowed(path)

    def test_crawl_delay(self):
        assert self.rules.crawl_delay == 5


def test_simple_once_quest(dicts):
    q = load("zapchasti_dlya_khimika.html", dicts)
    assert q["type"] == "once"
    assert q["revision"] == 96359
    assert q["start"] == {"npcId": "Симург", "locationId": "Везувий", "confidence": "wiki"}
    assert q["end"]["npcId"] == "Химик"
    assert q["prev"] == [{"questId": "Разведка_местности", "states": ["done"], "statusRaw": "выполнено"}]
    assert q["prevLogic"] == "single"
    assert q["next"] == ["Нельзя_сделать_яд,_не_разбив_пару..."]
    [step] = q["steps"]
    assert step["squares"] == ["I3-1"]
    assert step["locationIds"] == ["Везувий"] and step["npcIds"] == ["Химик"]
    assert step["items"] == []  # «образцы» are not a linked item: nothing invented
    assert q["tip"].startswith("Если двигаться со стороны железнодорожного моста")
    assert {"kind": "money", "value": 50000} in q["rewards"]
    assert {"kind": "rep", "value": -35, "target": "Ковчег",
            "note": "при наличии у Чистилище больше 3000 очков репутации"} in q["rewards"]


def test_multistage_quest(dicts):
    q = load("pomogai_ili_ne_meshai.html", dicts)
    assert [s["order"] for s in q["steps"]] == [1, 2, 3, 4, 5, 6]
    assert len(q["journalStages"]) == 6
    assert [s["squares"] for s in q["steps"]] == [["A2-2"], ["H5-2"], ["I9-1"], ["E2-4"], ["A5-2"], ["E2-1"]]
    assert q["steps"][0]["mapPoints"] == [{"layer": "Vesuvius", "lat": 76.88077, "lon": -168.31055}]
    assert q["steps"][5]["npcIds"] == ["Капеллан"]
    assert q["conditions"] == ["завершить пункт 2 задания Долг против веры"]
    assert q["chapter"] == "Долг_против_веры"


def test_template_item_and_group_variant(dicts):
    q = load("grupp_bint_vez.html", dicts)
    assert q["type"] == "repeatable" and q["periodHours"] == 12
    [step] = q["steps"]
    assert step["items"] == [{"itemId": "Бинт_антисептический", "confidence": "wiki", "source": "template", "qty": 3}]
    assert {"kind": "group", "value": 10} in q["rewards"]
    assert any("других Управляющих" in n for n in q["notes"])


def test_board_quest_qty_range(dicts):
    q = load("obrezki_provodov.html", dicts)
    assert q["type"] == "board"
    [item] = q["steps"][0]["items"]
    assert (item["qtyMin"], item["qtyMax"]) == (20, 50) and "qty" not in item
    # Generic board-quest rules are filtered out; the per-unit reward note is quest-specific and kept.
    assert len(q["notes"]) == 1 and q["notes"][0].startswith("Размер итоговой награды")
    assert q["rewardsPerUnit"] is True


def test_explicit_mixed_prev_logic_and_hidden(dicts):
    q = load("vozmozhno_pozzhe.html", dicts)
    assert q["hidden"] is True
    assert q["prevLogic"] == "mixed" and q["prevSeparators"] == ["или", "и"]
    assert [p["states"] for p in q["prev"]] == [["done"], ["done"], ["failed", "none"]]


@pytest.mark.parametrize("raw,expected", [
    ("выполнено", ["done"]),
    ("в наличии или выполнено", ["taken", "done"]),
    ("в наличии, выполнено или провалено", ["taken", "done", "failed"]),
    ("выполнено или провалено", ["done", "failed"]),
    ("нет в наличии и не выполнено", ["failed", "none"]),
    ("не выполнено", ["taken", "failed", "none"]),
    ("не выполнено и нет в наличии", ["failed", "none"]),
    ("нет в наличии или выполнено", ["done", "failed", "none"]),
    ("выполнено 3 раза", None),
    ("что-то новое", None),
])
def test_prev_status(raw, expected):
    assert parse_prev_status(raw) == expected


@pytest.mark.parametrize("text,links,expected", [
    ("Необходимо убить Драуг - от 1 до 3 штук.", [("Драуг", "Драуг")], [{"mobId": "Драуг", "qtyMin": 1, "qtyMax": 3, "confidence": "parsed"}]),
    ("Необходимо убить 10 собак, обитающих вдоль дороги.", [], [{"mobText": "собак", "qty": 10, "confidence": "parsed"}]),
    # the weapon link is not the target
    ("Вооружиться оружием IMI UZI и убить из него 5 противников.", [("IMI UZI", "IMI UZI")], [{"mobText": "противников", "qty": 5, "confidence": "parsed"}]),
    ("Поговорить с Химиком.", [("Химик", "Химиком")], []),
])
def test_kill_targets(dicts, text, links, expected):
    assert _kill_targets(text, links, dicts) == expected


def test_auto_complete_end(dicts):
    q = load("pyaltsem_v_nebo.html", dicts)
    assert q["end"] == {"raw": "автозавершение", "confidence": "wiki"}
    assert q["steps"][0]["squares"] == ["D5-2"]
