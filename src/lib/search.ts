import MiniSearch from "minisearch";

import type { Quest } from "../data/types";

/** Case-, ё/е- and quote-insensitive form used both for indexing and for queries. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/["'«»“”„‘’`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface SearchDoc {
  id: string;
  title: string;
  npcs: string;
  locations: string;
}

export interface QuestSearchIndex {
  mini: MiniSearch<SearchDoc>;
  quests: Map<string, Quest>;
  /** groupId -> variant quest ids, sorted by variant label */
  groups: Map<string, string[]>;
}

export interface SearchHit {
  /** best matching quest (for a variant group: the best matching variant) */
  questId: string;
  /** all variants of the group, if the quest is a variant; one catalog row per group */
  variantIds?: string[];
}

export interface NameLookup {
  npc: (id: string) => string;
  location: (id: string) => string;
}

function questNpcs(q: Quest): string[] {
  const ids = [q.start?.npcId, q.end?.kind === "npc" ? q.end.npcId : undefined, ...q.steps.map((s) => s.npcId)];
  return [...new Set(ids.filter((x): x is string => !!x))];
}

function questLocations(q: Quest): string[] {
  const ids = [q.start?.locationId, q.end?.kind === "npc" ? q.end.locationId : undefined, ...q.steps.flatMap((s) => s.places.map((p) => p.locationId))];
  return [...new Set(ids.filter((x): x is string => !!x))];
}

export function buildSearchIndex(quests: Quest[], names: NameLookup): QuestSearchIndex {
  const mini = new MiniSearch<SearchDoc>({
    fields: ["title", "npcs", "locations"],
    processTerm: (term) => normalize(term) || null,
    searchOptions: {
      boost: { title: 3 },
      prefix: true,
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      combineWith: "AND",
    },
  });
  mini.addAll(
    quests.map((q) => ({
      id: q.id,
      title: q.title,
      npcs: questNpcs(q).map(names.npc).join(" "),
      locations: questLocations(q).map(names.location).join(" "),
    })),
  );

  const groups = new Map<string, string[]>();
  for (const q of [...quests].sort((a, b) => (a.variant?.label ?? "").localeCompare(b.variant?.label ?? "", "ru"))) {
    if (!q.variant) continue;
    groups.set(q.variant.groupId, [...(groups.get(q.variant.groupId) ?? []), q.id]);
  }
  return { mini, quests: new Map(quests.map((q) => [q.id, q])), groups };
}

/**
 * Quests matching the query, best first; an empty query lists everything by title.
 * Variants of one quest collapse into a single hit; hidden quests are skipped unless `showHidden`.
 */
export function searchQuests(index: QuestSearchIndex, query: string, { showHidden = false } = {}): SearchHit[] {
  const q = normalize(query);
  const ordered: Quest[] = q
    ? index.mini.search(q).map((r) => index.quests.get(r.id as string)!)
    : [...index.quests.values()].sort((a, b) => a.title.localeCompare(b.title, "ru"));

  const hits: SearchHit[] = [];
  const seenGroups = new Set<string>();
  for (const quest of ordered) {
    if (quest.hidden && !showHidden) continue;
    const groupId = quest.variant?.groupId;
    if (!groupId) {
      hits.push({ questId: quest.id });
      continue;
    }
    if (seenGroups.has(groupId)) continue;
    seenGroups.add(groupId);
    const variantIds = (index.groups.get(groupId) ?? [quest.id]).filter((id) => showHidden || !index.quests.get(id)!.hidden);
    hits.push({ questId: quest.id, variantIds });
  }
  return hits;
}
