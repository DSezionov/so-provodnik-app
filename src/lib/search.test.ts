import { describe, expect, it } from "vitest";

import type { Quest } from "../data/types";
import { buildSearchIndex, normalize, searchQuests, type SearchFilters } from "./search";
import { plainNames as names, quest } from "./testQuests";

const QUESTS: Quest[] = [
  quest('"Запчасти"_для_Химика', { start: { npcId: "Симург", locationId: "Везувий", confidence: "wiki" } }),
  quest('"Беленькая"_для_Свекольного'),
  quest("Всё_не_стерилизуешь", { type: "board", start: { npcId: "Глеб_Маслов", locationId: "Окрестности_Любеча", confidence: "wiki" } }),
  quest("Пальцем_в_небо", { start: { npcId: "Леонид_Кесаревич", locationId: "Тунгуска", confidence: "wiki" } }),
  quest("Возможно_позже", { hidden: true }),
  quest("(Групп)_Бинт_антисептический_(Вез)", { variant: { groupId: "(Групп)_Бинт_антисептический", label: "Вез", confidence: "parsed" } }),
  quest("(Групп)_Бинт_антисептический_(ЧЛ)", { variant: { groupId: "(Групп)_Бинт_антисептический", label: "ЧЛ", confidence: "parsed" } }),
];

const index = buildSearchIndex(QUESTS, names);
const ids = (query: string, opts?: SearchFilters) => searchQuests(index, query, opts).map((h) => h.questId);

describe("normalize", () => {
  it("ignores case, ё/е and quotes", () => {
    expect(normalize('"Беленькая" для Свекольного')).toBe("беленькая для свекольного");
    expect(normalize("«Всё» НЕ")).toBe("все не");
  });
});

describe("searchQuests", () => {
  it("finds titles regardless of quotes", () => {
    expect(ids("беленькая для свекольного")[0]).toBe('"Беленькая"_для_Свекольного');
    expect(ids('"Запчасти"')[0]).toBe('"Запчасти"_для_Химика');
  });

  it("treats ё and е as the same letter", () => {
    expect(ids("все не стерилизуешь")).toContain("Всё_не_стерилизуешь");
  });

  it("searches by NPC and by location", () => {
    expect(ids("симург")).toEqual(['"Запчасти"_для_Химика']);
    expect(ids("тунгуска")).toEqual(["Пальцем_в_небо"]);
  });

  it("tolerates a typo in longer words and matches prefixes", () => {
    expect(ids("химека")).toContain('"Запчасти"_для_Химика');
    expect(ids("пальц")).toContain("Пальцем_в_небо");
  });

  it("hides hidden quests unless asked", () => {
    expect(ids("возможно позже")).toEqual([]);
    expect(ids("возможно позже", { showHidden: true })).toEqual(["Возможно_позже"]);
    expect(ids("")).not.toContain("Возможно_позже");
  });

  it("collapses variants into one hit listing all of them", () => {
    const hits = searchQuests(index, "бинт");
    expect(hits).toHaveLength(1);
    expect(hits[0].variantIds).toEqual(["(Групп)_Бинт_антисептический_(Вез)", "(Групп)_Бинт_антисептический_(ЧЛ)"]);
  });

  it("filters by quest type and by location", () => {
    expect(ids("", { types: ["board"] })).toEqual(["Всё_не_стерилизуешь"]);
    expect(ids("", { locationId: "Везувий" })).toEqual(['"Запчасти"_для_Химика']);
    expect(ids("пальцем", { types: ["board"] })).toEqual([]);
  });

  it("lists everything by title for an empty query", () => {
    expect(searchQuests(index, "  ")).toHaveLength(5); // 7 quests − 1 hidden − 1 collapsed variant
  });
});
