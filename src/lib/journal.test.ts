import { describe, expect, it } from "vitest";

import {
  JOURNAL_LIMIT,
  addEntries,
  moveEntryBy,
  moveEntryTo,
  nextFromSameNpc,
  rangeRequirements,
  removeEntry,
  setCurrentStep,
  setQtyOverride,
  setStatus,
  sortEntries,
  type JournalEntry,
} from "./journal";
import { quest } from "./testQuests";

const NOW = "2026-10-18T12:00:00Z";
const ids = (entries: JournalEntry[]) => sortEntries(entries).map((e) => e.questId);

describe("addEntries", () => {
  it("appends as taken with step 1 and skips duplicates", () => {
    const first = addEntries([], ["A", "B"], NOW);
    expect(ids(first.entries)).toEqual(["A", "B"]);
    expect(first.entries[0]).toMatchObject({ status: "taken", currentStep: 1, order: 0 });
    const second = addEntries(first.entries, ["B", "C"], NOW);
    expect(ids(second.entries)).toEqual(["A", "B", "C"]);
    expect(second.alreadyInJournal).toEqual(["B"]);
    expect(second.added).toEqual(["C"]);
  });

  it("adds as planned once 50 quests are taken; planned ones do not count", () => {
    const full = addEntries([], Array.from({ length: JOURNAL_LIMIT }, (_, i) => `Q${i}`), NOW).entries;
    const withPlanned = addEntries(full, ["P"], NOW, "planned").entries;
    const r = addEntries(withPlanned, ["X"], NOW);
    expect(r.addedAsPlanned).toEqual(["X"]);
    expect(r.entries.find((e) => e.questId === "X")?.status).toBe("planned");
  });
});

describe("setStatus", () => {
  it("toggles planned/taken but refuses taken over the limit", () => {
    const base = addEntries([], ["A"], NOW, "planned").entries;
    expect(setStatus(base, "A", "taken")?.[0].status).toBe("taken");
    const full = addEntries(base, Array.from({ length: JOURNAL_LIMIT }, (_, i) => `Q${i}`), NOW).entries;
    expect(setStatus(full, "A", "taken")).toBeNull();
  });
});

describe("ordering", () => {
  const entries = addEntries([], ["A", "B", "C", "D"], NOW).entries;

  it("moves by drag target", () => {
    expect(ids(moveEntryTo(entries, "D", "A"))).toEqual(["D", "A", "B", "C"]);
    expect(ids(moveEntryTo(entries, "A", "C"))).toEqual(["B", "C", "A", "D"]);
  });

  it("moves up/down and stays put at the edges", () => {
    expect(ids(moveEntryBy(entries, "C", -1))).toEqual(["A", "C", "B", "D"]);
    expect(ids(moveEntryBy(entries, "A", -1))).toEqual(["A", "B", "C", "D"]);
    expect(ids(moveEntryBy(entries, "D", 1))).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps orders contiguous after removal", () => {
    expect(sortEntries(removeEntry(entries, "B")).map((e) => e.order)).toEqual([0, 1, 2]);
  });
});

describe("per-entry settings", () => {
  const entries = addEntries([], ["A"], NOW).entries;

  it("clamps the current step to the quest's steps", () => {
    expect(setCurrentStep(entries, "A", 9, 3)[0].currentStep).toBe(4); // 4 = all 3 steps done
    expect(setCurrentStep(entries, "A", 0, 3)[0].currentStep).toBe(1);
  });

  it("stores and clears quantity overrides", () => {
    const set = setQtyOverride(entries, "A", "Сало", 14);
    expect(set[0].qtyOverride).toEqual({ Сало: 14 });
    expect(setQtyOverride(set, "A", "Сало", undefined)[0].qtyOverride).toBeUndefined();
  });
});

describe("nextFromSameNpc", () => {
  const a = quest("A", { end: { kind: "npc", npcId: "Химик", confidence: "wiki" }, next: ["B", "C", "Missing"] });
  const b = quest("B", { start: { npcId: "Химик", confidence: "wiki" } });
  const c = quest("C", { start: { npcId: "Симург", confidence: "wiki" } });
  const byId = new Map([a, b, c].map((q) => [q.id, q]));

  it("offers only next quests given by the NPC who takes A, not yet in the journal", () => {
    expect(nextFromSameNpc(a, byId, new Set()).map((q) => q.id)).toEqual(["B"]);
    expect(nextFromSameNpc(a, byId, new Set(["B"]))).toEqual([]);
  });

  it("offers nothing after an auto-completed quest", () => {
    expect(nextFromSameNpc({ ...a, end: { kind: "auto", confidence: "wiki" } }, byId, new Set())).toEqual([]);
  });
});

describe("rangeRequirements", () => {
  const step = (order: number, extra: object) => ({ order, kind: "other" as const, text: "", places: [], items: [], kills: [], confidence: "parsed" as const, ...extra });
  const q = quest("Q", {
    steps: [
      step(1, { items: [{ itemId: "Сало", qty: { min: 10, max: 20 }, confidence: "wiki" }] }),
      step(2, {
        items: [{ itemId: "Бинт", qty: { min: 3, max: 3 }, confidence: "wiki" }],
        kills: [{ mobId: "Драуг", name: "Драуг", qty: { min: 1, max: 3 }, confidence: "parsed" }, { name: "собак", qty: { min: 2 }, confidence: "parsed" }],
      }),
    ],
  });

  it("lists only ranged / open-ended quantities of the remaining steps", () => {
    expect(rangeRequirements(q, 1).map((r) => r.key)).toEqual(["Сало", "Драуг", "собак"]);
    expect(rangeRequirements(q, 2).map((r) => r.key)).toEqual(["Драуг", "собак"]);
  });
});
