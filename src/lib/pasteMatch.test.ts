import { describe, expect, it } from "vitest";

import { matchPastedList, parsePastedList } from "./pasteMatch";
import { buildSearchIndex } from "./search";
import { plainNames, quest } from "./testQuests";

const index = buildSearchIndex(
  [
    quest('"Запчасти"_для_Химика'),
    quest("Найти_Лешича"),
    quest("Лешич:_Витёк_с_Новой_Земли"),
    quest("Возможно_позже", { hidden: true }),
    quest("(Групп)_Бинт_антисептический_(Вез)", { variant: { groupId: "G", label: "Вез", confidence: "parsed" } }),
    quest("(Групп)_Бинт_антисептический_(ЧЛ)", { variant: { groupId: "G", label: "ЧЛ", confidence: "parsed" } }),
  ],
  plainNames,
);

describe("parsePastedList", () => {
  it("drops list markers and empty lines", () => {
    expect(parsePastedList("1. Найти Лешича\n\n- Возможно позже\n• Запчасти\n[ ] X\n")).toEqual([
      "Найти Лешича",
      "Возможно позже",
      "Запчасти",
      "X",
    ]);
  });
});

describe("matchPastedList", () => {
  const [exact, quotes, hidden, group, several, none] = matchPastedList(
    index,
    ["найти лешича", "Запчасти для химика", "Возможно позже", "(Групп) Бинт антисептический", "лешич", "абракадабра"].join("\n"),
  );

  it("recognizes exact titles ignoring case and quotes, including hidden quests", () => {
    expect(exact).toEqual({ line: "найти лешича", kind: "recognized", questId: "Найти_Лешича" });
    expect(quotes).toMatchObject({ kind: "recognized", questId: '"Запчасти"_для_Химика' });
    expect(hidden).toMatchObject({ kind: "recognized", questId: "Возможно_позже" });
  });

  it("asks to choose among variants or several hits", () => {
    expect(group).toMatchObject({ kind: "ambiguous", candidates: ["(Групп)_Бинт_антисептический_(Вез)", "(Групп)_Бинт_антисептический_(ЧЛ)"] });
    expect(several.kind).toBe("ambiguous");
    expect(several.kind === "ambiguous" && several.candidates).toEqual(expect.arrayContaining(["Найти_Лешича", "Лешич:_Витёк_с_Новой_Земли"]));
  });

  it("reports lines with no match", () => {
    expect(none).toEqual({ line: "абракадабра", kind: "notFound" });
  });
});
