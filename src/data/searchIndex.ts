import { buildSearchIndex, type QuestSearchIndex } from "../lib/search";
import { entityName } from "./entities";
import type { WikiData } from "./types";

const cache = new WeakMap<WikiData, QuestSearchIndex>();

/** One search index per loaded data set, shared by the catalog and the journal. */
export function getSearchIndex(data: WikiData): QuestSearchIndex {
  let index = cache.get(data);
  if (!index) {
    index = buildSearchIndex(data.quests, {
      npc: (id) => entityName(data.npcs, id),
      location: (id) => entityName(data.locations, id),
    });
    cache.set(data, index);
  }
  return index;
}
