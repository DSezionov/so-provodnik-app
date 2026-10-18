import { normalize, searchQuests, type QuestSearchIndex } from "./search";

export type LineMatch =
  | { line: string; kind: "recognized"; questId: string }
  | { line: string; kind: "ambiguous"; candidates: string[] }
  | { line: string; kind: "notFound" };

const MAX_CANDIDATES = 5;

/** One quest per line; list markers («1.», «-», «•», «[ ]») and empty lines are dropped. */
export function parsePastedList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•–—]|\[[ xх]?\])\s*/i, "").trim())
    .filter((l) => l.length > 0);
}

const withoutVariantSuffix = (title: string) => title.replace(/\s*\([^()]*\)$/, "");

/**
 * Exact title (case/ё/quotes-insensitive) → recognized; a variant group's name or several
 * search hits → ambiguous (the user picks); nothing → not found. Hidden quests are included:
 * the user explicitly listed them.
 */
export function matchLine(index: QuestSearchIndex, line: string): LineMatch {
  const norm = normalize(line);
  const quests = [...index.quests.values()];

  const exact = quests.find((q) => normalize(q.title) === norm);
  if (exact) return { line, kind: "recognized", questId: exact.id };

  const group = quests.find((q) => q.variant && normalize(withoutVariantSuffix(q.title)) === norm);
  if (group?.variant) {
    const variants = index.groups.get(group.variant.groupId) ?? [group.id];
    return variants.length === 1 ? { line, kind: "recognized", questId: variants[0] } : { line, kind: "ambiguous", candidates: variants };
  }

  const candidates = searchQuests(index, line, { showHidden: true })
    .flatMap((hit) => hit.variantIds ?? [hit.questId])
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { line, kind: "notFound" };
  if (candidates.length === 1) return { line, kind: "recognized", questId: candidates[0] };
  return { line, kind: "ambiguous", candidates };
}

export function matchPastedList(index: QuestSearchIndex, text: string): LineMatch[] {
  return parsePastedList(text).map((line) => matchLine(index, line));
}
