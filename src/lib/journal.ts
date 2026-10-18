import type { Quest } from "../data/types";

/** User state for one quest in the journal (SPEC §4.2 «Состояние пользователя»). */
export interface JournalEntry {
  questId: string;
  /** taken — already taken in the game (default); planned — going to take it on this run */
  status: "taken" | "planned";
  order: number;
  /** 1-based step to continue from («я уже на шаге N») */
  currentStep: number;
  /** itemId / mobId → actual quantity given by the game (for ranges) */
  qtyOverride?: Record<string, number>;
  addedAt: string;
}

export const JOURNAL_LIMIT = 50; // same as in the game; counts taken quests only

export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => a.order - b.order);
}

function renumber(entries: JournalEntry[]): JournalEntry[] {
  return entries.map((e, i) => (e.order === i ? e : { ...e, order: i }));
}

export function takenCount(entries: JournalEntry[]): number {
  return entries.filter((e) => e.status === "taken").length;
}

export interface AddResult {
  entries: JournalEntry[];
  added: string[];
  /** wanted «taken», but the limit of 50 is reached — added as planned */
  addedAsPlanned: string[];
  alreadyInJournal: string[];
}

/** Appends quests to the end of the journal (lowest priority), skipping ones already there. */
export function addEntries(
  entries: JournalEntry[],
  questIds: string[],
  now: string,
  status: JournalEntry["status"] = "taken",
): AddResult {
  const result: AddResult = { entries: sortEntries(entries), added: [], addedAsPlanned: [], alreadyInJournal: [] };
  let taken = takenCount(entries);
  for (const questId of questIds) {
    if (result.entries.some((e) => e.questId === questId)) {
      result.alreadyInJournal.push(questId);
      continue;
    }
    let entryStatus = status;
    if (status === "taken" && taken >= JOURNAL_LIMIT) {
      entryStatus = "planned";
      result.addedAsPlanned.push(questId);
    }
    if (entryStatus === "taken") taken += 1;
    result.entries.push({ questId, status: entryStatus, order: result.entries.length, currentStep: 1, addedAt: now });
    result.added.push(questId);
  }
  result.entries = renumber(result.entries);
  return result;
}

/** Changes the status; switching to «taken» is refused when the limit is reached. */
export function setStatus(entries: JournalEntry[], questId: string, status: JournalEntry["status"]): JournalEntry[] | null {
  const entry = entries.find((e) => e.questId === questId);
  if (!entry || entry.status === status) return entries;
  if (status === "taken" && takenCount(entries) >= JOURNAL_LIMIT) return null;
  return entries.map((e) => (e.questId === questId ? { ...e, status } : e));
}

export function removeEntry(entries: JournalEntry[], questId: string): JournalEntry[] {
  return renumber(sortEntries(entries).filter((e) => e.questId !== questId));
}

/** Moves an entry to the position of another one (drag & drop). */
export function moveEntryTo(entries: JournalEntry[], questId: string, targetId: string): JournalEntry[] {
  const list = sortEntries(entries);
  const from = list.findIndex((e) => e.questId === questId);
  const to = list.findIndex((e) => e.questId === targetId);
  if (from < 0 || to < 0 || from === to) return entries;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return renumber(list);
}

/** Moves an entry one position up (-1) or down (+1); no-op at the edges. */
export function moveEntryBy(entries: JournalEntry[], questId: string, delta: -1 | 1): JournalEntry[] {
  const list = sortEntries(entries);
  const from = list.findIndex((e) => e.questId === questId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return entries;
  return moveEntryTo(list, questId, list[to].questId);
}

export function setCurrentStep(entries: JournalEntry[], questId: string, step: number, stepCount: number): JournalEntry[] {
  const clamped = Math.min(Math.max(1, Math.round(step)), Math.max(1, stepCount));
  return entries.map((e) => (e.questId === questId ? { ...e, currentStep: clamped } : e));
}

export function setQtyOverride(entries: JournalEntry[], questId: string, key: string, value: number | undefined): JournalEntry[] {
  return entries.map((e) => {
    if (e.questId !== questId) return e;
    const overrides = { ...(e.qtyOverride ?? {}) };
    if (value === undefined || !Number.isFinite(value) || value < 0) delete overrides[key];
    else overrides[key] = Math.round(value);
    return { ...e, qtyOverride: Object.keys(overrides).length ? overrides : undefined };
  });
}

/**
 * Quests from `next` that the same NPC gives out right after handing in `quest`
 * (SPEC §5.1 «сдано», §5.5): only quests present in the data and not already in the journal.
 */
export function nextFromSameNpc(quest: Quest, questById: Map<string, Quest>, journalIds: Set<string>): Quest[] {
  const npc = quest.end?.kind === "npc" ? quest.end.npcId : undefined;
  if (!npc) return [];
  return quest.next
    .map((id) => questById.get(id))
    .filter((q): q is Quest => !!q && q.start?.npcId === npc && !journalIds.has(q.id));
}

export interface RangeRequirement {
  /** key for `qtyOverride`: itemId, or mobId / name for kills */
  key: string;
  kind: "item" | "kill";
  qty: NonNullable<Quest["steps"][number]["items"][number]["qty"]>;
}

/** Requirements of the remaining steps whose quantity the game decides (range or «от N»). */
export function rangeRequirements(quest: Quest, currentStep: number): RangeRequirement[] {
  const out = new Map<string, RangeRequirement>();
  for (const step of quest.steps.filter((s) => s.order >= currentStep)) {
    for (const it of step.items) {
      if (it.qty && it.qty.max !== it.qty.min) out.set(it.itemId, { key: it.itemId, kind: "item", qty: it.qty });
    }
    for (const k of step.kills) {
      const key = k.mobId ?? k.name;
      if (k.qty && k.qty.max !== k.qty.min) out.set(key, { key, kind: "kill", qty: k.qty });
    }
  }
  return [...out.values()];
}
