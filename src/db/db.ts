import Dexie, { type Table } from "dexie";

import type { JournalEntry } from "../lib/journal";

export interface CompletedQuest {
  questId: string;
  completedAt: string;
}

/**
 * IndexedDB schema. To change it, add `this.version(N + 1).stores({...}).upgrade(tx => ...)`
 * below the existing versions — never edit a released version.
 */
export class ProvodnikDb extends Dexie {
  journal!: Table<JournalEntry, string>;
  completed!: Table<CompletedQuest, string>;

  constructor() {
    super("provodnik");
    this.version(1).stores({
      journal: "questId, order",
      completed: "questId, completedAt",
    });
  }
}

export const db = new ProvodnikDb();
