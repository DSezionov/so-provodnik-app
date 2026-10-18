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

const HAVE_KEY = "checklist.have";
const LOCATION_ORDER_KEY = "route.locationOrder";

interface JournalStore {
  loaded: boolean;
  /** IndexedDB failed (e.g. private mode): the journal works but will not survive a reload */
  storageError: boolean;
  entries: JournalEntry[];
  completed: CompletedQuest[];
  /** checklist keys marked «есть с собой» */
  have: string[];
  /** manual order of route location blocks; empty — automatic */
  locationOrder: string[];
  load: () => Promise<void>;
  add: (questIds: string[], status?: JournalEntry["status"]) => AddResult;
  setStatus: (questId: string, status: JournalEntry["status"]) => boolean;
  setStep: (questId: string, step: number, stepCount: number) => void;
  setQty: (questId: string, key: string, value: number | undefined) => void;
  moveTo: (questId: string, targetId: string) => void;
  moveBy: (questId: string, delta: -1 | 1) => void;
  remove: (questId: string) => void;
  complete: (questId: string) => void;
  /**
   * Marks one plan step done (route stop or journal checklist). `planStep` 0 is the «взять» of a planned
   * quest and switches it to taken; returns false if that is refused by the 50-quest limit.
   */
  completeStep: (questId: string, planStep: number, stepCount: number) => boolean;
  /** Undo for remove / complete / step: restores the previous journal and completion list. */
  restore: (entries: JournalEntry[], completed: CompletedQuest[]) => void;
  toggleHave: (key: string) => void;
  setLocationOrder: (order: string[]) => void;
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

  async function savePref(key: string, value: unknown) {
    try {
      await db.prefs.put({ key, value });
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
    have: [],
    locationOrder: [],
    load: async () => {
      if (get().loaded) return;
      try {
        const [entries, completed, have, order] = await Promise.all([
          db.journal.toArray(),
          db.completed.toArray(),
          db.prefs.get(HAVE_KEY),
          db.prefs.get(LOCATION_ORDER_KEY),
        ]);
        set({
          entries: sortEntries(entries),
          completed,
          have: (have?.value as string[] | undefined) ?? [],
          locationOrder: (order?.value as string[] | undefined) ?? [],
          loaded: true,
        });
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
    completeStep: (questId, planStep, stepCount) => {
      if (planStep === 0) {
        const next = setStatus(get().entries, questId, "taken");
        if (!next) return false;
        commit(next);
        return true;
      }
      commit(setCurrentStep(get().entries, questId, planStep + 1, stepCount));
      return true;
    },
    restore: (entries, completed) => commit(entries, completed),
    toggleHave: (key) => {
      const have = get().have.includes(key) ? get().have.filter((k) => k !== key) : [...get().have, key];
      set({ have });
      void savePref(HAVE_KEY, have);
    },
    setLocationOrder: (order) => {
      set({ locationOrder: order });
      void savePref(LOCATION_ORDER_KEY, order);
    },
  };
});
