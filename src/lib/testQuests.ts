// Test helpers only (not imported by app code).
import type { Quest, Step } from "../data/types";
import type { JournalEntry } from "./journal";

export function quest(id: string, extra: Partial<Quest> = {}): Quest {
  return {
    id,
    title: id.replace(/_/g, " "),
    url: "",
    type: "once",
    hidden: false,
    conditions: [],
    prev: [],
    prevLogic: "and",
    next: [],
    journalStages: [],
    steps: [],
    rewards: [],
    rawProcess: "",
    notes: [],
    revision: 1,
    ...extra,
  };
}

export const plainNames = { npc: (id: string) => id.replace(/_/g, " "), location: (id: string) => id.replace(/_/g, " ") };


export function step(order: number, extra: Partial<Step> = {}): Step {
  return { order, kind: "other", text: `step ${order}`, places: [], items: [], kills: [], confidence: "parsed", ...extra };
}

export const at = (locationId: string, ...squares: string[]) => [{ locationId, squares, confidence: "parsed" as const }];

export function entry(questId: string, extra: Partial<JournalEntry> = {}): JournalEntry {
  return { questId, status: "taken", order: 0, currentStep: 1, addedAt: "2026-10-18T00:00:00Z", ...extra };
}
