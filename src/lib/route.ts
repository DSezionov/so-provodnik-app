import type { Quest, StepPlace } from "../data/types";
import type { JournalEntry } from "./journal";
import { pickupStep, questPlan, type PlanStep } from "./plan";

export interface RouteQuest {
  quest: Quest;
  entry: JournalEntry;
}

export interface RouteAction {
  questId: string;
  step: PlanStep;
  /** 1-based plan position this action completes; 0 for the «взять» of a planned quest */
  planStep: number;
  place?: StepPlace;
  /** other places where the step can be done instead («любой из вариантов») */
  alternatives: StepPlace[];
}

export interface RouteStop {
  key: string;
  npcId?: string;
  hunt?: string;
  squares: string[];
  actions: RouteAction[];
}

export interface RouteBlock {
  /** null — «Локация не определена» */
  locationId: string | null;
  stops: RouteStop[];
}

interface Cursor {
  priority: number;
  quest: Quest;
  steps: { step: PlanStep; planStep: number }[];
  ptr: number;
  dependsOn: string[];
}

function stopKey(questId: string, a: { step: PlanStep; planStep: number }, place?: StepPlace): string {
  const s = a.step;
  if (s.kills.length) return `hunt:${s.kills[0].mobId ?? s.kills[0].name}`;
  if (s.npcId) return `npc:${s.npcId}`;
  if (place?.squares.length) return `sq:${place.squares.join(",")}`;
  return `step:${questId}:${a.planStep}`;
}

function choosePlace(step: PlanStep, current: string | null): StepPlace | undefined {
  return step.places.find((p) => p.locationId === current) ?? step.places[0];
}

/**
 * Greedy, deterministic route (SPEC §5.2). Quests come in priority order (journal order).
 * Steps inside a quest stay in order; a planned quest whose prerequisite is also in the journal
 * is picked up only after that prerequisite is finished. `locationOrder` (manual block order)
 * decides which location comes next when the current one has nothing left.
 */
export function buildRoute(input: RouteQuest[], opts: { locationOrder?: string[] } = {}): RouteBlock[] {
  const inJournal = new Set(input.map((x) => x.quest.id));
  const cursors: Cursor[] = input.map(({ quest, entry }, priority) => {
    const plan = questPlan(quest);
    const steps = plan.map((step, i) => ({ step, planStep: i + 1 })).slice(Math.max(0, entry.currentStep - 1));
    const pickup = entry.status === "planned" ? pickupStep(quest) : null;
    return {
      priority,
      quest,
      steps: pickup ? [{ step: pickup, planStep: 0 }, ...steps] : steps,
      ptr: 0,
      dependsOn: entry.status === "planned" ? quest.prev.map((p) => p.questId).filter((id) => id !== quest.id && inJournal.has(id)) : [],
    };
  });
  const byId = new Map(cursors.map((c) => [c.quest.id, c]));
  const finished = (c: Cursor) => c.ptr >= c.steps.length;
  const available = () =>
    cursors.filter((c) => !finished(c) && c.dependsOn.every((id) => finished(byId.get(id)!))).sort((a, b) => a.priority - b.priority);

  const blocks: RouteBlock[] = [];
  const unknown: RouteBlock = { locationId: null, stops: [] };
  let current: string | null = null;

  const emit = (block: RouteBlock, c: Cursor, place: StepPlace | undefined) => {
    const a = c.steps[c.ptr];
    const action: RouteAction = {
      questId: c.quest.id,
      step: a.step,
      planStep: a.planStep,
      place,
      alternatives: a.step.places.filter((p) => p !== place),
    };
    const key = stopKey(c.quest.id, a, place);
    const last = block.stops[block.stops.length - 1];
    // Merge only with the immediately preceding stop: merging further back could reorder a quest's steps.
    if (last && last.key === key) {
      last.actions.push(action);
      for (const sq of place?.squares ?? []) if (!last.squares.includes(sq)) last.squares.push(sq);
    } else {
      block.stops.push({
        key,
        npcId: a.step.kills.length ? undefined : a.step.npcId,
        hunt: a.step.kills.length ? a.step.kills[0].name : undefined,
        squares: [...(place?.squares ?? [])],
        actions: [action],
      });
    }
    c.ptr += 1;
  };

  for (let guard = 0; guard < 100_000; guard++) {
    const avail = available();
    if (avail.length === 0) break;

    // Steps without a known location go to the «Локация не определена» block.
    const placeless = avail.filter((c) => c.steps[c.ptr].step.places.length === 0);
    if (placeless.length) {
      for (const c of placeless) emit(unknown, c, undefined);
      continue;
    }

    let here = avail.filter((c) => choosePlace(c.steps[c.ptr].step, current)?.locationId === current);
    if (current === null || here.length === 0) {
      const ordered = (opts.locationOrder ?? []).find((loc) => avail.some((c) => c.steps[c.ptr].step.places.some((p) => p.locationId === loc)));
      current = ordered ?? choosePlace(avail[0].steps[avail[0].ptr].step, null)!.locationId;
      blocks.push({ locationId: current, stops: [] });
      here = avail.filter((c) => choosePlace(c.steps[c.ptr].step, current)?.locationId === current);
    }

    // Group what can be done here by stop (NPC / hunt / point); groups ordered by their best priority.
    const groups = new Map<string, Cursor[]>();
    for (const c of here) {
      const place = choosePlace(c.steps[c.ptr].step, current);
      const key = stopKey(c.quest.id, c.steps[c.ptr], place);
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const block = blocks[blocks.length - 1];
    for (const group of groups.values()) {
      for (const c of group) emit(block, c, choosePlace(c.steps[c.ptr].step, current));
    }
  }

  // Anything left is blocked by a dependency cycle: show it rather than drop it.
  for (const c of cursors) while (!finished(c)) emit(unknown, c, c.steps[c.ptr].step.places[0]);

  return unknown.stops.length ? [...blocks, unknown] : blocks;
}
