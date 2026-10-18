// Test helpers only (not imported by app code).
import type { Quest } from "../data/types";

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
