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
export interface Pref {
  key: string;
  value: unknown;
}

export class ProvodnikDb extends Dexie {
  journal!: Table<JournalEntry, string>;
  completed!: Table<CompletedQuest, string>;
  /** small key → value settings: checklist «есть с собой», manual location order of the route */
  prefs!: Table<Pref, string>;

  constructor() {
    super("provodnik");
    this.version(1).stores({
      journal: "questId, order",
      completed: "questId, completedAt",
    });
    // v2: route/checklist preferences. Existing tables are unchanged, nothing to migrate.
    this.version(2).stores({ prefs: "key" });
  }
}

export const db = new ProvodnikDb();
