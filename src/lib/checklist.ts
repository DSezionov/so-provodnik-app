import type { Confidence, Qty } from "../data/types";
import type { RouteQuest } from "./route";
import { remainingPlan } from "./plan";

export interface QtySum {
  min: number;
  /** null — at least one quantity has no upper bound («от N») */
  max: number | null;
  /** some quantity is not known at all («? шт.») — the sum is incomplete */
  incomplete: boolean;
}

export interface ChecklistPart {
  questId: string;
  qty?: Qty;
  /** actual amount the player entered for a ranged requirement */
  override?: number;
}

export interface ChecklistLine {
  key: string;
  /** display name for kills without a mob page */
  name?: string;
  total: QtySum;
  parts: ChecklistPart[];
  /** extracted heuristically somewhere: show «авто, проверь» */
  parsed: boolean;
}

export interface Checklist {
  items: ChecklistLine[];
  kills: ChecklistLine[];
  /** quests that need something delivered/collected but no requirement was recognized */
  checkOnWiki: string[];
}

function add(sum: QtySum, part: ChecklistPart) {
  if (part.override !== undefined) {
    sum.min += part.override;
    if (sum.max !== null) sum.max += part.override;
    return;
  }
  if (!part.qty) {
    sum.incomplete = true;
    return;
  }
  sum.min += part.qty.min;
  sum.max = sum.max === null || part.qty.max === undefined ? null : sum.max + part.qty.max;
}

function collect(lines: Map<string, ChecklistLine>, key: string, part: ChecklistPart, confidence: Confidence, name?: string) {
  let line = lines.get(key);
  if (!line) {
    line = { key, name, total: { min: 0, max: 0, incomplete: false }, parts: [], parsed: false };
    lines.set(key, line);
  }
  line.parts.push(part);
  add(line.total, part);
  if (confidence !== "wiki") line.parsed = true;
}

/** «Что взять» over the remaining steps of all journal quests (SPEC §5.3). */
export function buildChecklist(input: RouteQuest[]): Checklist {
  const items = new Map<string, ChecklistLine>();
  const kills = new Map<string, ChecklistLine>();
  const checkOnWiki: string[] = [];
  for (const { quest, entry } of input) {
    const steps = remainingPlan(quest, entry.currentStep);
    for (const s of steps) {
      for (const it of s.items) {
        collect(items, it.itemId, { questId: quest.id, qty: it.qty, override: entry.qtyOverride?.[it.itemId] }, it.confidence);
      }
      for (const k of s.kills) {
        const key = k.mobId ?? k.name;
        collect(kills, key, { questId: quest.id, qty: k.qty, override: entry.qtyOverride?.[key] }, k.confidence, k.name);
      }
    }
    const needsItems = steps.some((s) => s.source === "step" && (s.kind === "deliver" || s.kind === "collect"));
    if (needsItems && !steps.some((s) => s.items.length > 0)) checkOnWiki.push(quest.id);
  }
  return { items: [...items.values()], kills: [...kills.values()], checkOnWiki };
}
