import { create } from "zustand";

import {
  addEntries,
  moveEntryBy,
  moveEntryTo,
  removeEntry,
  setCurrentStep,
  setQtyOverride,
  setStatus,
  sortEntries,
  type AddResult,
  type JournalEntry,
} from "../lib/journal";
import { db, type CompletedQuest } from "./db";

interface JournalStore {
  loaded: boolean;
  /** IndexedDB failed (e.g. private mode): the journal works but will not survive a reload */
  storageError: boolean;
  entries: JournalEntry[];
  completed: CompletedQuest[];
  load: () => Promise<void>;
  add: (questIds: string[], status?: JournalEntry["status"]) => AddResult;
  setStatus: (questId: string, status: JournalEntry["status"]) => boolean;
  setStep: (questId: string, step: number, stepCount: number) => void;
  setQty: (questId: string, key: string, value: number | undefined) => void;
  moveTo: (questId: string, targetId: string) => void;
  moveBy: (questId: string, delta: -1 | 1) => void;
  remove: (questId: string) => void;
  complete: (questId: string) => void;
  /** Undo for remove / complete: restores the previous journal and completion list. */
  restore: (entries: JournalEntry[], completed: CompletedQuest[]) => void;
}

export const useJournalStore = create<JournalStore>((set, get) => {
  async function persist(entries: JournalEntry[], completed?: CompletedQuest[]) {
    try {
      await db.transaction("rw", db.journal, db.completed, async () => {
        await db.journal.clear();
        await db.journal.bulkPut(entries);
        if (completed) {
          await db.completed.clear();
          await db.completed.bulkPut(completed);
        }
      });
    } catch {
      set({ storageError: true });
    }
  }

  function commit(entries: JournalEntry[], completed?: CompletedQuest[]) {
    const sorted = sortEntries(entries);
    set(completed ? { entries: sorted, completed } : { entries: sorted });
    void persist(sorted, completed);
  }

  return {
    loaded: false,
    storageError: false,
    entries: [],
    completed: [],
    load: async () => {
      if (get().loaded) return;
      try {
        const [entries, completed] = await Promise.all([db.journal.toArray(), db.completed.toArray()]);
        set({ entries: sortEntries(entries), completed, loaded: true });
      } catch {
        set({ loaded: true, storageError: true });
      }
    },
    add: (questIds, status) => {
      const result = addEntries(get().entries, questIds, new Date().toISOString(), status);
      if (result.added.length) commit(result.entries);
      return result;
    },
    setStatus: (questId, status) => {
      const next = setStatus(get().entries, questId, status);
      if (!next) return false;
      commit(next);
      return true;
    },
    setStep: (questId, step, stepCount) => commit(setCurrentStep(get().entries, questId, step, stepCount)),
    setQty: (questId, key, value) => commit(setQtyOverride(get().entries, questId, key, value)),
    moveTo: (questId, targetId) => commit(moveEntryTo(get().entries, questId, targetId)),
    moveBy: (questId, delta) => commit(moveEntryBy(get().entries, questId, delta)),
    remove: (questId) => commit(removeEntry(get().entries, questId)),
    complete: (questId) => {
      const completed = [...get().completed.filter((c) => c.questId !== questId), { questId, completedAt: new Date().toISOString() }];
      commit(removeEntry(get().entries, questId), completed);
    },
    restore: (entries, completed) => commit(entries, completed),
  };
});
