import { describe, expect, it } from "vitest";

import { buildRoute, type RouteBlock } from "./route";
import { at, entry, quest, step } from "./testQuests";

const npcEnd = (npcId: string, locationId: string) => ({ kind: "npc" as const, npcId, locationId, confidence: "wiki" as const });

/** Compact view: «Location: npc[quest#step, …] | …». */
function view(blocks: RouteBlock[]) {
  return blocks.map(
    (b) => `${b.locationId ?? "?"}: ${b.stops.map((s) => `${s.npcId ?? s.hunt ?? s.squares.join(",") ?? "-"}[${s.actions.map((a) => `${a.questId}#${a.planStep}`).join(",")}]`).join(" | ")}`,
  );
}

describe("buildRoute", () => {
  it("starts where the top-priority quest goes and merges same-NPC actions", () => {
    const a = quest("A", { end: npcEnd("Химик", "Везувий"), steps: [step(1, { npcId: "Химик", places: at("Везувий") })] });
    const b = quest("B", { end: npcEnd("Митрофан", "Любеч"), steps: [step(1, { npcId: "Митрофан", places: at("Любеч") })] });
    const c = quest("C", { end: npcEnd("Химик", "Везувий"), steps: [step(1, { npcId: "Химик", places: at("Везувий") })] });
    expect(view(buildRoute([a, b, c].map((q) => ({ quest: q, entry: entry(q.id) }))))).toEqual([
      "Везувий: Химик[A#1,C#1]",
      "Любеч: Митрофан[B#1]",
    ]);
  });

  it("keeps steps of one quest in order and follows chains inside a location", () => {
    const a = quest("A", {
      end: npcEnd("Крол", "Окрестности"),
      steps: [step(1, { places: at("Любеч", "C3-2") }), step(2, { npcId: "Крол", places: at("Окрестности", "B5-3") })],
    });
    const b = quest("B", { end: npcEnd("Крол", "Окрестности"), steps: [step(1, { npcId: "Крол", places: at("Окрестности") })] });
    expect(view(buildRoute([a, b].map((q) => ({ quest: q, entry: entry(q.id) }))))).toEqual([
      "Любеч: C3-2[A#1]",
      "Окрестности: Крол[A#2,B#1]",
    ]);
  });

  it("continues from the current step", () => {
    const a = quest("A", { steps: [step(1, { places: at("X") }), step(2, { npcId: "N", places: at("Y") })] });
    expect(view(buildRoute([{ quest: a, entry: entry("A", { currentStep: 2 }) }]))).toEqual(["Y: N[A#2]"]);
  });

  it("puts a planned quest's pickup first and after its prerequisite's hand-in", () => {
    const a = quest("A", { end: npcEnd("Химик", "Везувий"), steps: [step(1, { places: at("Тунгуска", "D5-2") })] });
    const b = quest("B", {
      start: { npcId: "Химик", locationId: "Везувий", confidence: "wiki" },
      end: npcEnd("Химик", "Везувий"),
      prev: [{ questId: "A", states: ["done"] }],
      steps: [step(1, { kind: "deliver", items: [{ itemId: "Бинт", qty: { min: 3, max: 3 }, confidence: "wiki" }] })],
    });
    // B first in priority, but it can only be taken after A is handed in.
    expect(view(buildRoute([{ quest: b, entry: entry("B", { status: "planned" }) }, { quest: a, entry: entry("A") }]))).toEqual([
      "Тунгуска: D5-2[A#1]",
      "Везувий: Химик[A#2,B#0,B#1]",
    ]);
  });

  it("chooses the alternative in the current location and lists the others", () => {
    const a = quest("A", { steps: [step(1, { npcId: "N", places: at("Везувий") })] });
    const doors = quest("D", { steps: [step(1, { places: [...at("Тунгуска", "C2-4"), ...at("Везувий", "E2-2")] })] });
    const route = buildRoute([a, doors].map((q) => ({ quest: q, entry: entry(q.id) })));
    expect(view(route)).toEqual(["Везувий: N[A#1] | E2-2[D#1]"]);
    expect(route[0].stops[1].actions[0].alternatives.map((p) => p.locationId)).toEqual(["Тунгуска"]);
  });

  it("gives hunts their own stop and sends placeless steps to the unknown block", () => {
    const hunt = quest("H", {
      end: npcEnd("Валдай", "Черный лес"),
      steps: [step(1, { kind: "kill", places: at("Черный лес"), kills: [{ mobId: "Драуг", name: "Драуг", confidence: "parsed" }] })],
    });
    const lost = quest("L", { steps: [step(1, { places: [] })] });
    expect(view(buildRoute([hunt, lost].map((q) => ({ quest: q, entry: entry(q.id) }))))).toEqual([
      "Черный лес: Драуг[H#1] | Валдай[H#2]",
      "?: [L#1]",
    ]);
  });

  it("follows a manual location order", () => {
    const a = quest("A", { steps: [step(1, { npcId: "N1", places: at("X") })] });
    const b = quest("B", { steps: [step(1, { npcId: "N2", places: at("Y") })] });
    const input = [a, b].map((q) => ({ quest: q, entry: entry(q.id) }));
    expect(view(buildRoute(input, { locationOrder: ["Y", "X"] }))).toEqual(["Y: N2[B#1]", "X: N1[A#1]"]);
  });

  it("is deterministic", () => {
    const qs = ["A", "B", "C"].map((id, i) => quest(id, { steps: [step(1, { npcId: `N${i % 2}`, places: at(i % 2 ? "X" : "Y") })] }));
    const input = qs.map((q) => ({ quest: q, entry: entry(q.id) }));
    expect(view(buildRoute(input))).toEqual(view(buildRoute(input)));
  });
});
