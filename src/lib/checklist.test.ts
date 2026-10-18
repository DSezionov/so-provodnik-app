import { describe, expect, it } from "vitest";

import { buildChecklist } from "./checklist";
import { entry, quest, step } from "./testQuests";

const item = (itemId: string, qty?: { min: number; max?: number }) => ({ itemId, qty, confidence: "wiki" as const });

describe("buildChecklist", () => {
  it("sums the same item across quests and keeps per-quest parts", () => {
    const a = quest("A", { steps: [step(1, { kind: "deliver", items: [item("Аккумулятор", { min: 3, max: 3 })] })] });
    const b = quest("B", { steps: [step(1, { kind: "deliver", items: [item("Аккумулятор", { min: 3, max: 3 })] })] });
    const { items } = buildChecklist([a, b].map((q) => ({ quest: q, entry: entry(q.id) })));
    expect(items).toHaveLength(1);
    expect(items[0].total).toEqual({ min: 6, max: 6, incomplete: false });
    expect(items[0].parts.map((p) => p.questId)).toEqual(["A", "B"]);
  });

  it("sums ranges by bounds, keeps open ranges open and flags unknown quantities", () => {
    const a = quest("A", { steps: [step(1, { items: [item("Сало", { min: 10, max: 20 })] })] });
    const b = quest("B", { steps: [step(1, { items: [item("Сало", { min: 2 })] })] });
    const c = quest("C", { steps: [step(1, { items: [item("Сало")] })] });
    const { items } = buildChecklist([a, b, c].map((q) => ({ quest: q, entry: entry(q.id) })));
    expect(items[0].total).toEqual({ min: 12, max: null, incomplete: true });
  });

  it("uses the amount the player entered for a range", () => {
    const a = quest("A", { steps: [step(1, { items: [item("Сало", { min: 10, max: 20 })] })] });
    const { items } = buildChecklist([{ quest: a, entry: entry("A", { qtyOverride: { Сало: 14 } }) }]);
    expect(items[0].total).toEqual({ min: 14, max: 14, incomplete: false });
  });

  it("only counts remaining steps", () => {
    const a = quest("A", { steps: [step(1, { items: [item("X", { min: 1, max: 1 })] }), step(2, { items: [item("Y", { min: 2, max: 2 })] })] });
    expect(buildChecklist([{ quest: a, entry: entry("A", { currentStep: 2 }) }]).items.map((l) => l.key)).toEqual(["Y"]);
  });

  it("keeps kills in their own block", () => {
    const a = quest("A", { steps: [step(1, { kind: "kill", kills: [{ mobId: "Драуг", name: "Драуг", qty: { min: 1, max: 3 }, confidence: "parsed" }] })] });
    const r = buildChecklist([{ quest: a, entry: entry("A") }]);
    expect(r.items).toEqual([]);
    expect(r.kills[0]).toMatchObject({ key: "Драуг", total: { min: 1, max: 3, incomplete: false }, parsed: true });
  });

  it("lists quests to check on the wiki when a delivery has no recognized items", () => {
    const a = quest("A", { steps: [step(1, { kind: "deliver", text: "передайте ему образцы" })] });
    expect(buildChecklist([{ quest: a, entry: entry("A") }]).checkOnWiki).toEqual(["A"]);
  });
});
