import { describe, expect, it } from "vitest";

import { pickupStep, questPlan, remainingPlan } from "./plan";
import { at, quest, step } from "./testQuests";

const end = { kind: "npc" as const, npcId: "Химик", locationId: "Везувий", confidence: "wiki" as const };

describe("questPlan", () => {
  it("keeps steps that already end at the end NPC", () => {
    const q = quest("Q", { end, steps: [step(1, { npcId: "Химик", places: at("Везувий") })] });
    expect(questPlan(q).map((s) => s.source)).toEqual(["step"]);
  });

  it("treats a last «принести» step without NPC as the hand-in at the end NPC", () => {
    const q = quest("Q", { end, steps: [step(1, { kind: "deliver", places: [] })] });
    const [last] = questPlan(q);
    expect(last).toMatchObject({ source: "step", npcId: "Химик", places: [{ locationId: "Везувий" }] });
  });

  it("adds «сдать» after a hunt or a step elsewhere", () => {
    const hunt = quest("Q", { end, steps: [step(1, { kind: "kill", places: at("Черный лес"), kills: [{ name: "Драуг", confidence: "parsed" }] })] });
    expect(questPlan(hunt).map((s) => s.source)).toEqual(["step", "turnIn"]);
    expect(questPlan(hunt)[1]).toMatchObject({ npcId: "Химик", places: [{ locationId: "Везувий", confidence: "wiki" }] });
  });

  it("adds no hand-in for auto-completed quests", () => {
    const q = quest("Q", { end: { kind: "auto", confidence: "wiki" }, steps: [step(1, { places: at("Тунгуска") })] });
    expect(questPlan(q).map((s) => s.source)).toEqual(["step"]);
  });

  it("labels steps with in-game journal stages only when they line up", () => {
    const steps = [step(1), step(2)];
    expect(questPlan(quest("Q", { steps, journalStages: ["A", "B"] })).map((s) => s.stage)).toEqual(["A", "B"]);
    expect(questPlan(quest("Q", { steps, journalStages: ["A"] })).map((s) => s.stage)).toEqual([undefined, undefined]);
  });

  it("returns the remaining part from the current step", () => {
    const q = quest("Q", { steps: [step(1), step(2), step(3)] });
    expect(remainingPlan(q, 2).map((s) => s.text)).toEqual(["step 2", "step 3"]);
    expect(remainingPlan(q, 4)).toEqual([]);
  });

  it("builds the pickup step at the start NPC", () => {
    expect(pickupStep(quest("Q", { start: { npcId: "Симург", locationId: "Везувий", confidence: "wiki" } }))).toMatchObject({
      source: "pickup",
      npcId: "Симург",
      places: [{ locationId: "Везувий" }],
    });
  });
});
