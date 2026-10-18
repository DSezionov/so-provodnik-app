import type { Entity } from "./types";

const WIKI = "https://so-wiki.ru/wiki/";

/** Wiki page title from an id (ids are titles with spaces as underscores). */
export function titleFromId(id: string): string {
  return id.replace(/_/g, " ");
}

export function wikiUrl(id: string): string {
  return WIKI + encodeURIComponent(id);
}

/** Name of an NPC / location / item; ids outside the shipped dictionaries still get a readable name. */
export function entityName(map: Map<string, Entity>, id: string): string {
  return map.get(id)?.name ?? titleFromId(id);
}
