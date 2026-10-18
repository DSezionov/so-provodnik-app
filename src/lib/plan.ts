import type { Confidence, ItemReq, KillReq, Quest, StepKind, StepPlace } from "../data/types";

/**
 * One step as the player goes through a quest: the parsed wiki steps, plus «сдать NPC» at the end
 * when the last parsed step does not happen at the end NPC (SPEC §5.2). The «взять» step of planned
 * quests is not part of the plan: it depends on the journal status (see `pickupStep`).
 */
export interface PlanStep {
  source: "step" | "turnIn" | "pickup";
  kind: StepKind;
  /** in-game journal wording when the wiki stages line up 1:1 with the steps */
  stage?: string;
  text: string;
  npcId?: string;
  places: StepPlace[];
  items: ItemReq[];
  kills: KillReq[];
  confidence: Confidence;
}

function endPlace(quest: Quest): StepPlace[] {
  return quest.end?.kind === "npc" && quest.end.locationId
    ? [{ locationId: quest.end.locationId, squares: [], confidence: "wiki" }]
    : [];
}

export function questPlan(quest: Quest): PlanStep[] {
  const stages = quest.journalStages.length === quest.steps.length ? quest.journalStages : [];
  const plan: PlanStep[] = quest.steps.map((s, i) => ({
    source: "step",
    kind: s.kind,
    stage: stages[i],
    text: s.text,
    npcId: s.npcId,
    places: s.places,
    items: s.items,
    kills: s.kills,
    confidence: s.confidence,
  }));

  const end = quest.end;
  if (end?.kind !== "npc") return plan; // auto-complete or unknown end: no hand-in stop
  const last = plan[plan.length - 1];
  if (last && last.npcId === end.npcId) return plan;
  const endLoc = end.locationId;
  if (last && !last.npcId && last.kind !== "kill" && last.places.every((p) => p.locationId === endLoc)) {
    // «Принести X» without a named NPC: the wiki says the quest ends at the end NPC, so this is the hand-in.
    plan[plan.length - 1] = { ...last, npcId: end.npcId, places: last.places.length ? last.places : endPlace(quest) };
    return plan;
  }
  plan.push({ source: "turnIn", kind: "deliver", text: "", npcId: end.npcId, places: endPlace(quest), items: [], kills: [], confidence: "wiki" });
  return plan;
}

/** «Взять у start» — the first stop of a planned quest. */
export function pickupStep(quest: Quest): PlanStep | null {
  if (!quest.start) return null;
  return {
    source: "pickup",
    kind: "talk",
    text: "",
    npcId: quest.start.npcId,
    places: quest.start.locationId ? [{ locationId: quest.start.locationId, squares: [], confidence: "wiki" }] : [],
    items: [],
    kills: [],
    confidence: "wiki",
  };
}

/** Steps still to do: `currentStep` is 1-based over `questPlan`; plan length + 1 means everything is done. */
export function remainingPlan(quest: Quest, currentStep: number): PlanStep[] {
  return questPlan(quest).slice(Math.max(0, currentStep - 1));
}
